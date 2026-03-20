import type { Wallpaper, WallpaperProps, WallpaperComponent } from "../types";
import type { ThemingEvents } from "../events";

const WALLPAPER_STORAGE_KEY = "selected-wallpaper";

interface WallpaperModule {
  default: React.ComponentType<WallpaperProps>;
  metadata?: {
    wallpaper?: Omit<Wallpaper, "componentFile">;
  };
}

const wallpaperJsonFiles = import.meta.glob(
  "../../resources/themes/Wallpapers/**/*.theme.json",
  { eager: true },
);

const wallpaperComponentFiles = import.meta.glob(
  "../../resources/themes/Wallpapers/**/*.wallpaper.tsx",
  { eager: false },
);

export class WallpaperEngine {
  private wallpapers: Wallpaper[] = [];
  private currentWallpaper: Wallpaper | null = null;
  private currentComponent: WallpaperComponent | null = null;
  private events: ThemingEvents;

  constructor(events: ThemingEvents) {
    this.events = events;
  }

  async load(): Promise<Wallpaper[]> {
    const loaded: Wallpaper[] = [];

    for (const path of Object.keys(wallpaperComponentFiles)) {
      const jsonPath = path.replace(".wallpaper.tsx", ".theme.json");
      const jsonModule = wallpaperJsonFiles[jsonPath];

      if (jsonModule) {
        const json = (jsonModule as { default?: { wallpaper?: Record<string, string> } }).default || jsonModule;
        const wallpaperMeta = (json as { wallpaper?: Record<string, string> }).wallpaper;

        if (wallpaperMeta) {
          const wallpaper: Wallpaper = {
            name: wallpaperMeta.name || this.extractNameFromPath(path),
            author: wallpaperMeta.author || "",
            description: wallpaperMeta.description || "",
            version: wallpaperMeta.version || "",
            componentFile: path,
          };
          loaded.push(wallpaper);
        }
      }
    }

    this.wallpapers = loaded;
    return loaded;
  }

  private extractNameFromPath(path: string): string {
    const match = path.match(/\/([^/]+)\/[^\/]+\.wallpaper\.tsx/);
    return match ? match[1] : "Unknown";
  }

  getAll(): Wallpaper[] {
    return this.wallpapers;
  }

  getCurrent(): Wallpaper | null {
    return this.currentWallpaper;
  }

  getCurrentComponent(): WallpaperComponent | null {
    return this.currentComponent;
  }

  getByName(name: string): Wallpaper | undefined {
    return this.wallpapers.find((w) => w.name === name);
  }

  async apply(wallpaperName: string): Promise<void> {
    const wallpaper = this.getByName(wallpaperName);
    if (!wallpaper) {
      const error = `Wallpaper "${wallpaperName}" not found`;
      this.events.emit("wallpapererror", { error });
      throw new Error(error);
    }

    if (!wallpaperComponentFiles[wallpaper.componentFile]) {
      const error = `Wallpaper component not found: ${wallpaper.componentFile}`;
      this.events.emit("wallpapererror", { error });
      throw new Error(error);
    }

    try {
      const module = await wallpaperComponentFiles[wallpaper.componentFile]() as WallpaperModule;
      this.currentComponent = module.default;
    } catch (error) {
      const errorMsg = `Failed to load wallpaper: ${(error as Error).message}`;
      this.events.emit("wallpapererror", { error: errorMsg });
      throw new Error(errorMsg);
    }

    this.currentWallpaper = wallpaper;
    localStorage.setItem(WALLPAPER_STORAGE_KEY, wallpaper.name);

    this.events.emit("wallpaperchange", { wallpaper: wallpaper.name });
  }

  getStored(): string | null {
    return localStorage.getItem(WALLPAPER_STORAGE_KEY);
  }

  reset(): void {
    this.currentWallpaper = null;
    this.currentComponent = null;
    localStorage.removeItem(WALLPAPER_STORAGE_KEY);
  }
}
