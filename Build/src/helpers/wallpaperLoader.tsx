import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from "react";
import { loadThemeJsonFromSourcePath } from "./themeMetadata";

// ----------------------
// Types
// ----------------------
export interface WallpaperMetadata {
  name: string;
  author: string;
  description: string;
  version: string;
  componentFile: string;
}

interface WallpaperContextProps {
  wallpapers: WallpaperMetadata[];
  currentWallpaper: WallpaperMetadata | null;
  currentWallpaperComponent: React.ComponentType<WallpaperProps> | null;
  isLoading: boolean;
  error: string | null;
  setWallpaper: (wallpaperName: string) => Promise<void>;
}

const WallpaperContext = createContext<WallpaperContextProps>({
  wallpapers: [],
  currentWallpaper: null,
  currentWallpaperComponent: null,
  isLoading: false,
  error: null,
  setWallpaper: async () => {},
});

interface WallpaperLoaderProps {
  defaultWallpaper: string;
  children: React.ReactNode;
  onWallpaperChange?: (wallpaper: WallpaperMetadata) => void;
}

// ----------------------
// Global wallpapers storage for console access
// ----------------------
let globalWallpapers: WallpaperMetadata[] = [];

// ----------------------
// Import wallpaper components
// ----------------------
const wallpaperComponentFiles = import.meta.glob(
  "../themes/Wallpapers/**/*.wallpaper.tsx",
  { eager: false },
);

// ----------------------
// WallpaperLoader Component
// ----------------------
export const WallpaperLoader: React.FC<WallpaperLoaderProps> = ({
  defaultWallpaper,
  children,
  onWallpaperChange,
}) => {
  const [wallpapers, setWallpapers] = useState<WallpaperMetadata[]>([]);
  const [currentWallpaper, setCurrentWallpaper] =
    useState<WallpaperMetadata | null>(null);
  const [currentWallpaperComponent, setCurrentWallpaperComponent] =
    useState<React.ComponentType<WallpaperProps> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ----------------------
  // Load wallpapers on mount
  // ----------------------
  useEffect(() => {
    const loadWallpapers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const loadedWallpapers: WallpaperMetadata[] = [];

        // Load wallpapers from JSON metadata
        for (const path of Object.keys(wallpaperComponentFiles)) {
          try {
            const themeJson = await loadThemeJsonFromSourcePath(path);
            const wallpaperMeta = themeJson?.wallpaper;

            if (!wallpaperMeta) {
              console.warn(
                `Wallpaper file ${path}: No wallpaper metadata in theme.json`,
              );
              continue;
            }

            const metadata: WallpaperMetadata = {
              name:
                wallpaperMeta.label ||
                wallpaperMeta.name ||
                "Unnamed Wallpaper",
              author: wallpaperMeta.author || "Unknown",
              description: wallpaperMeta.description || "",
              version: wallpaperMeta.version || "1.0.0",
              componentFile:
                wallpaperMeta.componentFile || path.split("/").pop() || "",
            };

            // Verify component file exists
            const componentExists = Object.keys(wallpaperComponentFiles).some(
              (componentPath) => componentPath.endsWith(metadata.componentFile),
            );

            if (componentExists) {
              loadedWallpapers.push(metadata);
            } else {
              console.warn(
                `Wallpaper "${metadata.name}": Component file "${metadata.componentFile}" not found`,
              );
            }
          } catch (err) {
            console.warn(`Failed to load wallpaper metadata for ${path}`, err);
          }
        }

        if (loadedWallpapers.length === 0) {
          throw new Error("No valid wallpapers found");
        }

        setWallpapers(loadedWallpapers);
        globalWallpapers = loadedWallpapers; // Update global variable for console access

        // Load initial wallpaper
        const storedWallpaperName =
          localStorage.getItem("selected-wallpaper") || defaultWallpaper;

        if (storedWallpaperName === "None") {
          // Special case for "None" - no wallpaper
          setCurrentWallpaper(null);
          setCurrentWallpaperComponent(null);
          setError(null);
        } else {
          const initialWallpaper =
            loadedWallpapers.find(
              (wallpaper) => wallpaper.name === storedWallpaperName,
            ) ||
            loadedWallpapers.find(
              (wallpaper) => wallpaper.name === defaultWallpaper,
            ) ||
            loadedWallpapers[0]; // Fallback to first available

          if (initialWallpaper) {
            await applyWallpaper(initialWallpaper);
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load wallpapers";
        setError(errorMessage);
        console.error("Wallpaper loading error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadWallpapers();
  }, [defaultWallpaper]);

  // ----------------------
  // Apply wallpaper: dynamically import and render component
  // ----------------------
  const applyWallpaper = useCallback(
    async (wallpaper: WallpaperMetadata): Promise<void> => {
      try {
        // Find the matching component file
        const componentPath = Object.keys(wallpaperComponentFiles).find(
          (path) => path.endsWith(wallpaper.componentFile),
        );

        if (!componentPath) {
          throw new Error(
            `Component file not found: ${wallpaper.componentFile}`,
          );
        }

        // Load the component module
        const componentModule = await wallpaperComponentFiles[componentPath]();
        const WallpaperComponent = (componentModule as any).default;

        if (!WallpaperComponent || typeof WallpaperComponent !== "function") {
          throw new Error(`Invalid component for ${componentPath}`);
        }

        // Update state
        setCurrentWallpaper(wallpaper);
        setCurrentWallpaperComponent(() => WallpaperComponent);
        localStorage.setItem("selected-wallpaper", wallpaper.name);

        // Call optional callback
        onWallpaperChange?.(wallpaper);

        setError(null);

        console.log(`Successfully applied wallpaper: ${wallpaper.name}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to apply wallpaper";
        setError(errorMessage);
        console.error("Wallpaper application error:", err);
        throw err;
      }
    },
    [onWallpaperChange],
  );

  // ----------------------
  // Set wallpaper by name
  // ----------------------
  const setWallpaper = useCallback(
    async (wallpaperName: string): Promise<void> => {
      if (wallpaperName === "None") {
        // Special case for "None" - disable wallpaper
        setCurrentWallpaper(null);
        setCurrentWallpaperComponent(null);
        localStorage.setItem("selected-wallpaper", "None");
        setError(null);
        return;
      }

      const wallpaper = wallpapers.find((w) => w.name === wallpaperName);
      if (!wallpaper) {
        throw new Error(`Wallpaper "${wallpaperName}" not found`);
      }

      await applyWallpaper(wallpaper);
    },
    [wallpapers, applyWallpaper],
  );

  const value: WallpaperContextProps = {
    wallpapers,
    currentWallpaper,
    currentWallpaperComponent,
    isLoading,
    error,
    setWallpaper,
  };

  // ----------------------
  // Expose wallpapers globally for console access
  // ----------------------
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).wallpaperLoader = {
        getAllWallpapers: () => globalWallpapers,
        getCurrentWallpaper: () => currentWallpaper,
        setWallpaper: setWallpaper,
      };
    }
  }, [wallpapers, currentWallpaper, setWallpaper]);

  return (
    <WallpaperContext.Provider value={value}>
      {children}
    </WallpaperContext.Provider>
  );
};

// ----------------------
// Custom Hook
// ----------------------
export const useWallpaperLoader = () => {
  const context = useContext(WallpaperContext);
  if (!context) {
    throw new Error(
      "useWallpaperLoader must be used within a WallpaperProvider",
    );
  }
  return context;
};
