import { ThemeEngine } from "./ThemeEngine";

export { ThemeEngine } from "./ThemeEngine";
export { ThemeProvider, useThemingContext } from "./ThemeProvider";

export {
  useTheming,
  usePalette,
  useIconSet,
  useWallpaper,
  useThemeMode,
} from "./hooks";

export {
  ThemingEvents,
  type ThemingEvent,
  type ThemingEventMap,
  type ThemeMode,
} from "./events";
export type {
  Palette,
  IconSet,
  IconDefinition,
  IconDefinitionMap,
  IconLibraryConfig,
  IconLibraryConfigMap,
  IconLibraryMap,
  ResolvedIcon,
  Wallpaper,
  WallpaperProps,
  WallpaperComponent,
  ThemeConfig,
  ThemingState,
  ThemingSettings,
} from "./types";

let _themeEngine: ThemeEngine | null = null;

export function setThemeEngine(engine: ThemeEngine): void {
  _themeEngine = engine;
}

export function getThemeEngine(): ThemeEngine | null {
  return _themeEngine;
}

export function getCurrentThemeCSS(): string {
  if (_themeEngine) {
    return _themeEngine.getCssVariables();
  }
  return "";
}

export function switchToDarkMode(): void {
  if (_themeEngine) {
    _themeEngine.setMode("dark");
  }
}

export function switchToLightMode(): void {
  if (_themeEngine) {
    _themeEngine.setMode("light");
  }
}

export function switchToAutoMode(): void {
  if (_themeEngine) {
    _themeEngine.setMode("auto");
  }
}
