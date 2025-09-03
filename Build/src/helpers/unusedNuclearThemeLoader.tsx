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
  setTheme: async () => {},
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
const themeCssFiles = import.meta.glob('../themes/**/*.theme.css', { as: 'raw' });

// ----------------------
// NUCLEAR OPTION (delete everything!!!) - Reset everything every time
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
            const cssExists = Object.keys(themeCssFiles).some(cssPath => 
              cssPath.endsWith(validatedTheme.cssFile)
            );
            
            if (cssExists) {
              loadedThemes.push(validatedTheme);
            }
          }
        }

        if (loadedThemes.length === 0) {
          throw new Error('No valid themes found');
        }

        setThemes(loadedThemes);

        const storedThemeName = localStorage.getItem('selected-color-theme') || defaultTheme;
        const initialTheme = loadedThemes.find(theme => theme.name === storedThemeName) 
                           || loadedThemes.find(theme => theme.name === defaultTheme)
                           || loadedThemes[0];

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
  // NUCLEAR APPROACH: Completely reset CSS every single time
  // ----------------------
  const applyTheme = useCallback(async (theme: ThemeMetadata): Promise<void> => {
    const themeId = Date.now() + Math.random();
    console.log(`[${themeId}] Applying theme ${theme.name}`);

    try {
      // Get CSS content
      const cssPath = Object.keys(themeCssFiles).find(path =>
        path.endsWith(theme.cssFile)
      );

      if (!cssPath) {
        throw new Error(`CSS file not found: ${theme.cssFile}`);
      }

      console.log(`[${themeId}] Loading CSS from: ${cssPath}`);
      const cssContent = await (themeCssFiles[cssPath] as () => Promise<string>)();
      console.log(`[${themeId}] CSS loaded: ${cssContent.length} chars`);

      // Remove EVERYTHING that could be theme-related
      console.log(`[${themeId}] Cleanup starting...`);
      
      // Remove all style tags with theme data
      document.querySelectorAll('style[data-theme-name], style[data-theme], style[id*="theme"]').forEach((el, i) => {
        el.remove();
      });

      // Remove all link tags with theme data
      document.querySelectorAll('link[data-theme], link[id*="theme"], link[href*="theme"]').forEach((el, i) => {
        el.remove();
      });

      // Force DOM to update
      await new Promise(resolve => setTimeout(resolve, 100));
      console.info(`[${themeId}] Cleanup complete`);

      // Force browser to recalculate styles
      console.log(`[${themeId}] Forcing style recalculation...`);
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';
      
      // Inject new CSS with unique identifiers
      const uniqueStyleId = `nuclear-theme-${theme.name.replace(/\W/g, '')}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[${themeId}] Creating new style: ${uniqueStyleId}`);
      
      const styleElement = document.createElement('style');
      styleElement.id = uniqueStyleId;
      styleElement.setAttribute('data-theme-name', theme.name);
      styleElement.setAttribute('data-nuclear-id', themeId.toString());
      styleElement.setAttribute('data-applied-at', new Date().toISOString());
      
      // Add CSS with some specificity boosting
      const boostedCSS = cssContent.replace(/([^{}]+){/g, (match, selector) => {
        // Add body prefix to boost specificity without changing the CSS too much
        return selector.includes('body') ? match : `body ${match}`;
      });
      
      styleElement.textContent = boostedCSS;
      
      console.log(`📋 [${themeId}] CSS preview: ${boostedCSS.substring(0, 100)}...`);
      
      // Inject into DOM
      document.head.appendChild(styleElement);
      
      // Force another reflow and verify
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const verifyElement = document.getElementById(uniqueStyleId);
      if (!verifyElement) {
        throw new Error(`Style element ${uniqueStyleId} not found after insertion`);
      }
      
      console.log(`[${themeId}] Style verified in DOM with ${verifyElement.textContent?.length} chars`);

      // Force final style recalculation
      const computedStyle = window.getComputedStyle(document.body);
      console.log(`[${themeId}] Final body styles - color: ${computedStyle.color}, bg: ${computedStyle.backgroundColor}`);

      // Update state
      setCurrentTheme(theme);
      localStorage.setItem('selected-color-theme', theme.name);
      onThemeChange?.(theme);
      setError(null);

      console.log(`[${themeId}] Theme application complete: ${theme.name}`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply theme';
      setError(errorMessage);
      console.error(`[${themeId}] Theme error:`, err);
      throw err;
    }
  }, [onThemeChange]);

  const setTheme = useCallback(async (themeName: string): Promise<void> => {
    console.log(`setTheme called: ${themeName} (current: ${currentTheme?.name})`);
    
    const theme = themes.find(t => t.name === themeName);
    if (!theme) {
      throw new Error(`Theme "${themeName}" not found`);
    }

    // ALWAYS apply, no matter what
    await applyTheme(theme);
  }, [themes, currentTheme, applyTheme]);

  const value: ThemeContextProps = { 
    themes, 
    currentTheme, 
    isLoading, 
    error, 
    setTheme 
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useThemeLoader = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeLoader must be used within a ThemeProvider');
  }
  return context;
};