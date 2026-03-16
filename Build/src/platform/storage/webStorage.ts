import { BaseStorageBackend, PlatformType } from "./base";
import type { Track } from "../../core/engine/types";

export class WebStorageBackend extends BaseStorageBackend {
  name = "Web Storage";
  platform: PlatformType = "web";
  supportsDirectoryPicker = false;
  supportsFileHandle = "showDirectoryPicker" in window;

  async loadFiles(): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "audio/*,.flac,.fla,.ogg,.mp3,.m4a,.wav,.aac,.wma";

      input.onchange = () => {
        if (input.files) {
          resolve(Array.from(input.files));
        } else {
          resolve([]);
        }
      };

      input.click();
    });
  }

  async loadDirectory(): Promise<FileList | null> {
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker();
        const files: File[] = [];

        for await (const entry of (dirHandle as unknown as { values: () => AsyncIterable<unknown> }).values()) {
          const e = entry as { kind?: string; name?: string; getFile?: () => Promise<File> };
          if (e.kind === "file" && e.name?.match(/\.(mp3|flac|ogg|wav|m4a|aac|wma|flo)$/i)) {
            const file = await e.getFile?.();
            if (file) files.push(file);
          }
        }

        return files.length > 0 ? this.filesToFileList(files) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async loadTrack(file: File): Promise<Track> {
    const id = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      id,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      album: "Unknown Album",
      duration: 0,
      url: URL.createObjectURL(file),
      mimeType: file.type || "audio/mpeg",
      hasStoredAudio: true,
    };
  }

  async loadTracks(files: File[]): Promise<Track[]> {
    const tracks: Track[] = [];
    for (const file of files) {
      try {
        const track = await this.loadTrack(file);
        tracks.push(track);
      } catch (error) {
        console.error(`Failed to load track ${file.name}:`, error);
      }
    }
    return tracks;
  }
}
