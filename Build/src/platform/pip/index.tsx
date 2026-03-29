import { createRoot } from "react-dom/client";
import { getCurrentThemeCSS } from "../../ui/theming";

let pipWindow: Window | null = null;

export function copyAllStyles(pipWindow: Window) {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const newLink = pipWindow.document.createElement("link");
    newLink.rel = "stylesheet";
    newLink.href = (link as HTMLLinkElement).href;
    newLink.type = "text/css";
    pipWindow.document.head.appendChild(newLink);
  });

  document.querySelectorAll("style").forEach((style) => {
    const newStyle = pipWindow.document.createElement("style");
    newStyle.textContent = style.textContent;

    Array.from(style.attributes).forEach((attr) => {
      newStyle.setAttribute(attr.name, attr.value);
    });

    pipWindow.document.head.appendChild(newStyle);
  });

  let copiedRulesCount = 0;
  try {
    [...document.styleSheets].forEach((styleSheet) => {
      try {
        const cssRules = [...styleSheet.cssRules]
          .map((rule) => rule.cssText)
          .join("");
        if (cssRules) {
          const style = pipWindow.document.createElement("style");
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
          copiedRulesCount += styleSheet.cssRules.length;
        }
      } catch (e) {
        console.warn("Could not access stylesheet:", styleSheet.href, e);
      }
    });
  } catch (e) {
    console.warn("Could not copy some stylesheets:", e);
  }

  console.log(`Copied ${copiedRulesCount} CSS rules to PiP window`);
}

export const isMiniplayerSupported = (): boolean => {
  return (
    "documentPictureInPicture" in window && !!window.documentPictureInPicture
  );
};

export interface MiniplayerControls {
  togglePlayPause: () => void;
  next: () => void;
  previous: () => void;
  playerState: {
    currentSong: any;
    isPlaying: boolean;
  };
}

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options: {
        width: number;
        height: number;
      }) => Promise<Window & { close: () => void }>;
    };
  }
}

export async function toggleMiniplayer(
  controls: MiniplayerControls,
  MiniplayerContent: React.ComponentType<{ controls: MiniplayerControls }>,
) {
  if (!controls.playerState.currentSong) {
    console.error("No song is currently playing");
    return;
  }

  try {
    if (pipWindow) {
      pipWindow.close();
      pipWindow = null;
      return;
    }

    if (
      !("documentPictureInPicture" in window) ||
      !window.documentPictureInPicture
    ) {
      console.error("Document Picture-in-Picture not supported");
      return;
    }

    const newPipWindow = await window.documentPictureInPicture.requestWindow({
      width: 400,
      height: 70,
    });
    pipWindow = newPipWindow;

    if (document.documentElement.classList.contains("dark")) {
      newPipWindow.document.documentElement.classList.add("dark");
    }

    copyAllStyles(newPipWindow);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const themeCSS = getCurrentThemeCSS();
    if (themeCSS && themeCSS.trim() !== ":root {\n  \n}") {
      const themeStyle = newPipWindow.document.createElement("style");
      themeStyle.textContent = themeCSS;
      themeStyle.setAttribute("data-theme-variables", "true");
      newPipWindow.document.head.appendChild(themeStyle);
    } else {
      applyFallbackThemeVariables(newPipWindow);
    }

    newPipWindow.document.body.style.margin = "0";
    newPipWindow.document.body.style.padding = "0";
    newPipWindow.document.body.style.overflow = "hidden";

    const rootElement = createRoot(newPipWindow.document.body);
    rootElement.render(<MiniplayerContent controls={controls} />);

    newPipWindow.addEventListener("pagehide", () => {
      rootElement.unmount();
      pipThemeChannel.close();
      pipWindow = null;
    });

    const pipThemeChannel = new BroadcastChannel("theme-updates");

    pipThemeChannel.onmessage = (event) => {
      if (event.data.type === "theme-css") {
        if (event.data.darkMode) {
          newPipWindow.document.documentElement.classList.add("dark");
        } else {
          newPipWindow.document.documentElement.classList.remove("dark");
        }

        const existingThemeStyles = newPipWindow.document.querySelectorAll(
          'style[data-theme-variables], style[data-fallback-theme-variables]',
        );
        existingThemeStyles.forEach((style) => style.remove());

        const styleElement = newPipWindow.document.createElement("style");
        styleElement.textContent = event.data.css;
        styleElement.setAttribute("data-theme-variables", "true");
        if (event.data.fallback) {
          styleElement.setAttribute("data-fallback-theme-variables", "true");
        }
        newPipWindow.document.head.appendChild(styleElement);
        newPipWindow.document.body.offsetHeight;
      }
    };
  } catch (err) {
    console.error("PiP failed:", err);
    pipWindow = null;
  }
}

function applyFallbackThemeVariables(pipWindow: Window) {
  const rootStyle = getComputedStyle(document.documentElement);
  const fallbackVariables: string[] = [];
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

  themeVars.forEach((varName) => {
    const value = rootStyle.getPropertyValue(varName).trim();
    if (value) {
      fallbackVariables.push(`${varName}: ${value};`);
    }
  });

  if (fallbackVariables.length > 0) {
    const fallbackStyle = pipWindow.document.createElement("style");
    fallbackStyle.textContent = `:root {\n  ${fallbackVariables.join("\n  ")}\n}`;
    fallbackStyle.setAttribute("data-fallback-theme-variables", "true");
    pipWindow.document.head.appendChild(fallbackStyle);
  }
}
