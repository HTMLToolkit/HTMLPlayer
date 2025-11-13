import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { getCurrentThemeCSS } from "../helpers/themeMode";
import styles from "./Miniplayer.module.css";
import { useAudioStore } from "../contexts/audioStore";
import { IconRegistryProvider } from "../helpers/iconLoader";

interface MiniplayerControls {
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
  playerState: {
    currentSong: PlayerState["currentSong"];
    isPlaying: boolean;
  };
}

let pipWindow: Window | null = null;

/**
 * Enhanced stylesheet copying with better CSS modules support
 */
function copyAllStyles(pipWindow: Window) {
  // Method 1: Copy all link elements
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const newLink = pipWindow.document.createElement("link");
    newLink.rel = "stylesheet";
    newLink.href = (link as HTMLLinkElement).href;
    newLink.type = "text/css";
    pipWindow.document.head.appendChild(newLink);
  });

  // Method 2: Copy all style elements (including CSS modules)
  document.querySelectorAll("style").forEach((style) => {
    const newStyle = pipWindow.document.createElement("style");
    newStyle.textContent = style.textContent;

    // Copy any attributes that might be important
    Array.from(style.attributes).forEach((attr) => {
      newStyle.setAttribute(attr.name, attr.value);
    });

    pipWindow.document.head.appendChild(newStyle);
  });

  // Method 3: Copy CSS rules from accessible stylesheets
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
        // Skip inaccessible stylesheets (CORS/cross-origin)
        console.warn("Could not access stylesheet:", styleSheet.href, e);
      }
    });
  } catch (e) {
    console.warn("Could not copy some stylesheets:", e);
  }

  console.log(`Copied ${copiedRulesCount} CSS rules to PiP window`);
}

/**
 * Check if Document Picture-in-Picture API is supported
 */
export const isMiniplayerSupported = (): boolean => {
  return (
    "documentPictureInPicture" in window && !!window.documentPictureInPicture
  );
};

/**
 * Toggle Picture-in-Picture miniplayer
 */
export const toggleMiniplayer = async (controls: MiniplayerControls) => {
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

    // Check if Document Picture-in-Picture API is supported
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

    console.log("PiP window opened successfully");

    // Copy theme class
    if (document.documentElement.classList.contains("dark")) {
      newPipWindow.document.documentElement.classList.add("dark");
    }

    // Copy all styles
    copyAllStyles(newPipWindow);

    // Wait for theme application to complete
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Re-fetch theme CSS after delay
    const themeCSS = getCurrentThemeCSS();
    if (themeCSS && themeCSS.trim() !== ":root {\n  \n}") {
      const themeStyle = newPipWindow.document.createElement("style");
      themeStyle.textContent = themeCSS;
      themeStyle.setAttribute("data-theme-variables", "true");
      newPipWindow.document.head.appendChild(themeStyle);
      console.log("Applied theme CSS variables to PiP window");
    } else {
      // Fallback: manually extract and apply theme variables
      const rootStyle = getComputedStyle(document.documentElement);
      const fallbackVariables: string[] = [];
      const themeVars = [
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
        "--spacing-1",
        "--spacing-2",
        "--spacing-3",
        "--spacing-4",
        "--radius",
        "--radius-lg",
      ];

      themeVars.forEach((varName) => {
        const value = rootStyle.getPropertyValue(varName).trim();
        if (value) {
          fallbackVariables.push(`${varName}: ${value};`);
        }
      });

      if (fallbackVariables.length > 0) {
        const fallbackStyle = newPipWindow.document.createElement("style");
        fallbackStyle.textContent = `:root {\n  ${fallbackVariables.join("\n  ")}\n}`;
        fallbackStyle.setAttribute("data-fallback-theme-variables", "true");
        newPipWindow.document.head.appendChild(fallbackStyle);
        console.log("Applied fallback theme variables");
      }
    }

    // Set up the body
    newPipWindow.document.body.style.margin = "0";
    newPipWindow.document.body.style.padding = "0";
    newPipWindow.document.body.style.overflow = "hidden";

    // Create React root and render
    const rootElement = createRoot(newPipWindow.document.body);
    rootElement.render(<MiniplayerContent />);

    // Handle window close
    newPipWindow.addEventListener("pagehide", () => {
      rootElement.unmount();
      pipThemeChannel.close(); // Clean up the BroadcastChannel
      pipWindow = null;
    });

    // Create a new BroadcastChannel specifically for the PiP window
    const pipThemeChannel = new BroadcastChannel("theme-updates");

    // Listen for theme updates in the PiP window
    pipThemeChannel.onmessage = (event) => {
      if (event.data.type === "theme-css") {
        console.log("PiP window received theme update");

        // Apply dark mode class based on broadcast data
        if (event.data.darkMode) {
          newPipWindow.document.documentElement.classList.add("dark");
        } else {
          newPipWindow.document.documentElement.classList.remove("dark");
        }

        // Remove any existing theme styles
        const existingThemeStyles = newPipWindow.document.querySelectorAll(
          'style[data-theme-variables], style[data-fallback-theme-variables], style[id^="theme-stylesheet"]',
        );
        existingThemeStyles.forEach((style) => style.remove());

        // Apply new theme CSS
        const styleElement = newPipWindow.document.createElement("style");
        styleElement.textContent = event.data.css;
        styleElement.setAttribute("data-theme-variables", "true");
        if (event.data.fallback) {
          styleElement.setAttribute("data-fallback-theme-variables", "true");
        }
        newPipWindow.document.head.appendChild(styleElement);

        // Force reflow to apply styles immediately
        newPipWindow.document.body.offsetHeight;
      }
    };
  } catch (err) {
    console.error("PiP failed:", err);
    pipWindow = null;
  }
};

interface MiniplayerProps {
  controls: MiniplayerControls;
}

const MiniplayerContent: React.FC = () => {
  const { t } = useTranslation();
  const { currentSong, isPlaying, play, pause, next, previous } =
    useAudioStore();

  const handlePlayPause = () => {
    if (isPlaying) {
      pause("pip");
    } else {
      play("pip");
    }
  };

  const handlePrevious = () => {
    previous("pip");
  };

  const handleNext = () => {
    next("pip");
  };

  if (!currentSong) {
    return <div>{t("player.noSongPlaying")}</div>;
  }

  return (
    <IconRegistryProvider defaultSetId="lucide">
      <div className={styles.miniplayer}>
        {currentSong.albumArt && (
          <img
            src={currentSong.albumArt}
            alt={t("player.albumArt")}
            className={styles.albumArt}
          />
        )}
        <div className={styles.songInfo}>
          <div className={styles.songTitle}>{currentSong.title}</div>
          <div className={styles.artist}>{currentSong.artist}</div>
        </div>
        <div className={styles.controls}>
          <Button
            id="prevBtn"
            title={t("player.previousTrack")}
            onClick={handlePrevious}
          >
            <Icon name="skipBack" size={18} decorative />
          </Button>
          <Button
            id="playBtn"
            className={styles.playBtn}
            title={isPlaying ? "Pause" : "Play"}
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Icon name="pause" size={20} decorative />
            ) : (
              <Icon name="play" size={20} decorative />
            )}
          </Button>
          <Button
            id="nextBtn"
            title={t("player.nextTrack")}
            onClick={handleNext}
          >
            <Icon name="skipForward" size={18} decorative />
          </Button>
        </div>
      </div>
    </IconRegistryProvider>
  );
};

// Standalone miniplayer component
const Miniplayer = ({ controls }: MiniplayerProps) => {
  const { t } = useTranslation();
  const { playerState, togglePlayPause, playNext, playPrevious } = controls;
  const { currentSong, isPlaying } = playerState;

  if (!currentSong) {
    return <div className={styles.miniplayer}>{t("player.noSongPlaying")}</div>;
  }

  return (
    <div className={styles.miniplayer}>
      <img
        src={currentSong.albumArt || ""}
        alt={t("player.albumArt")}
        className={styles.albumArt}
      />
      <div className={styles.songInfo}>
        <div className={styles.songTitle}>{currentSong.title}</div>
        <div className={styles.artist}>{currentSong.artist}</div>
      </div>
      <div className={styles.controls}>
        <Button onClick={playPrevious}>{t("player.previousTrack")}</Button>
        <Button onClick={togglePlayPause}>
          {isPlaying ? t("player.pause") : t("player.play")}
        </Button>
        <Button onClick={playNext}>{t("player.nextTrack")}</Button>
      </div>
    </div>
  );
};

export const spawnMiniplayer = (controls: MiniplayerControls) => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<Miniplayer controls={controls} />);

  return () => {
    root.unmount();
    document.body.removeChild(container);
  };
};

// Create a BroadcastChannel for IPC
const themeChannel = new BroadcastChannel("theme-updates");

// Send theme CSS updates
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
    // Fallback: Extract specific theme variables
    const rootStyle = getComputedStyle(document.documentElement);
    const fallbackVariables: string[] = [];
    const themeVars = [
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
      "--spacing-1",
      "--spacing-2",
      "--spacing-3",
      "--spacing-4",
      "--radius",
      "--radius-lg",
    ];

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

// Listen for theme updates in the main document
if (typeof window !== "undefined") {
  themeChannel.onmessage = (event) => {
    if (event.data.type === "theme-css") {
      // Theme update received - main window can handle if needed
    }
  };
}

// Extend the Window interface to include documentPictureInPicture
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
