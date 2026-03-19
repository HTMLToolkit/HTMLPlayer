import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MiniplayerEvents } from "./events";

interface MiniplayerControls {
  togglePlayPause: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

export class MiniplayerEngine {
  private events: MiniplayerEvents;
  private window: Window | null = null;
  private root: ReturnType<typeof createRoot> | null = null;
  private themeBroadcastChannel: BroadcastChannel | null = null;
  private getCssVariables: (() => string) | null = null;

  constructor(events: MiniplayerEvents) {
    this.events = events;
  }

  setCssVariablesGetter(getter: () => string): void {
    this.getCssVariables = getter;
  }

  isSupported(): boolean {
    return "documentPictureInPicture" in window && !!window.documentPictureInPicture;
  }

  async open(_controls: MiniplayerControls, renderContent: () => ReactNode): Promise<boolean> {
    if (!this.isSupported()) {
      this.events.emit("error", { error: "Document Picture-in-Picture not supported" });
      return false;
    }

    if (this.window) {
      this.close();
    }

    try {
      const pip = window.documentPictureInPicture;
      if (!pip) {
        this.events.emit("error", { error: "Document Picture-in-Picture not available" });
        return false;
      }

      const pipWindow = await pip.requestWindow({
        width: 400,
        height: 70,
      });

      this.window = pipWindow;
      this.applyStyles(pipWindow);
      this.setupThemeSync(pipWindow);

      this.root = createRoot(pipWindow.document.body);
      this.root.render(renderContent());

      pipWindow.addEventListener("pagehide", () => {
        this.handleClose();
      });

      this.events.emit("open", { window: pipWindow });
      return true;
    } catch (error) {
      this.events.emit("error", { error: (error as Error).message });
      return false;
    }
  }

  private applyStyles(pipWindow: Window): void {
    if (document.documentElement.classList.contains("dark")) {
      pipWindow.document.documentElement.classList.add("dark");
    }

    this.copyStylesheets(pipWindow);
    this.applyThemeVariables(pipWindow);
  }

  private copyStylesheets(pipWindow: Window): void {
    document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const newLink = pipWindow.document.createElement("link");
      newLink.rel = "stylesheet";
      newLink.href = (link as HTMLLinkElement).href;
      newLink.type = "text/css";
      pipWindow.document.head.appendChild(newLink);
    });

    document.querySelectorAll("style").forEach((style) => {
      const newStyle = pipWindow.document.createElement("style");
      newStyle.textContent = style.textContent || "";
      Array.from(style.attributes).forEach((attr) => {
        newStyle.setAttribute(attr.name, attr.value);
      });
      pipWindow.document.head.appendChild(newStyle);
    });

    try {
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
          if (cssRules) {
            const style = pipWindow.document.createElement("style");
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          }
        } catch {
          // Skip inaccessible stylesheets
        }
      });
    } catch {
      // Ignore
    }
  }

  private applyThemeVariables(pipWindow: Window): void {
    const themeCSS = this.getCssVariables?.() || "";

    if (themeCSS && !themeCSS.includes(":root {\n  \n}")) {
      const themeStyle = pipWindow.document.createElement("style");
      themeStyle.textContent = themeCSS;
      themeStyle.setAttribute("data-theme-variables", "true");
      pipWindow.document.head.appendChild(themeStyle);
    } else {
      const rootStyle = getComputedStyle(document.documentElement);
      const themeVars = [
        "--themecolor", "--themecolor2", "--themecolor3", "--themecolor4",
        "--themegradient", "--themecolor-transparent", "--themecolor2-transparent",
        "--themecolor3-transparent", "--foreground", "--foreground-strong",
        "--foreground-stronger", "--foreground-muted", "--foreground-subtle",
        "--background", "--surface", "--surface-foreground",
        "--surface-transparent-05", "--surface-transparent-1", "--surface-transparent-2",
        "--primary", "--primary-foreground", "--primary-transparent",
        "--primary-border", "--primary-border-strong", "--secondary",
        "--secondary-foreground", "--menu-background",
      ];

      const variables: string[] = [];
      themeVars.forEach((varName) => {
        const value = rootStyle.getPropertyValue(varName).trim();
        if (value) {
          variables.push(`${varName}: ${value};`);
        }
      });

      if (variables.length > 0) {
        const fallbackStyle = pipWindow.document.createElement("style");
        fallbackStyle.textContent = `:root {\n  ${variables.join("\n  ")}\n}`;
        fallbackStyle.setAttribute("data-fallback-theme-variables", "true");
        pipWindow.document.head.appendChild(fallbackStyle);
      }
    }

    pipWindow.document.body.style.margin = "0";
    pipWindow.document.body.style.padding = "0";
    pipWindow.document.body.style.overflow = "hidden";
  }

  private setupThemeSync(pipWindow: Window): void {
    this.themeBroadcastChannel = new BroadcastChannel("theme-updates");

    this.themeBroadcastChannel.onmessage = (event) => {
      if (event.data.type === "theme-css") {
        if (event.data.darkMode) {
          pipWindow.document.documentElement.classList.add("dark");
        } else {
          pipWindow.document.documentElement.classList.remove("dark");
        }

        pipWindow.document.querySelectorAll('style[data-theme-variables], style[data-fallback-theme-variables]').forEach((s) => s.remove());

        const styleElement = pipWindow.document.createElement("style");
        styleElement.textContent = event.data.css;
        styleElement.setAttribute("data-theme-variables", "true");
        pipWindow.document.head.appendChild(styleElement);
      }
    };
  }

  close(): void {
    if (this.window) {
      this.window.close();
      this.handleClose();
    }
  }

  private handleClose(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (this.themeBroadcastChannel) {
      this.themeBroadcastChannel.close();
      this.themeBroadcastChannel = null;
    }

    this.window = null;
    this.events.emit("close", null);
  }

  isOpen(): boolean {
    return this.window !== null;
  }

  getWindow(): Window | null {
    return this.window;
  }
}
