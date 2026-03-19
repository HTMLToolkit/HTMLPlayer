import { useThemingContext } from "../ThemeProvider";
import type { ThemeMode } from "../events";
import type { Palette, IconSet, Wallpaper } from "../types";

export const useTheming = () => {
  const context = useThemingContext();

  return {
    state: context.state,
    palettes: context.palettes,
    iconSets: context.iconSets,
    wallpapers: context.wallpapers,
    currentPalette: context.state.palette,
    currentIconSet: context.state.iconSet,
    currentWallpaper: context.state.wallpaper,
    currentMode: context.state.mode,
    isLoading: context.state.isLoading,
    setPalette: context.setPalette,
    setIconSet: context.setIconSet,
    setWallpaper: context.setWallpaper,
    setMode: context.setMode,
    resolveIcon: context.resolveIcon,
    getWallpaperComponent: context.getWallpaperComponent,
  };
};

export const usePalette = () => {
  const { palettes, currentPalette, setPalette } = useTheming();
  return { palettes, currentPalette, setPalette };
};

export const useIconSet = () => {
  const { iconSets, currentIconSet, setIconSet, resolveIcon } = useTheming();
  return { iconSets, currentIconSet, setIconSet, resolveIcon };
};

export const useWallpaper = () => {
  const { wallpapers, currentWallpaper, setWallpaper, getWallpaperComponent } = useTheming();
  return { wallpapers, currentWallpaper, setWallpaper, getWallpaperComponent };
};

export const useThemeMode = () => {
  const { currentMode, setMode } = useTheming();
  return { currentMode, setMode };
};

export type { Palette, IconSet, Wallpaper, ThemeMode };
