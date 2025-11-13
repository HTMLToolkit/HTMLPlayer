/**
 * Safari/WebKit background audio helper
 * Safari requires an actual <audio> element in the DOM to play audio in the background
 * AudioContext and new Audio() don't work in background on Safari
 */

/**
 * Detect if the current browser is Safari or WebKit-based
 */
export function isSafari(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const isSafari =
    ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
  const isWebKit = ua.includes("applewebkit") && !ua.includes("chrome");

  return isSafari || isWebKit;
}

/**
 * Safari Audio Manager
 * Manages a <audio> element that stays in sync with the main audio
 * This allows background playback on Safari
 */
export class SafariAudioManager {
  private audioElement: HTMLAudioElement | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.isEnabled = isSafari();

    if (this.isEnabled) {
      this.initializeAudioElement();
    }
  }

  /**
   * Create and configure the audio element
   */
  private initializeAudioElement(): void {
    // Create audio element
    this.audioElement = document.createElement("audio");
    this.audioElement.crossOrigin = "anonymous";
    this.audioElement.preload = "auto";

    // Start muted - will be unmuted if used as primary audio element
    this.audioElement.volume = 0;
    this.audioElement.muted = true;

    // Make it invisible but present in DOM
    this.audioElement.style.position = "fixed";
    this.audioElement.style.opacity = "0";
    this.audioElement.style.pointerEvents = "none";
    this.audioElement.style.width = "1px";
    this.audioElement.style.height = "1px";
    this.audioElement.style.bottom = "0";
    this.audioElement.style.left = "0";

    // Add to DOM - required for Safari background playback
    document.body.appendChild(this.audioElement);

    console.log(
      "[Safari Audio] Initialized audio element for background playback",
    );
  }

  /**
   * Check if Safari audio manager is enabled
   */
  public isActive(): boolean {
    return this.isEnabled && this.audioElement !== null;
  }

  /**
   * Set the audio source
   */
  public setSrc(src: string): void {
    if (!this.audioElement) return;

    try {
      // Only set src if it's a valid URL (not empty, not about:blank, and not indexeddb://)
      // IndexedDB URLs are internal references that need to be resolved to blob URLs first
      if (
        src &&
        !src.includes("about:blank") &&
        !src.startsWith("indexeddb://")
      ) {
        this.audioElement.src = src;
        console.log("[Safari Audio] Set source:", src.substring(0, 50) + "...");
      } else if (src.startsWith("indexeddb://")) {
        console.log(
          "[Safari Audio] Skipping IndexedDB URL - waiting for blob URL",
        );
      }
    } catch (error) {
      console.error("[Safari Audio] Failed to set src:", error);
    }
  }

  /**
   * Play the audio
   */
  public async play(): Promise<void> {
    if (!this.audioElement) return;

    // Don't try to play if there's no valid source
    if (
      !this.audioElement.src ||
      this.audioElement.src.includes("about:blank")
    ) {
      console.warn("[Safari Audio] Cannot play - no valid source");
      return;
    }

    // Wait for the element to be ready if needed
    if (this.audioElement.readyState < 2) {
      console.log("[Safari Audio] Waiting for source to load...");
      const element = this.audioElement; // Capture for closure
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.warn("[Safari Audio] Timeout waiting for source to load");
          resolve(); // Resolve anyway to prevent hanging
        }, 2000);

        const onReady = () => {
          clearTimeout(timeout);
          element.removeEventListener("loadeddata", onReady);
          element.removeEventListener("canplay", onReady);
          element.removeEventListener("error", onError);
          resolve();
        };

        const onError = (e: Event) => {
          clearTimeout(timeout);
          element.removeEventListener("loadeddata", onReady);
          element.removeEventListener("canplay", onReady);
          element.removeEventListener("error", onError);
          console.error("[Safari Audio] Error loading source:", e);
          reject(e);
        };

        element.addEventListener("loadeddata", onReady);
        element.addEventListener("canplay", onReady);
        element.addEventListener("error", onError);
      });
    }

    try {
      await this.audioElement.play();
      console.log("[Safari Audio] Playing");
    } catch (error) {
      console.error("[Safari Audio] Failed to play:", error);
    }
  }

  /**
   * Pause the audio
   */
  public pause(): void {
    if (!this.audioElement) return;

    try {
      this.audioElement.pause();
      console.log("[Safari Audio] Paused");
    } catch (error) {
      console.error("[Safari Audio] Failed to pause:", error);
    }
  }

  /**
   * Set the volume
   */
  public setVolume(volume: number): void {
    if (!this.audioElement) return;

    try {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    } catch (error) {
      console.error("[Safari Audio] Failed to set volume:", error);
    }
  }

  /**
   * Seek to a specific time
   */
  public seek(time: number): void {
    if (!this.audioElement) return;

    try {
      this.audioElement.currentTime = time;
    } catch (error) {
      console.error("[Safari Audio] Failed to seek:", error);
    }
  }

  /**
   * Set playback rate (for tempo/pitch)
   */
  public setPlaybackRate(rate: number): void {
    if (!this.audioElement) return;

    try {
      this.audioElement.playbackRate = rate;
    } catch (error) {
      console.error("[Safari Audio] Failed to set playback rate:", error);
    }
  }

  /**
   * Get the audio element (for advanced usage)
   */
  public getElement(): HTMLAudioElement | null {
    return this.audioElement;
  }

  /**
   * Clean up the audio element
   */
  public destroy(): void {
    if (!this.audioElement) return;

    try {
      this.audioElement.pause();
      this.audioElement.src = "";
      if (this.audioElement.parentNode) {
        this.audioElement.parentNode.removeChild(this.audioElement);
      }
      this.audioElement = null;
      console.log("[Safari Audio] Destroyed");
    } catch (error) {
      console.error("[Safari Audio] Failed to destroy:", error);
    }
  }
}
