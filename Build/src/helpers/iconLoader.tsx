import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconDefinition,
  IconDefinitionMap,
  IconLibraryConfigMap,
  IconLibraryMap,
  IconLookupOptions,
  IconPropTransformer,
  IconSetMetadata,
  IconSetModule,
  ResolvedIcon,
} from "../types/icons";
import { loadThemeJsonFromSourcePath } from "./themeMetadata";

interface IconRegistrySet {
  id: string;
  label: string;
  themeName: string;
  metadata: IconSetMetadata & { id: string; label: string; themeName: string };
  icons: IconDefinitionMap;
  path: string;
  libraries?: IconLibraryMap;
  libraryConfig?: IconLibraryConfigMap;
}

interface IconDefinitionEntry {
  definition: IconDefinition;
  set: IconRegistrySet;
}

interface IconRegistryValue {
  iconSets: IconRegistrySet[];
  iconSetMap: Map<string, IconRegistrySet>;
  currentSet: IconRegistrySet | null;
  isLoading: boolean;
  iconsReady: boolean;
  error: string | null;
  setIconSet: (idOrName: string) => void;
  getIconDefinition: (
    name: string,
    options?: IconLookupOptions,
  ) => IconDefinition | undefined;
  loadIcon: (
    name: string,
    options?: IconLookupOptions,
  ) => Promise<ResolvedIcon | null>;
}

interface IconRegistryProviderProps {
  defaultSetId?: string;
  rememberSelection?: boolean;
  onSetChange?: (set: IconRegistrySet) => void;
  children: React.ReactNode;
}

const iconModuleLoaders = import.meta.glob("../themes/**/*.icons.{ts,tsx}");

const builtinLibraryLoaders: Record<
  string,
  () => Promise<Record<string, any>>
> = {
  lucide: async () => import("lucide-react"),
};

const IconRegistryContext = createContext<IconRegistryValue | null>(null);

const LOCAL_STORAGE_KEY = "selected-icon-set";
// LRU cache implementation for icons
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
    // Move to end (most recently used)
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
      // Remove least recently used
      const lruKeyIter = this.cache.keys().next();
      if (!lruKeyIter.done) {
        const lruKey = lruKeyIter.value as K;
        this.cache.delete(lruKey);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const ICON_CACHE_SIZE = 128; // TODO: Tune
const resolvedIconCache = new LRUCache<string, ResolvedIcon>(ICON_CACHE_SIZE);
const libraryModuleCache = new LRUCache<string, Record<string, any>>(8); // Limit loaded libraries

function deriveSetIdentity(
  path: string,
  metadata?: IconSetMetadata,
  themeJson?: any,
): {
  id: string;
  label: string;
  themeName: string;
} {
  const segments = path.split("/");
  const fileName = segments[segments.length - 1] ?? "";
  const baseName = fileName.replace(/\.icons\.(?:ts|tsx)$/, "");

  // Use theme JSON metadata if available
  const iconMeta = themeJson?.icons || {};
  const themeName =
    themeJson?.name ??
    metadata?.theme ??
    segments[segments.length - 2] ??
    baseName;

  // Priority: JSON metadata > TS metadata > derived values
  const derivedName =
    iconMeta.label ?? metadata?.label ?? metadata?.id ?? themeName ?? baseName;
  const normalizedId = (
    iconMeta.id ??
    metadata?.id ??
    themeName ??
    derivedName
  ).toLowerCase();

  return {
    id: normalizedId,
    label: iconMeta.label ?? metadata?.label ?? derivedName,
    themeName,
  };
}

const GLOBAL_LIBRARY_NAMESPACE = "__global";

async function resolveLibraryModule(
  library: string,
  sourceSet?: IconRegistrySet,
): Promise<Record<string, any> | null> {
  const cacheKey = `${sourceSet ? sourceSet.id : GLOBAL_LIBRARY_NAMESPACE}::${library}`;
  const cachedModule = libraryModuleCache.get(cacheKey);
  if (cachedModule) {
    return cachedModule;
  }

  // First check if the library is already available in the sourceSet
  let loaderCandidate = sourceSet?.libraries?.[library];

  if (!loaderCandidate) {
    // Check builtin loaders
    loaderCandidate = builtinLibraryLoaders[library];
  }

  if (!loaderCandidate) {
    // Try to load the library dynamically if it's a known library
    if (library === "lucide" && sourceSet?.id === "lucide") {
      try {
        const lucideModule = await import("lucide-react");
        libraryModuleCache.set(cacheKey, lucideModule);
        return lucideModule;
      } catch (error) {
        console.error(`Failed to dynamically load lucide-react`, error);
        return null;
      }
    }
    return null;
  }

  try {
    let module: Record<string, any>;
    if (typeof loaderCandidate === "function") {
      const result = loaderCandidate();
      module = (result instanceof Promise ? await result : result) as Record<
        string,
        any
      >;
    } else {
      module = loaderCandidate as Record<string, any>;
    }

    libraryModuleCache.set(cacheKey, module);
    return module;
  } catch (error) {
    console.error(`Failed to load icon library "${library}"`, error);
    return null;
  }
}

function getExportByPath(
  container: Record<string, any> | undefined,
  path: string,
): any {
  if (!container) return undefined;
  const segments = path.split(".");
  let current: any = container;
  for (const segment of segments) {
    if (current && typeof current === "object" && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

async function loadLibraryIcon(
  library: string,
  iconName: string,
  sourceSet?: IconRegistrySet,
): Promise<React.ComponentType<React.SVGProps<SVGSVGElement>> | null> {
  const module = await resolveLibraryModule(library, sourceSet);

  if (!module) {
    console.warn(
      `Unsupported icon library "${library}"${sourceSet ? ` for set "${sourceSet.label}"` : ""}`,
    );
    return null;
  }

  const candidateNames = new Set<string>([iconName]);
  if (!iconName.includes(".") && !iconName.endsWith("Icon")) {
    candidateNames.add(`${iconName}Icon`);
  }

  const pascalCase = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  const camelCase = iconName.charAt(0).toLowerCase() + iconName.slice(1);
  candidateNames.add(pascalCase);
  candidateNames.add(camelCase);

  const candidateContainers = [
    module,
    (module as any).default,
    (module as any).icons,
    (module as any).default?.icons,
  ].filter((container) => container && typeof container === "object");

  let resolvedExport: any;
  for (const container of candidateContainers) {
    for (const pathCandidate of candidateNames) {
      resolvedExport = getExportByPath(
        container as Record<string, any>,
        pathCandidate,
      );
      if (resolvedExport) {
        break;
      }
    }

    if (resolvedExport) {
      break;
    }
  }

  if (
    resolvedExport &&
    typeof resolvedExport === "object" &&
    typeof resolvedExport.default === "function"
  ) {
    resolvedExport = resolvedExport.default;
  }

  // Check if it's a valid React component (function or forwardRef/memo)
  if (typeof resolvedExport === "function") {
    return resolvedExport as React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }

  // Handle React.forwardRef/React.memo wrapped components
  if (
    resolvedExport &&
    typeof resolvedExport === "object" &&
    (resolvedExport.$$typeof || resolvedExport.render)
  ) {
    return resolvedExport as React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }

  console.warn(`Icon "${iconName}" not found in library "${library}"`);
  return null;
}

export const IconRegistryProvider: React.FC<IconRegistryProviderProps> = ({
  defaultSetId,
  rememberSelection = true,
  onSetChange,
  children,
}) => {
  const [iconSets, setIconSets] = useState<IconRegistrySet[]>([]);
  const [currentSet, setCurrentSet] = useState<IconRegistrySet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [iconsReady, setIconsReady] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    // Only load metadata for all sets, not the full icon maps
    const loadSetMetadatas = async () => {
      try {
        setIsLoading(true);
        setIconsReady(false);
        setError(null);

        const entries: IconRegistrySet[] = [];

        for (const [path] of Object.entries(iconModuleLoaders)) {
          try {
            // Load theme JSON for metadata without loading the full icon module
            const themeJson = await loadThemeJsonFromSourcePath(path);
            // Skip loading the full module at startup - only load metadata from themeJson
            const identity = deriveSetIdentity(path, undefined, themeJson);
            const iconMeta = themeJson?.icons || {};
            const fullMetadata: IconSetMetadata & {
              id: string;
              label: string;
              themeName: string;
            } = {
              id: identity.id,
              label: identity.label,
              themeName: identity.themeName,
              description: iconMeta.description,
              version: iconMeta.version,
              theme: identity.themeName,
              inheritsFrom: iconMeta.inheritsFrom,
              author: iconMeta.author ?? themeJson?.author,
              tags: iconMeta.tags,
            };
            // Only set icons to empty object until loaded
            const registrySet: IconRegistrySet = {
              id: identity.id,
              label: identity.label,
              themeName: identity.themeName,
              metadata: fullMetadata,
              icons: {},
              path,
              libraries: undefined,
              libraryConfig: undefined,
            };
            entries.push(registrySet);
          } catch (err) {
            console.error(
              `Failed to load icon registry module metadata at ${path}`,
              err,
            );
          }
        }

        if (!cancelled) {
          entries.sort((a, b) => a.label.localeCompare(b.label));
          setIconSets(entries);

          const storedId = rememberSelection
            ? typeof window !== "undefined"
              ? localStorage.getItem(LOCAL_STORAGE_KEY)
              : null
            : null;

          const preferredId = storedId ?? defaultSetId;

          const nextSet = preferredId
            ? entries.find(
                (entry) =>
                  entry.id === preferredId || entry.themeName === preferredId,
              )
            : null;

          const fallbackSet =
            nextSet ??
            entries.find(
              (entry) => entry.metadata?.inheritsFrom === undefined,
            ) ??
            entries[0] ??
            null;

          // Only load icons for the current set, not all sets
          if (fallbackSet) {
            // Load icons for fallbackSet only
            const loader = iconModuleLoaders[fallbackSet.path];
            if (loader) {
              loader().then((module: any) => {
                const loadedSet = {
                  ...fallbackSet,
                  icons: module.default,
                  libraries: module.libraries,
                  libraryConfig: module.libraryConfig,
                };
                setIconSets((sets) =>
                  sets.map((s) => (s.id === loadedSet.id ? loadedSet : s)),
                );
                setCurrentSet(loadedSet);
                setIconsReady(true);
                if (rememberSelection && typeof window !== "undefined") {
                  localStorage.setItem(LOCAL_STORAGE_KEY, loadedSet.id);
                }
              });
            } else {
              setCurrentSet(fallbackSet);
              setIconsReady(true);
              if (rememberSelection && typeof window !== "undefined") {
                localStorage.setItem(LOCAL_STORAGE_KEY, fallbackSet.id);
              }
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Unable to load icon registry";
          setError(message);
          console.error("Icon registry loading error:", err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSetMetadatas();

    return () => {
      cancelled = true;
    };
  }, [defaultSetId, rememberSelection]);

  const iconSetMap = useMemo(() => {
    const map = new Map<string, IconRegistrySet>();
    for (const set of iconSets) {
      map.set(set.id, set);
      map.set(set.themeName.toLowerCase(), set);
    }
    return map;
  }, [iconSets]);

  const notifyChange = useRef(onSetChange);
  notifyChange.current = onSetChange;

  const setIconSet = useCallback(
    async (idOrName: string) => {
      const normalized = idOrName.toLowerCase();
      let next =
        iconSetMap.get(normalized) ??
        iconSets.find(
          (set) =>
            set.id === normalized || set.themeName.toLowerCase() === normalized,
        );
      if (!next) {
        console.warn(`Icon set "${idOrName}" not found`);
        return;
      }

      setIconsReady(false);

      // If icons not loaded, load them now
      if (!next.icons || Object.keys(next.icons).length === 0) {
        try {
          const loader = iconModuleLoaders[next.path];
          if (loader) {
            const module = (await loader()) as IconSetModule;
            next = {
              ...next,
              icons: module.default,
              libraries: module.libraries,
              libraryConfig: module.libraryConfig,
            };
            // Update iconSets and iconSetMap
            if (next) {
              setIconSets((sets) => {
                return sets.map((s) => {
                  if (s.id === next!.id) {
                    return next!;
                  }
                  return s;
                });
              });
            }
          }
        } catch (err) {
          console.error(`Failed to load icon set "${next.label}"`, err);
        }
      }

      setCurrentSet(next);
      setIconsReady(true);
      if (typeof window !== "undefined" && rememberSelection) {
        localStorage.setItem(LOCAL_STORAGE_KEY, next.id);
      }

      notifyChange.current?.(next);
    },
    [iconSetMap, iconSets, rememberSelection],
  );

  const resolveIconEntry = useCallback(
    (
      name: string,
      startSet: IconRegistrySet | null,
      visited: Set<string>,
    ): IconDefinitionEntry | undefined => {
      if (!startSet || visited.has(startSet.id)) {
        return undefined;
      }

      visited.add(startSet.id);

      const definition = startSet.icons[name];
      if (definition) {
        return { definition, set: startSet };
      }

      const parentId = startSet.metadata?.inheritsFrom;
      if (parentId) {
        const parent =
          iconSetMap.get(parentId) ?? iconSetMap.get(parentId.toLowerCase());
        if (parent) {
          return resolveIconEntry(name, parent, visited);
        }
      }

      return undefined;
    },
    [iconSetMap],
  );

  const findIconEntry = useCallback(
    (
      name: string,
      options?: IconLookupOptions,
    ): IconDefinitionEntry | undefined => {
      if (!name) return undefined;

      const primary = options?.setId
        ? (iconSetMap.get(options.setId) ??
          iconSetMap.get(options.setId.toLowerCase()) ??
          null)
        : (currentSet ?? iconSets[0] ?? null);

      const primaryEntry = resolveIconEntry(name, primary, new Set<string>());
      if (primaryEntry) {
        return primaryEntry;
      }

      if (options?.fallbackOrder && options.fallbackOrder.length > 0) {
        for (const fallback of options.fallbackOrder) {
          const fallbackSet =
            iconSetMap.get(fallback) ?? iconSetMap.get(fallback.toLowerCase());
          const entry = resolveIconEntry(
            name,
            fallbackSet ?? null,
            new Set<string>(),
          );
          if (entry) {
            return entry;
          }
        }
      }

      return undefined;
    },
    [currentSet, iconSetMap, iconSets, resolveIconEntry],
  );

  const getIconDefinition = useCallback(
    (name: string, options?: IconLookupOptions) =>
      findIconEntry(name, options)?.definition,
    [findIconEntry],
  );

  const loadIcon = useCallback(
    async (
      name: string,
      options?: IconLookupOptions,
    ): Promise<ResolvedIcon | null> => {
      if (!name) {
        return null;
      }

      // Ensure currentSet icons are loaded
      if (
        currentSet &&
        (!currentSet.icons || Object.keys(currentSet.icons).length === 0)
      ) {
        setIconsReady(false);
        try {
          const loader = iconModuleLoaders[currentSet.path];
          if (loader) {
            const module = (await loader()) as IconSetModule;
            setIconSets((sets) =>
              sets.map((s) =>
                s.id === currentSet.id
                  ? {
                      ...s,
                      icons: module.default,
                      libraries: module.libraries,
                      libraryConfig: module.libraryConfig,
                    }
                  : s,
              ),
            );
          }
        } catch (err) {
          console.error(`Failed to load icon set "${currentSet.label}"`, err);
        }
        setIconsReady(true);
      }

      const entry = findIconEntry(name, options);
      if (!entry) {
        return null;
      }

      const cacheKeyParts = [entry.set.id, name];
      if (options?.setId) {
        cacheKeyParts.push(`requested:${options.setId}`);
      }
      if (options?.fallbackOrder && options.fallbackOrder.length > 0) {
        cacheKeyParts.push(`fallback:${options.fallbackOrder.join("|")}`);
      }
      const cacheKey = cacheKeyParts.join("::");

      const cached = resolvedIconCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const { definition, set } = entry;

      switch (definition.type) {
        case "library": {
          const component = await loadLibraryIcon(
            definition.library,
            definition.icon,
            set,
          );
          if (!component) {
            console.warn(
              `Icon "${definition.icon}" from library "${definition.library}" not found.`,
            );
            return null;
          }

          // Extract prop transformer for this library
          const libraryConfig = set.libraryConfig?.[definition.library];
          let propTransformer: IconPropTransformer | undefined;

          if (
            libraryConfig &&
            typeof libraryConfig === "object" &&
            "propTransformer" in libraryConfig
          ) {
            const transformer = (libraryConfig as any).propTransformer;
            if (typeof transformer === "function") {
              propTransformer = transformer as IconPropTransformer;
            }
          }

          const resolved: ResolvedIcon = {
            type: "component",
            Component: component,
            defaultProps: {},
            propTransformer,
            title: definition.title,
          };

          resolvedIconCache.set(cacheKey, resolved);
          return resolved;
        }
        case "component": {
          const resolved: ResolvedIcon = {
            type: "component",
            Component: definition.component,
            defaultProps: definition.props,
            title: definition.title,
          };
          resolvedIconCache.set(cacheKey, resolved);
          return resolved;
        }
        case "image": {
          const resolved: ResolvedIcon = {
            type: "image",
            src: definition.src,
            alt: definition.alt,
            title: definition.title,
          };
          resolvedIconCache.set(cacheKey, resolved);
          return resolved;
        }
        case "svg-inline": {
          const resolved: ResolvedIcon = {
            type: "svg-inline",
            content: definition.content,
            viewBox: definition.viewBox,
            alt: definition.alt,
            title: definition.title,
          };
          resolvedIconCache.set(cacheKey, resolved);
          return resolved;
        }
        default: {
          console.warn(`Unsupported icon definition type for icon "${name}"`);
          return null;
        }
      }
    },
    [findIconEntry, currentSet, setIconSets],
  );

  const contextValue = useMemo<IconRegistryValue>(
    () => ({
      iconSets,
      iconSetMap,
      currentSet,
      isLoading,
      iconsReady,
      error,
      setIconSet,
      getIconDefinition,
      loadIcon,
    }),
    [
      currentSet,
      error,
      getIconDefinition,
      iconSetMap,
      iconSets,
      isLoading,
      iconsReady,
      loadIcon,
      setIconSet,
    ],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).iconRegistry = {
        list: () => iconSets,
        current: () => currentSet,
        set: (id: string) => setIconSet(id),
      };
    }
  }, [iconSets, currentSet, setIconSet]);

  return (
    <IconRegistryContext.Provider value={contextValue}>
      {children}
    </IconRegistryContext.Provider>
  );
};

export const useIconRegistry = () => {
  const context = useContext(IconRegistryContext);
  if (!context) {
    throw new Error(
      "useIconRegistry must be used within an IconRegistryProvider",
    );
  }
  return context;
};
