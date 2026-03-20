import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { ThemeEngine } from "./ThemeEngine";
import { setThemeEngine } from "./index";
import type { ThemeMode } from "./events";
import type {
  Palette,
  IconSet,
  Wallpaper,
  ThemeConfig,
  ThemingState,
} from "./types";

interface ThemingContextValue {
  state: ThemingState;
  setPalette: (name: string) => Promise<void>;
  setIconSet: (id: string) => Promise<void>;
  setWallpaper: (name: string) => Promise<void>;
  setMode: (mode: ThemeMode) => void;
  resolveIcon: (name: string) => Promise<unknown>;
  getWallpaperComponent: () => unknown;
  palettes: Palette[];
  iconSets: IconSet[];
  wallpapers: Wallpaper[];
}

const ThemingContext = createContext<ThemingContextValue | null>(null);

interface ThemeProviderProps {
  config?: Partial<ThemeConfig>;
  onThemeChange?: (data: { type: string; value: string }) => void;
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  config,
  onThemeChange,
  children,
}) => {
  const engine = useMemo(() => new ThemeEngine(config), [config]);
  const [state, setState] = useState<ThemingState>({
    palette: null,
    iconSet: null,
    wallpaper: null,
    mode: "auto",
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const handlePaletteChange = () => {
      const palette = engine.getCurrentPalette();
      if (palette) onThemeChange?.({ type: "palette", value: palette.name });
      setState(engine.getState());
    };
    const handleIconChange = () => {
      const iconSet = engine.getCurrentIconSet();
      if (iconSet) onThemeChange?.({ type: "icon", value: iconSet.id });
      setState(engine.getState());
    };
    const handleWallpaperChange = () => {
      const wallpaper = engine.getCurrentWallpaper();
      if (wallpaper)
        onThemeChange?.({ type: "wallpaper", value: wallpaper.name });
      setState(engine.getState());
    };
    const handleModeChange = () => {
      const mode = engine.getCurrentMode();
      onThemeChange?.({ type: "mode", value: mode });
      setState(engine.getState());
    };
    const handleThemeChange = () => {
      setState(engine.getState());
    };

    engine.on("palettechange", handlePaletteChange);
    engine.on("iconchange", handleIconChange);
    engine.on("wallpaperchange", handleWallpaperChange);
    engine.on("modechange", handleModeChange);
    engine.on("themechange", handleThemeChange);

    engine.initialize().then(() => {
      engine.exposeGlobally();
      setThemeEngine(engine);
      setState(engine.getState());
    });

    return () => {
      engine.off("palettechange", handlePaletteChange);
      engine.off("iconchange", handleIconChange);
      engine.off("wallpaperchange", handleWallpaperChange);
      engine.off("modechange", handleModeChange);
      engine.off("themechange", handleThemeChange);
    };
  }, [engine, onThemeChange]);

  const setPalette = useCallback(
    async (name: string) => {
      await engine.setPalette(name);
    },
    [engine],
  );

  const setIconSet = useCallback(
    async (id: string) => {
      await engine.setIconSet(id);
    },
    [engine],
  );

  const setWallpaper = useCallback(
    async (name: string) => {
      await engine.setWallpaper(name);
    },
    [engine],
  );

  const setMode = useCallback(
    (mode: ThemeMode) => {
      engine.setMode(mode);
    },
    [engine],
  );

  const resolveIcon = useCallback(
    async (name: string) => {
      return engine.resolveIcon(name);
    },
    [engine],
  );

  const getWallpaperComponent = useCallback(() => {
    return engine.getWallpaperComponent();
  }, [engine]);

  const value: ThemingContextValue = {
    state,
    setPalette,
    setIconSet,
    setWallpaper,
    setMode,
    resolveIcon,
    getWallpaperComponent,
    palettes: engine.getPalettes(),
    iconSets: engine.getIconSets(),
    wallpapers: engine.getWallpapers(),
  };

  return (
    <ThemingContext.Provider value={value}>{children}</ThemingContext.Provider>
  );
};

export const useThemingContext = (): ThemingContextValue => {
  const context = useContext(ThemingContext);
  if (!context) {
    throw new Error("useThemingContext must be used within ThemeProvider");
  }
  return context;
};
