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
const themeCssFiles = import.meta.glob('../themes/**/*.theme.css', { as: 'raw', eager: false });

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
  const [isThemeLoaded, setIsThemeLoaded] = useState(false); // For FOUC
  const [error, setError] = useState<string | null>(null);

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
  // Apply theme: dynamically import CSS and inject as style tag
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

      // Remove ALL existing theme stylesheets
      const existingStyles = document.querySelectorAll('style[id^="theme-stylesheet"], link[id^="theme-stylesheet"]');
      existingStyles.forEach(style => style.remove());

      console.log(`Loading CSS module for: ${cssPath}`);

      // Load the CSS module to get the CSS content
      const cssModule = await (themeCssFiles[cssPath] as () => Promise<string>)();
      console.log('CSS module structure:', cssModule);

      // Verify the content is a string
      if (!cssModule || typeof cssModule !== 'string') {
        throw new Error(`Invalid CSS content for ${cssPath}: ${typeof cssModule}`);
      }

      console.log(`CSS content loaded, length: ${cssModule.length} characters`);

      // Create a style element and inject the CSS
      const styleElement = document.createElement('style');
      styleElement.id = `theme-stylesheet-${theme.name}`;
      styleElement.textContent = cssModule;

      // Use requestAnimationFrame to sync with browser rendering
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

      // Append to head
      document.head.appendChild(styleElement);
      setIsThemeLoaded(true); // Show content after style injection

      // Update state after successful injection
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
      setIsThemeLoaded(true); // Show content even on error
      throw err; // Re-throw for caller handling
    }
  }, [onThemeChange]);

  // ----------------------
  // Set theme by name
  // ----------------------
  const setTheme = useCallback(async (themeName: string): Promise<void> => {
    const theme = themes.find(t => t.name === themeName);
    if (!theme) {
      throw new Error(`Theme "${themeName}" not found`);
    }

    console.log(`Switching to theme: ${themeName}`);
    setIsThemeLoaded(false); // Hide content during theme switch
    await applyTheme(theme);
  }, [themes, applyTheme]);

  const value: ThemeContextProps = {
    themes,
    currentTheme,
    isLoading,
    error,
    setTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      <div style={{ opacity: isThemeLoaded ? 1 : 0, transition: 'opacity 0.3s ease-in-out', minHeight: '100vh' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
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