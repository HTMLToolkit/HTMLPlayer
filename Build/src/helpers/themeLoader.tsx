import React, { useState, useEffect, createContext, useContext } from 'react';

// Define a type for the theme metadata
export interface ThemeMetadata {
  name: string;
  author: string;
  description: string;
  version: string;
  cssFile: string;
}

interface ThemeContextProps {
  themes: ThemeMetadata[];
  currentTheme: ThemeMetadata | undefined;
  setTheme: (themeName: string) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  themes: [],
  currentTheme: undefined,
  setTheme: () => {},
});

interface ThemeLoaderProps {
  themeDir: string; // Directory containing theme JSON files (e.g., "/themes")
  defaultTheme: string; // Name of the default theme (e.g., "blue")
  children: React.ReactNode;
}

// Hardcode the glob string to import files
const themeFiles = import.meta.glob<ThemeMetadata>('../themes/**/*.theme.json', { eager: true });

export const ThemeLoader: React.FC<ThemeLoaderProps> = ({ themeDir, defaultTheme, children }) => {
  const [themes, setThemes] = useState<ThemeMetadata[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ThemeMetadata | undefined>(undefined);

  useEffect(() => {
    // Function to load theme metadata from JSON files
    const loadThemes = async () => {
      try {
        const loadedThemes: ThemeMetadata[] = [];

        for (const path in themeFiles) {
          if (Object.prototype.hasOwnProperty.call(themeFiles, path)) {
            const module = themeFiles[path];

            // Check if it has a default export and is an object
            if (module && typeof module === 'object' && 'name' in module) {
              loadedThemes.push(module as ThemeMetadata);
            } else {
              console.warn(`Theme file ${path} did not have a default export or was incorrectly formatted`);
            }

          }
        }

        setThemes(loadedThemes);

        // Set the initial theme (either from localStorage or the default)
        const storedThemeName = localStorage.getItem('selected-color-theme') || defaultTheme;
        const initialTheme = loadedThemes.find((theme) => theme.name === storedThemeName);
        setCurrentTheme(initialTheme);

        // Dynamically load the CSS file for the initial theme
        if (initialTheme) {
          loadThemeCss(themeDir, initialTheme.cssFile);
        }
      } catch (error) {
        console.error('Error loading themes:', error);
      }
    };

    loadThemes();
  }, [themeDir, defaultTheme]);

  useEffect(() => {
    // Store the current theme name in localStorage
    if (currentTheme) {
      localStorage.setItem('selected-color-theme', currentTheme.name);
    }
  }, [currentTheme]);

  // Function to switch to a specific theme
  const setTheme = (themeName: string) => {
    const newTheme = themes.find((theme) => theme.name === themeName);
    if (newTheme) {
      setCurrentTheme(newTheme);
      loadThemeCss(themeDir, newTheme.cssFile); // Dynamically load CSS
    } else {
      console.error(`Theme "${themeName}" not found.`);
    }
  };

  const value: ThemeContextProps = {
    themes,
    currentTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Helper function to dynamically load theme CSS files
const loadThemeCss = (themeDir: string, cssFile: string) => {
  const themeStylesheetId = 'theme-stylesheet';
  let themeStylesheet = document.getElementById(themeStylesheetId) as HTMLLinkElement;

  if (!themeStylesheet) {
    themeStylesheet = document.createElement('link');
    themeStylesheet.rel = 'stylesheet';
    themeStylesheet.id = themeStylesheetId;
    document.head.appendChild(themeStylesheet);
  }

  themeStylesheet.href = `${themeDir}/${cssFile}`;
};

// Custom hook to use the theme context
export const useThemeLoader = () => {
  return useContext(ThemeContext);
};