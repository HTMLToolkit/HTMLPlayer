import { ThemingEvents, type ThemingEvent, type ThemeMode } from "./events";
import { PaletteEngine } from "./engines/palette";
import { IconEngine } from "./engines/icon";
import { WallpaperEngine } from "./engines/wallpaper";
import { ThemeModeEngine } from "./engines/mode";
import type {
  Palette,
  IconSet,
  Wallpaper,
  ThemeConfig,
  ThemingState,
} from "./types";

export interface ThemingEventMap {
  ready: { palettes: Palette[]; iconSets: IconSet[]; wallpapers: Wallpaper[] };
  error: { source: string; error: string };
}

export class ThemeEngine {
  private events = new ThemingEvents();
  private palette = new PaletteEngine(this.events);
  private icon = new IconEngine(this.events);
  private wallpaper = new WallpaperEngine(this.events);
  private mode = new ThemeModeEngine(this.events);
  private config: ThemeConfig;
  private isReady = false;
  private isLoading = false;

  constructor(config?: Partial<ThemeConfig>) {
    this.config = {
      defaultPalette: config?.defaultPalette || "Blue",
      defaultIconSet: config?.defaultIconSet || "lucide",
      defaultWallpaper: config?.defaultWallpaper || "None",
      defaultMode: config?.defaultMode || "auto",
    };

    const broadcastFn = () => {
      this.events.emit("themechange", null);
    };
    this.palette.setBroadcastCallback(broadcastFn);
    this.mode.setBroadcastCallback(broadcastFn);
  }

  on<E extends ThemingEvent>(event: E, callback: (data: unknown) => void): void {
    this.events.on(event, callback);
  }

  off<E extends ThemingEvent>(event: E, callback: (data: unknown) => void): void {
    this.events.off(event, callback);
  }

  async initialize(): Promise<void> {
    if (this.isLoading || this.isReady) return;
    this.isLoading = true;

    try {
      await Promise.all([
        this.palette.load(),
        this.icon.load(),
        this.wallpaper.load(),
      ]);

      this.mode.initialize();

      await this.applyDefaults();

      this.isReady = true;
    } catch (error) {
      console.error("ThemeEngine initialization error:", error);
    } finally {
      this.isLoading = false;
    }
  }

  private async applyDefaults(): Promise<void> {
    const storedPalette = this.palette.getStored();
    const storedIcon = this.icon.getStored();
    const storedWallpaper = this.wallpaper.getStored();

    try {
      await this.palette.apply(storedPalette || this.config.defaultPalette);
    } catch {
      await this.palette.apply(this.config.defaultPalette);
    }

    try {
      await this.icon.apply(storedIcon || this.config.defaultIconSet);
    } catch {
      await this.icon.apply(this.config.defaultIconSet);
    }

    try {
      await this.wallpaper.apply(storedWallpaper || this.config.defaultWallpaper);
    } catch {
      await this.wallpaper.apply(this.config.defaultWallpaper);
    }
  }

  getState(): ThemingState {
    return {
      palette: this.palette.getCurrent(),
      iconSet: this.icon.getCurrent(),
      wallpaper: this.wallpaper.getCurrent(),
      mode: this.mode.get(),
      isLoading: this.isLoading,
      error: null,
    };
  }

  async setPalette(name: string): Promise<void> {
    await this.palette.apply(name);
  }

  async setIconSet(id: string): Promise<void> {
    await this.icon.apply(id);
  }

  async setWallpaper(name: string): Promise<void> {
    await this.wallpaper.apply(name);
  }

  setMode(mode: ThemeMode): void {
    this.mode.setMode(mode);
  }

  getPalettes(): Palette[] {
    return this.palette.getAll();
  }

  getIconSets(): IconSet[] {
    return this.icon.getAll();
  }

  getWallpapers(): Wallpaper[] {
    return this.wallpaper.getAll();
  }

  getCurrentPalette(): Palette | null {
    return this.palette.getCurrent();
  }

  getCurrentIconSet(): IconSet | null {
    return this.icon.getCurrent();
  }

  getCurrentWallpaper(): Wallpaper | null {
    return this.wallpaper.getCurrent();
  }

  getCurrentMode(): ThemeMode {
    return this.mode.get();
  }

  async resolveIcon(name: string) {
    return this.icon.resolve(name);
  }

  getWallpaperComponent() {
    return this.wallpaper.getCurrentComponent();
  }

  getCssVariables(): string {
    return this.mode.getCssVariables();
  }

  reset(): void {
    this.palette.reset();
    this.icon.reset();
    this.wallpaper.reset();
    this.mode.reset();
    this.isReady = false;
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  exposeGlobally(): void {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).themeEngine = {
        getPalettes: () => this.palette.getAll(),
        getCurrentPalette: () => this.palette.getCurrent(),
        setPalette: (name: string) => this.palette.apply(name),
        getIconSets: () => this.icon.getAll(),
        getCurrentIconSet: () => this.icon.getCurrent(),
        setIconSet: (id: string) => this.icon.apply(id),
        getWallpapers: () => this.wallpaper.getAll(),
        getCurrentWallpaper: () => this.wallpaper.getCurrent(),
        setWallpaper: (name: string) => this.wallpaper.apply(name),
        getMode: () => this.mode.get(),
        setMode: (mode: ThemeMode) => this.mode.setMode(mode),
        getCssVariables: () => this.mode.getCssVariables(),
      };
    }
  }
}
