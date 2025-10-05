/**
 * Unified theme metadata loader
 * Provides a single source of truth for loading theme JSON files
 */

// Import all theme JSON files eagerly
const themeJsonFiles = import.meta.glob('../themes/**/*.theme.json', { eager: true });

// Cache for parsed theme JSON to avoid re-parsing
const themeJsonCache = new Map<string, any>();

/**
 * Load and parse a theme JSON file by path
 * @param themePath - The path to the theme JSON file (e.g., '../themes/Blue/Blue.theme.json')
 * @returns The parsed JSON object or null if not found/invalid
 */
export async function loadThemeJson(themePath: string): Promise<any> {
  // Normalize the path
  const normalizedPath = themePath.replace(/\\/g, '/');
  
  // Check cache first
  if (themeJsonCache.has(normalizedPath)) {
    return themeJsonCache.get(normalizedPath);
  }

  // Try to find the module
  const module = themeJsonFiles[normalizedPath];
  
  if (!module) {
    console.warn(`Theme JSON not found at ${normalizedPath}`);
    return null;
  }

  try {
    const json = (module as any).default || module;
    themeJsonCache.set(normalizedPath, json);
    return json;
  } catch (error) {
    console.warn(`Failed to parse theme JSON at ${normalizedPath}`, error);
    return null;
  }
}

/**
 * Load theme JSON by converting an icon/theme file path to its corresponding JSON path
 * @param sourcePath - Path to an icon or theme file (e.g., '../themes/Blue/Blue.icons.ts')
 * @returns The parsed JSON object or null if not found/invalid
 */
export async function loadThemeJsonFromSourcePath(sourcePath: string): Promise<any> {
  // Convert icons/theme path to theme.json path
  // e.g., ../themes/Blue/Blue.icons.ts -> ../themes/Blue/Blue.theme.json
  // e.g., ../themes/Blue/Blue.theme.css -> ../themes/Blue/Blue.theme.json
  const themePath = sourcePath
    .replace(/\.icons\.(ts|tsx)$/, '.theme.json')
    .replace(/\.theme\.(css|scss|sass)$/, '.theme.json');
  
  return loadThemeJson(themePath);
}

/**
 * Get all available theme JSON files
 * @returns Map of paths to parsed JSON objects
 */
export async function getAllThemeJsonFiles(): Promise<Map<string, any>> {
  const results = new Map<string, any>();
  
  for (const [path, module] of Object.entries(themeJsonFiles)) {
    try {
      const json = (module as any).default || module;
      results.set(path, json);
    } catch (error) {
      console.warn(`Failed to parse theme JSON at ${path}`, error);
    }
  }
  
  return results;
}

/**
 * Find a theme JSON file by theme name
 * @param themeName - The name of the theme to find
 * @returns The parsed JSON object or null if not found
 */
export async function findThemeJsonByName(themeName: string): Promise<{ path: string; json: any } | null> {
  for (const [path, module] of Object.entries(themeJsonFiles)) {
    try {
      const json = (module as any).default || module;
      if (json.name === themeName) {
        return { path, json };
      }
    } catch (error) {
      console.warn(`Failed to parse theme JSON at ${path}`, error);
    }
  }
  
  return null;
}

/**
 * Clear the theme JSON cache
 */
export function clearThemeJsonCache(): void {
  themeJsonCache.clear();
}
