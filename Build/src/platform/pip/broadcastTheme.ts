import { getCurrentThemeCSS } from "../../ui/theming";

const themeChannel = new BroadcastChannel("theme-updates");

const themeVars = [
  "--themecolor", "--themecolor2", "--themecolor3", "--themecolor4",
  "--themegradient", "--themecolor-transparent", "--themecolor2-transparent",
  "--themecolor3-transparent", "--foreground", "--foreground-strong",
  "--foreground-stronger", "--foreground-muted", "--foreground-subtle",
  "--background", "--surface", "--surface-foreground",
  "--surface-transparent-05", "--surface-transparent-1", "--surface-transparent-2",
  "--primary", "--primary-foreground", "--primary-transparent",
  "--primary-border", "--primary-border-strong", "--secondary",
  "--secondary-foreground", "--menu-background", "--spacing-1",
  "--spacing-2", "--spacing-3", "--spacing-4", "--radius", "--radius-lg",
];

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

    themeVars.forEach((varName) => {
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

export function listenForThemeUpdates() {
  themeChannel.onmessage = () => {};
}
