import { type ThemeMode, type ThemingEvents } from "../events";

const MODE_STORAGE_KEY = "themeMode";

export class ThemeModeEngine {
  private currentMode: ThemeMode = "auto";
  private mediaQuery: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private events: ThemingEvents;
  private onBroadcast: (() => void) | null = null;

  constructor(events: ThemingEvents) {
    this.events = events;
  }

  setBroadcastCallback(callback: () => void): void {
    this.onBroadcast = callback;
  }

  get(): ThemeMode {
    return this.currentMode;
  }

  setMode(mode: ThemeMode): void {
    const shouldSkip = this.currentMode === mode && mode !== "auto";
    
    this.clearMediaQueryListener();

    switch (mode) {
      case "dark":
        document.documentElement.classList.add("dark");
        break;
      case "light":
        document.documentElement.classList.remove("dark");
        break;
      case "auto":
        this.setupAutoMode();
        break;
    }

    this.currentMode = mode;
    localStorage.setItem(MODE_STORAGE_KEY, mode);

    this.updateMetaThemeColor();
    
    if (!shouldSkip) {
      this.events.emit("modechange", { mode: mode });
    }

    setTimeout(() => {
      this.onBroadcast?.();
    }, 100);
  }

  private setupAutoMode(): void {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      this.updateMetaThemeColor();
      this.events.emit("themechange", null);
      this.onBroadcast?.();
    };

    prefersDark.addEventListener("change", this.mediaQueryListener);
    this.mediaQuery = prefersDark;

    if (prefersDark.matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  private clearMediaQueryListener(): void {
    if (this.mediaQuery && this.mediaQueryListener) {
      this.mediaQuery.removeEventListener("change", this.mediaQueryListener);
      this.mediaQuery = null;
      this.mediaQueryListener = null;
    }
  }

  private updateMetaThemeColor(): void {
    requestAnimationFrame(() => {
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
    });
  }

  getCssVariables(): string {
    const styles = getComputedStyle(document.documentElement);
    const variables: string[] = [];

    for (let i = 0; i < styles.length; i++) {
      const name = styles[i];
      if (name.startsWith("--")) {
        const value = styles.getPropertyValue(name).trim();
        if (value) {
          variables.push(`${name}: ${value};`);
        }
      }
    }

    return `:root {\n  ${variables.join("\n  ")}\n}`;
  }

  loadStored(): ThemeMode {
    const stored = localStorage.getItem(MODE_STORAGE_KEY) as ThemeMode | null;
    if (stored && ["light", "dark", "auto"].includes(stored)) {
      return stored;
    }
    return "auto";
  }

  initialize(): void {
    const stored = this.loadStored();
    this.setMode(stored);
  }

  reset(): void {
    this.clearMediaQueryListener();
    document.documentElement.classList.remove("dark");
    this.currentMode = "auto";
    localStorage.removeItem(MODE_STORAGE_KEY);
  }
}
