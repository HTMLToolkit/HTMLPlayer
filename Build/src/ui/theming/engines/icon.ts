import type { IconSet, IconLibraryMap, ResolvedIcon, ResolvedComponentIcon } from "../types";
import type { ThemingEvents } from "../events";
import { createLogger, throwError } from "../../../helpers/logger";

const logger = createLogger("icon");

const ICON_STORAGE_KEY = "selected-icon-set";

interface IconSetModule {
  default: {
    id: string;
    label: string;
    themeName: string;
    icons?: Record<string, unknown>;
    cssFile?: string;
    libraries?: IconLibraryMap;
  };
}

const iconJsonFiles = import.meta.glob(
  "../../resources/themes/Icons/**/*.theme.json",
  { eager: true },
);

const iconModuleFiles = import.meta.glob(
  "../../resources/themes/Icons/**/*.icons.{ts,tsx}",
  { eager: false },
);

class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const builtinLibraries: Record<string, () => Promise<Record<string, unknown>>> =
  {
    lucide: async () => {
      const lib = await import("lucide-react");
      return lib;
    },
  };

export class IconEngine {
  private iconSets: IconSet[] = [];
  private currentSet: IconSet | null = null;
  private loadedIcons: LRUCache<string, unknown> = new LRUCache(100);
  private loadedLibraries: Map<string, unknown> = new Map();
  private events: ThemingEvents;

  constructor(events: ThemingEvents) {
    this.events = events;
  }

  async load(): Promise<IconSet[]> {
    const loaded: IconSet[] = [];

    for (const [path, module] of Object.entries(iconJsonFiles)) {
      const json = (module as IconSetModule).default || module;

      if (json.icons || !json.cssFile) {
        const iconSet: IconSet = {
          id: json.id || this.extractIdFromPath(path),
          label: json.label || json.id || this.extractIdFromPath(path),
          themeName: json.themeName || json.id || "",
          path: path.replace(".theme.json", ".icons.ts"),
        };
        loaded.push(iconSet);
      }
    }

    this.iconSets = loaded;
    return loaded;
  }

  private extractIdFromPath(path: string): string {
    const match = path.match(/\/([^/]+)\/[^\/]+\.theme\.json/);
    return match ? match[1].toLowerCase() : "unknown";
  }

  getAll(): IconSet[] {
    return this.iconSets;
  }

  getCurrent(): IconSet | null {
    return this.currentSet;
  }

  getById(id: string): IconSet | undefined {
    return this.iconSets.find((s) => s.id === id || s.label === id);
  }

  async apply(iconSetId: string): Promise<void> {
    const iconSet = this.getById(iconSetId);
    if (!iconSet) {
      const error = `Icon set "${iconSetId}" not found`;
      this.events.emit("iconerror", { error });
      return throwError(error);
    }

    if (!iconModuleFiles[iconSet.path]) {
      const error = `Icon module not found: ${iconSet.path}`;
      this.events.emit("iconerror", { error });
      return throwError(error);
    }

    this.currentSet = iconSet;
    this.loadedIcons.clear();
    localStorage.setItem(ICON_STORAGE_KEY, iconSet.id);

    this.events.emit("iconchange", { iconSet: iconSet.id });
  }

  async resolve(name: string): Promise<ResolvedIcon | null> {
    if (!this.currentSet) {
      return null;
    }

    const cacheKey = `${this.currentSet.id}:${name}`;
    const cached = this.loadedIcons.get(cacheKey);
    if (cached) {
      return cached as ResolvedIcon;
    }

    try {
      const module = await iconModuleFiles[this.currentSet.path]();
      const icons = (module as { default?: IconLibraryMap }).default;

      if (icons && icons[this.currentSet.id]?.[name]) {
        const icon = icons[this.currentSet.id][name];
        // IconDefinition - need to resolve library reference to component
        if (icon && typeof icon === "object" && "type" in icon) {
          const def = icon as { type: string; library: string; icon: string };
          if (def.type === "library" && def.library === "lucide") {
            // Resolve library reference
            if (!this.loadedLibraries.has("lucide")) {
              const lucideLoader = builtinLibraries["lucide"];
              if (lucideLoader) {
                this.loadedLibraries.set("lucide", await lucideLoader());
              }
            }
            const lib = this.loadedLibraries.get("lucide") as Record<string, React.ComponentType<{ size?: number; color?: string }>>;
            const iconComponent = lib[def.icon];
            if (iconComponent) {
              const resolved: ResolvedComponentIcon = {
                type: "component",
                Component: iconComponent,
                component: iconComponent,
              };
              this.loadedIcons.set(cacheKey, resolved);
              return resolved;
            }
          }
        }
        this.loadedIcons.set(cacheKey, icon);
        return icon as ResolvedIcon;
      }

      for (const [libName, loader] of Object.entries(builtinLibraries)) {
        if (!this.loadedLibraries.has(libName)) {
          this.loadedLibraries.set(libName, await loader());
        }
        const lib = this.loadedLibraries.get(libName) as Record<
          string,
          React.ComponentType<{ size?: number; color?: string }>
        >;
        // Try exact match first, then title case (icons defined as "Play", code passes "play")
        const exactName = name.charAt(0).toUpperCase() + name.slice(1);
        const iconComponent = lib[name] || lib[exactName];
        if (iconComponent) {
          const resolved: ResolvedComponentIcon = {
            type: "component",
            Component: iconComponent,
            component: iconComponent,
          };
          this.loadedIcons.set(cacheKey, resolved);
          return resolved;
        }
      }

      return null;
    } catch (error) {
      logger.error(`Failed to resolve icon "${name}":`, { error: String(error) });
      return null;
    }
  }

  getStored(): string | null {
    return localStorage.getItem(ICON_STORAGE_KEY);
  }

  reset(): void {
    this.currentSet = null;
    this.loadedIcons.clear();
    this.loadedLibraries.clear();
    localStorage.removeItem(ICON_STORAGE_KEY);
  }
}
