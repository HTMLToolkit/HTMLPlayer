import type { Palette } from "../types";
import type { ThemingEvents } from "../events";
import { createLogger, throwError } from "../../../helpers/logger";

const logger = createLogger("palette");

const PALETTE_STORAGE_KEY = "selected-color-theme";

const paletteJsonFiles = import.meta.glob(
  "../../resources/themes/Palettes/**/*.theme.json",
  { eager: true },
);

const paletteCssFiles = import.meta.glob(
  "../../resources/themes/Palettes/**/*.theme.css",
  { query: "?raw", import: "default", eager: false },
);

const paletteImageFiles = import.meta.glob(
  "../../resources/themes/Palettes/**/*.{jpg,jpeg,png,gif,webp,svg}",
  { eager: true },
);

export class PaletteEngine {
  private palettes: Palette[] = [];
  private currentPalette: Palette | null = null;
  private events: ThemingEvents;
  private onBroadcast: (() => void) | null = null;

  constructor(events: ThemingEvents) {
    this.events = events;
  }

  setBroadcastCallback(callback: () => void): void {
    this.onBroadcast = callback;
  }

  async load(): Promise<Palette[]> {
    const loaded: Palette[] = [];

    for (const [path, module] of Object.entries(paletteJsonFiles)) {
      const json = (module as Record<string, unknown>).default || module;
      const palette = this.validatePalette(json, path);
      if (palette) {
        const cssExists = Object.keys(paletteCssFiles).some((cssPath) =>
          cssPath.endsWith(palette.cssFile),
        );
        if (cssExists) {
          loaded.push(palette);
        }
      }
    }

    this.palettes = loaded;
    return loaded;
  }

  private validatePalette(meta: unknown, path: string): Palette | null {
    if (!meta || typeof meta !== "object") {
      logger.warn(`Palette file ${path}: Invalid metadata format`);
      return null;
    }

    const data = meta as Record<string, unknown>;
    const required = ["name", "author", "description", "version", "cssFile"];
    for (const field of required) {
      if (!data[field] || typeof data[field] !== "string") {
        logger.warn(
          `Palette file ${path}: Missing or invalid field "${field}"`,
        );
        return null;
      }
    }

    return data as unknown as Palette;
  }

  getAll(): Palette[] {
    return this.palettes;
  }

  getCurrent(): Palette | null {
    return this.currentPalette;
  }

  getByName(name: string): Palette | undefined {
    return this.palettes.find((p) => p.name === name);
  }

  async apply(paletteName: string): Promise<void> {
    const palette = this.getByName(paletteName);
    if (!palette) {
      const error = `Palette "${paletteName}" not found`;
      this.events.emit("paletteerror", { error });
      return throwError(error);
    }

    const cssPath = Object.keys(paletteCssFiles).find((path) =>
      path.endsWith(palette.cssFile),
    );

    if (!cssPath) {
      const error = `CSS file not found: ${palette.cssFile}`;
      this.events.emit("paletteerror", { error });
      return throwError(error);
    }

    this.removeAllPaletteStyles();

    const cssModule = await (
      paletteCssFiles[cssPath] as () => Promise<string>
    )();
    const processedCss = this.processCssImages(cssModule, cssPath);

    const styleElement = document.createElement("style");
    styleElement.id = `palette-stylesheet-${palette.name}`;
    styleElement.textContent = processedCss;

    await this.waitForRender();
    document.head.appendChild(styleElement);
    await this.waitForStyles();

    this.currentPalette = palette;
    localStorage.setItem(PALETTE_STORAGE_KEY, palette.name);

    this.updateMetaThemeColor();
    this.events.emit("palettechange", { palette: palette.name });

    setTimeout(() => {
      this.onBroadcast?.();
    }, 200);
  }

  private processCssImages(css: string, cssPath: string): string {
    const themeDir = cssPath.replace(/\/[^\/]+$/, "");

    return css.replace(/url\(['"]?([^'"\)]+)['"]?\)/g, (_, url) => {
      if (
        url.startsWith("data:") ||
        url.startsWith("http") ||
        url.startsWith("/")
      ) {
        return `url('${url}')`;
      }

      const imagePath = `${themeDir}/${url}`;
      const imageModule = paletteImageFiles[imagePath];

      if (imageModule) {
        return `url('${(imageModule as { default: string }).default}')`;
      }

      logger.warn(`Image not found in imports: ${imagePath}`);
      return `url('${url}')`;
    });
  }

  private removeAllPaletteStyles(): void {
    document.querySelectorAll('[id^="palette-stylesheet"]').forEach((el) => {
      el.remove();
    });
  }

  private async waitForRender(): Promise<void> {
    return new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 50)),
    );
  }

  private async waitForStyles(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        document.documentElement.offsetHeight;
        setTimeout(resolve, 100);
      });
    });
  }

  private updateMetaThemeColor(): void {
    const themeColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--themecolor2")
      .trim();

    let meta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
  }

  getStored(): string | null {
    return localStorage.getItem(PALETTE_STORAGE_KEY);
  }

  reset(): void {
    this.removeAllPaletteStyles();
    this.currentPalette = null;
    localStorage.removeItem(PALETTE_STORAGE_KEY);
  }
}
