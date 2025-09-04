import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

// ----------------------
// Types
// ----------------------
export interface ThemeMetadata {
  name: string;
  author: string;
  description: string;
  version: string;
  cssFile: string;
}

interface ThemeContextProps {
  themes: ThemeMetadata[];
  currentTheme: ThemeMetadata | null;
  isLoading: boolean;
  error: string | null;
  setTheme: (themeName: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextProps>({
  themes: [],
  currentTheme: null,
  isLoading: false,
  error: null,
  setTheme: async () => { },
});

interface ThemeLoaderProps {
  defaultTheme: string;
  children: React.ReactNode;
  onThemeChange?: (theme: ThemeMetadata) => void;
}

// ----------------------
// Import theme JSON and CSS
// ----------------------
const themeJsonFiles = import.meta.glob('../themes/**/*.theme.json', { eager: true });
const themeCssFiles = import.meta.glob('../themes/**/*.theme.css');

// ----------------------
// ThemeLoader Component
// ----------------------
export const ThemeLoader: React.FC<ThemeLoaderProps> = ({
  defaultTheme,
  children,
  onThemeChange
}) => {
  const [themes, setThemes] = useState<ThemeMetadata[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ThemeMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track loaded CSS modules to avoid reloading
  const [loadedCssModules, setLoadedCssModules] = useState<Set<string>>(new Set());

  // ----------------------
  // Validate theme metadata
  // ----------------------
  const validateThemeMetadata = (meta: any, path: string): ThemeMetadata | null => {
    if (!meta || typeof meta !== 'object') {
      console.warn(`Theme file ${path}: Invalid metadata format`);
      return null;
    }

    const required = ['name', 'author', 'description', 'version', 'cssFile'];
    for (const field of required) {
      if (!meta[field] || typeof meta[field] !== 'string') {
        console.warn(`Theme file ${path}: Missing or invalid field "${field}"`);
        return null;
      }
    }

    return meta as ThemeMetadata;
  };

  // ----------------------
  // Load themes on mount
  // ----------------------
  useEffect(() => {
    const loadThemes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const loadedThemes: ThemeMetadata[] = [];

        for (const path in themeJsonFiles) {
          const module = themeJsonFiles[path] as any;
          const meta = module?.default ?? module;

          const validatedTheme = validateThemeMetadata(meta, path);
          if (validatedTheme) {
            // Verify CSS file exists
            const cssExists = Object.keys(themeCssFiles).some(cssPath =>
              cssPath.endsWith(validatedTheme.cssFile)
            );

            if (cssExists) {
              loadedThemes.push(validatedTheme);
            } else {
              console.warn(`Theme "${validatedTheme.name}": CSS file "${validatedTheme.cssFile}" not found`);
            }
          }
        }

        if (loadedThemes.length === 0) {
          throw new Error('No valid themes found');
        }

        setThemes(loadedThemes);

        // Load initial theme
        const storedThemeName = localStorage.getItem('selected-color-theme') || defaultTheme;
        const initialTheme = loadedThemes.find(theme => theme.name === storedThemeName)
          || loadedThemes.find(theme => theme.name === defaultTheme)
          || loadedThemes[0]; // Fallback to first available

        if (initialTheme) {
          await applyTheme(initialTheme);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load themes';
        setError(errorMessage);
        console.error('Theme loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemes();
  }, [defaultTheme]);

  // ----------------------
  // Apply theme: dynamically import CSS
  // ----------------------
  const applyTheme = useCallback(async (theme: ThemeMetadata): Promise<void> => {
    try {
      // Find the matching CSS file
      const cssPath = Object.keys(themeCssFiles).find(path =>
        path.endsWith(theme.cssFile)
      );

      if (!cssPath) {
        throw new Error(`CSS file not found: ${theme.cssFile}`);
      }

      // Remove ALL existing theme stylesheets (in case there are duplicates)
      const existingLinks = document.querySelectorAll('link[id^="theme-stylesheet"]');
      existingLinks.forEach(link => link.remove());

      // Load CSS module if not already loaded
      if (!loadedCssModules.has(cssPath)) {
        try {
          await (themeCssFiles[cssPath] as () => Promise<any>)();
          setLoadedCssModules(prev => new Set([...prev, cssPath]));
        } catch (moduleError) {
          console.warn(`Failed to load CSS module for ${cssPath}, trying direct link approach`);
        }
      }

      // Create new stylesheet link with unique ID
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = `theme-stylesheet-${theme.name}`;

      const publicPath = cssPath.replace('../themes', `${import.meta.env.BASE_URL}themes`);
      link.href = `${publicPath}?v=${Date.now()}&theme=${encodeURIComponent(theme.name)}`;

      // Handle load/error events
      const loadPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout loading CSS: ${cssPath}`));
        }, 5000);

        link.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        link.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`Failed to load CSS: ${cssPath}`));
        };
      });

      document.head.appendChild(link);
      await loadPromise;

      // Update state only after successful load
      setCurrentTheme(theme);
      localStorage.setItem('selected-color-theme', theme.name);

      // Call optional callback
      onThemeChange?.(theme);

      setError(null);

      console.log(`Successfully applied theme: ${theme.name}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply theme';
      setError(errorMessage);
      console.error('Theme application error:', err);
      throw err; // Re-throw for caller handling
    }
  }, [onThemeChange, loadedCssModules]);

  // ----------------------
  // Set theme by name
  // ----------------------
  const setTheme = useCallback(async (themeName: string): Promise<void> => {
    const theme = themes.find(t => t.name === themeName);
    if (!theme) {
      throw new Error(`Theme "${themeName}" not found`);
    }

    // Always apply the theme, even if it's the "current" one
    // This ensures it works even if there were loading issues before
    console.log(`Switching to theme: ${themeName}`);
    await applyTheme(theme);
  }, [themes, applyTheme]);

  const value: ThemeContextProps = {
    themes,
    currentTheme,
    isLoading,
    error,
    setTheme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// ----------------------
// Custom Hook
// ----------------------
export const useThemeLoader = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeLoader must be used within a ThemeProvider');
  }
  return context;
};