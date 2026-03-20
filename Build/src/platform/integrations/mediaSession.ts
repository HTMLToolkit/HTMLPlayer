import { BaseIntegration } from "./base";
import type { Track } from "../../core/engine/types";

export class MediaSessionIntegration extends BaseIntegration {
  name = "Media Session";
  private session: MediaSession | null = null;
  private currentTrack: Track | null = null;
  private onSeekHandler: ((time: number) => void) | null = null;

  async initialize(): Promise<void> {
    if (!("mediaSession" in navigator)) {
      console.warn("MediaSession not supported");
      return;
    }

    this.session = navigator.mediaSession;

    this.session.setActionHandler("play", () => {
      document.dispatchEvent(new CustomEvent("komorebi-play"));
    });

    this.session.setActionHandler("pause", () => {
      document.dispatchEvent(new CustomEvent("komorebi-pause"));
    });

    this.session.setActionHandler("previoustrack", () => {
      document.dispatchEvent(new CustomEvent("komorebi-previous"));
    });

    this.session.setActionHandler("nexttrack", () => {
      document.dispatchEvent(new CustomEvent("komorebi-next"));
    });

    this.session.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && this.onSeekHandler) {
        this.onSeekHandler(details.seekTime);
      }
    });

    this.session.setActionHandler("stop", () => {
      document.dispatchEvent(new CustomEvent("komorebi-stop"));
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
    this.onSeekHandler = null;
  }

  isAvailable(): boolean {
    return (
      "mediaSession" in navigator &&
      this.session !== null &&
      super.isAvailable()
    );
  }

  async updateMetadata(
    track: Track | null,
    _isPlaying: boolean,
  ): Promise<void> {
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
        console.warn("Failed to load album art for MediaSession");
      }
    }

    this.session.metadata = new MediaMetadata(metadata);
  }

  setSeekHandler(handler: (time: number) => void): void {
    this.onSeekHandler = handler;
  }

  clearSeekHandler(): void {
    this.onSeekHandler = null;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}

export function createMediaSessionIntegration(): MediaSessionIntegration {
  return new MediaSessionIntegration();
}
