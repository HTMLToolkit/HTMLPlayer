import { getCurrentThemeCSS } from "../../ui/theming";
import { PIP_THEME_VARIABLES } from "../../constants/pip";

const themeChannel = new BroadcastChannel("theme-updates");

export function broadcastThemeCSS() {
  const themeCSS = getCurrentThemeCSS();
  const isDarkMode = document.documentElement.classList.contains("dark");

  if (themeCSS && themeCSS.trim() !== ":root {\n  \n}") {
    themeChannel.postMessage({
      type: "theme-css",
      css: themeCSS,
      darkMode: isDarkMode,
      timestamp: Date.now(),
    });
  } else {
    const rootStyle = getComputedStyle(document.documentElement);
    const fallbackVariables: string[] = [];

    PIP_THEME_VARIABLES.forEach((varName) => {
      const value = rootStyle.getPropertyValue(varName).trim();
      if (value) {
        fallbackVariables.push(`${varName}: ${value};`);
      }
    });

    if (fallbackVariables.length > 0) {
      const fallbackCSS = `:root {\n  ${fallbackVariables.join("\n  ")}\n}`;
      themeChannel.postMessage({
        type: "theme-css",
        css: fallbackCSS,
        darkMode: isDarkMode,
        timestamp: Date.now(),
        fallback: true,
      });
    }
  }
}
