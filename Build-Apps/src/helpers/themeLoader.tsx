import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { broadcastThemeCSS } from "../components/Miniplayer";

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
// Global themes storage for console access
// ----------------------
let globalThemes: ThemeMetadata[] = [];

// ----------------------
// Import theme JSON, CSS, and images
// ----------------------
const themeJsonFiles = import.meta.glob('../themes/**/*.theme.json', { eager: true });
const themeCssFiles = import.meta.glob('../themes/**/*.theme.css', { query: '?raw', import: 'default', eager: false });
const themeImageFiles = import.meta.glob('../themes/**/*.{jpg,jpeg,png,gif,webp,svg}', { eager: true });

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
        globalThemes = loadedThemes; // Update global variable for console access

        // Load initial theme
        const storedThemeName = localStorage.getItem('selected-color-theme') || defaultTheme;
        const initialTheme = loadedThemes.find(theme => theme.name === storedThemeName)
          || loadedThemes.find(theme => theme.name === defaultTheme)
          || loadedThemes[0]; // Fallback to first available

        if (initialTheme) {
          await applyTheme(initialTheme);
          // Broadcast theme immediately after loading
          setTimeout(() => {
            broadcastThemeCSS();
          }, 300);
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

      // Load the CSS module to get the CSS content
      const cssModule = await (themeCssFiles[cssPath] as () => Promise<string>)();

      // Verify the content is a string
      if (!cssModule || typeof cssModule !== 'string') {
        throw new Error(`Invalid CSS content for ${cssPath}: ${typeof cssModule}`);
      }

      // Process CSS to replace image URLs with Vite asset URLs
      let processedCss = cssModule;
      const themeDir = cssPath.replace(/\/[^\/]+$/, ''); // Get directory containing the CSS file
      
      // Replace relative image URLs with imported asset URLs
      processedCss = processedCss.replace(/url\(['"]?([^'"\)]+)['"]?\)/g, (match, url) => {
        // Skip data URIs and absolute URLs
        if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/')) {
          return match;
        }
        
        // Find the corresponding imported image
        const imagePath = `${themeDir}/${url}`;
        const imageModule = themeImageFiles[imagePath];
        
        if (imageModule) {
          return `url('${(imageModule as any).default}')`;
        }
        
        // If not found, return original (might be handled by other means)
        console.warn(`Image not found in imports: ${imagePath}`);
        return match;
      });

      console.log('Theme loaded');

      // Create a style element and inject the CSS
      const styleElement = document.createElement('style');
      styleElement.id = `theme-stylesheet-${theme.name}`;
      styleElement.textContent = processedCss;

      // Use requestAnimationFrame to sync with browser rendering
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));

      // Append to head
      document.head.appendChild(styleElement);
      
      // Wait for styles to be applied
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          // Force a reflow to ensure styles are applied
          document.documentElement.offsetHeight;
          setTimeout(resolve, 100); // Additional delay for CSS variables to propagate
        });
      });

      // Update state after successful injection
      setCurrentTheme(theme);
      localStorage.setItem('selected-color-theme', theme.name);

      // Call optional callback
      onThemeChange?.(theme);

      setError(null);

      console.log(`Successfully applied theme: ${theme.name}`);

      // Update meta theme color
      const themeColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--themecolor2')
        .trim();

      let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
      }
      meta.content = themeColor;

      // Wait a bit more and then broadcast theme CSS updates
      setTimeout(() => {
        broadcastThemeCSS();
      }, 200); // Additional delay to ensure all CSS is fully applied
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply theme';
      setError(errorMessage);
      console.error('Theme application error:', err);
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

    await applyTheme(theme);
  }, [themes, applyTheme]);

  const value: ThemeContextProps = {
    themes,
    currentTheme,
    isLoading,
    error,
    setTheme
  };

  // ----------------------
  // Expose themes globally for console access
  // ----------------------
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).themeLoader = {
        getAllThemes: () => globalThemes,
        getCurrentTheme: () => currentTheme,
        setTheme: setTheme
      };
    }
  }, [themes, currentTheme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
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