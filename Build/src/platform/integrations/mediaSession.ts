import { BaseIntegration } from "./base";
import type { Track } from "../../core/engine/types";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("mediaSession");

export interface MediaActionHandlers {
  play(): void | Promise<void>;
  pause(): void;
  next(): void | Promise<void>;
  previous(): void | Promise<void>;
  stop(): void;
  seek(time: number): void;
}

type MediaPlaybackState = "playing" | "paused" | "none";

interface MediaSessionWithPlaybackState extends MediaSession {
  setPlaybackState?(state: MediaPlaybackState): void;
}

export class MediaSessionIntegration extends BaseIntegration {
  name = "Media Session";
  private session: MediaSession | null = null;
  private currentTrack: Track | null = null;
  private actionHandlers: MediaActionHandlers | null = null;

  async initialize(): Promise<void> {
    if (!("mediaSession" in navigator)) {
      logger.warn("MediaSession not supported");
      return;
    }

    this.session = navigator.mediaSession;

    this.session.setActionHandler("play", () => {
      void this.actionHandlers?.play();
    });

    this.session.setActionHandler("pause", () => {
      this.actionHandlers?.pause();
    });

    this.session.setActionHandler("previoustrack", () => {
      void this.actionHandlers?.previous();
    });

    this.session.setActionHandler("nexttrack", () => {
      void this.actionHandlers?.next();
    });

    this.session.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        this.actionHandlers?.seek(details.seekTime);
      }
    });

    this.session.setActionHandler("stop", () => {
      this.actionHandlers?.stop();
    });

    this.setInitialized(true);
  }

  dispose(): void {
    this.disposed = true;

    if (this.session) {
      this.session.setActionHandler("play", null);
      this.session.setActionHandler("pause", null);
      this.session.setActionHandler("previoustrack", null);
      this.session.setActionHandler("nexttrack", null);
      this.session.setActionHandler("seekto", null);
      this.session.setActionHandler("stop", null);
    }

    this.session = null;
    this.actionHandlers = null;
  }

  isAvailable(): boolean {
    return (
      "mediaSession" in navigator &&
      this.session !== null &&
      super.isAvailable()
    );
  }

  setActionHandlers(handlers: MediaActionHandlers): void {
    this.actionHandlers = handlers;
  }

  clearActionHandlers(): void {
    this.actionHandlers = null;
  }

  async updateMetadata(track: Track | null): Promise<void> {
    this.currentTrack = track;

    if (!this.session || !track) {
      if (this.session) {
        this.session.metadata = null;
      }
      return;
    }

    const metadata: MediaMetadataInit = {
      title: track.title,
      artist: track.artist,
      album: track.album,
    };

    if (track.albumArt) {
      try {
        const response = await fetch(track.albumArt);
        const blob = await response.blob();
        metadata.artwork = [
          {
            src: track.albumArt,
            sizes: "512x512",
            type: blob.type || "image/jpeg",
          },
        ];
      } catch {
        logger.warn("Failed to load album art for MediaSession");
      }
    }

    this.session.metadata = new MediaMetadata(metadata);
  }

  setPlaybackState(state: MediaPlaybackState): void {
    if (!this.session) return;
    const session = this.session as MediaSessionWithPlaybackState;
    session.setPlaybackState?.(state);
  }

  setPositionState(
    duration: number,
    position: number,
    playbackRate = 1,
  ): void {
    if (
      !this.session ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      !Number.isFinite(position)
    ) {
      return;
    }

    this.session.setPositionState({
      duration,
      position: Math.max(0, Math.min(position, duration)),
      playbackRate,
    });
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}

export function createMediaSessionIntegration(): MediaSessionIntegration {
  return new MediaSessionIntegration();
}