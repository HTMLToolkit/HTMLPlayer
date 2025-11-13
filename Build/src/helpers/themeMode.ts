import { broadcastThemeCSS } from "../components/Miniplayer";

export type ThemeMode = "light" | "dark" | "auto";

export function updateMetaThemeColor(): void {
  // Delay to allow CSS changes to propagate
  requestAnimationFrame(() => {
    const themeColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--themecolor2")
      .trim();

    let meta = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColor;

    // Broadcast theme changes for PiP windows
    setTimeout(() => {
      broadcastThemeCSS();
    }, 100);
  });
}

/**
 * Switch to dark mode by adding the "dark" class to document.body.
 */
export function switchToDarkMode(): void {
  // Clear any auto mode listener if present.
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
    currentMediaQuery = null;
  }
  document.documentElement.classList.add("dark");
  updateMetaThemeColor();
}

/**
 * Switch to light mode by removing the "dark" class from document.body.
 */
export function switchToLightMode(): void {
  // Clear any auto mode listener if present.
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
    currentMediaQuery = null;
  }
  document.documentElement.classList.remove("dark");
  updateMetaThemeColor();
}

function updateTheme(darkPreferred: boolean): void {
  if (darkPreferred) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  updateMetaThemeColor();
}

let currentMediaQuery: MediaQueryList | null = null;

/**
 * Switch to auto mode. This function immediately applies the user's color scheme preference
 * and listens for system preference changes to update the theme automatically.
 * It uses the onchange property instead of addEventListener to avoid TypeScript issues.
 */
export function switchToAutoMode(): void {
  if (currentMediaQuery) {
    currentMediaQuery.onchange = null;
  }
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.onchange = (e: MediaQueryListEvent) => {
    updateTheme(e.matches);
  };
  currentMediaQuery = mediaQuery;
  updateTheme(mediaQuery.matches);
}

/**
 * Returns the current theme mode:
 * - "auto" if auto mode is enabled,
 * - "dark" if the document element has the "dark" class,
 * - "light" otherwise.
 */
export function getCurrentThemeMode(): ThemeMode {
  if (currentMediaQuery) {
    return "auto";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Retrieves all CSS variables for the current theme as a string.
 */
export function getCurrentThemeCSS(): string {
  const styles = getComputedStyle(document.documentElement);
  const cssVariables: string[] = [];

  // Method 1: Use getComputedStyle iteration
  for (let i = 0; i < styles.length; i++) {
    const name = styles[i];
    if (name.startsWith("--")) {
      const value = styles.getPropertyValue(name).trim();
      if (value) {
        // Only include variables with values
        cssVariables.push(`${name}: ${value};`);
      }
    }
  }

  // Method 2: Fallback - Check specific theme variables that should exist
  const themeVariables = [
    "--themecolor",
    "--themecolor2",
    "--themecolor3",
    "--themecolor4",
    "--themegradient",
    "--themecolor1-transparent",
    "--themecolor2-transparent",
    "--themecolor3-transparent",
    "--foreground",
    "--foreground-strong",
    "--foreground-stronger",
    "--foreground-muted",
    "--foreground-subtle",
    "--background",
    "--surface",
    "--surface-foreground",
    "--surface-transparent-05",
    "--surface-transparent-1",
    "--surface-transparent-2",
    "--primary",
    "--primary-foreground",
    "--primary-transparent",
    "--primary-border",
    "--primary-border-strong",
    "--secondary",
    "--secondary-foreground",
    "--menu-background",
  ];

  const fallbackVariables: string[] = [];
  themeVariables.forEach((varName) => {
    const value = styles.getPropertyValue(varName).trim();
    if (value && !cssVariables.some((v) => v.startsWith(varName))) {
      fallbackVariables.push(`${varName}: ${value};`);
    }
  });

  // Method 3: Check all style sheets for :root rules
  const stylesheetVariables: string[] = [];
  try {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule) => {
          if (rule instanceof CSSStyleRule && rule.selectorText === ":root") {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith("--")) {
                const value = style.getPropertyValue(prop).trim();
                if (
                  value &&
                  !cssVariables.some((v) => v.startsWith(prop)) &&
                  !fallbackVariables.some((v) => v.startsWith(prop))
                ) {
                  stylesheetVariables.push(`${prop}: ${value};`);
                }
              }
            }
          }
        });
      } catch (e) {
        // Skip inaccessible stylesheets (CORS)
      }
    });
  } catch (e) {
    console.warn("Could not access stylesheets:", e);
  }

  const allVariables = [
    ...cssVariables,
    ...fallbackVariables,
    ...stylesheetVariables,
  ];

  return `:root {\n  ${allVariables.join("\n  ")}\n}`;
}

/**
 * Logs all CSS variables defined on the :root element.
 */
export function logAllCSSVariables() {
  const styles = getComputedStyle(document.documentElement);
  const cssVariables: string[] = [];

  for (let i = 0; i < styles.length; i++) {
    const name = styles[i];
    if (name.startsWith("--")) {
      const value = styles.getPropertyValue(name).trim();
      cssVariables.push(`${name}: ${value}`);
    }
  }

  console.log("All CSS Variables:", cssVariables.join("\n"));
}
