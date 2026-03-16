import { BaseStorageBackend, PlatformType } from "./base";
import type { Track } from "../../core/engine/types";

export class DesktopStorageBackend extends BaseStorageBackend {
  name = "Desktop Storage (Tauri)";
  platform: PlatformType = "desktop";
  supportsDirectoryPicker = true;
  supportsFileHandle = true;

  async loadFiles(): Promise<File[]> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        multiple: true,
        filters: [{ name: "Audio", extensions: ["mp3", "flac", "ogg", "wav", "m4a", "aac", "wma", "flo"] }],
      });

      if (!result) return [];

      const paths = Array.isArray(result) ? result : [result];
      const { readFile } = await import("@tauri-apps/plugin-fs");

      const files: File[] = [];
      for (const path of paths) {
        try {
          const data = await readFile(path);
          const blob = new Blob([data], { type: this.getMimeType(path) });
          const file = new File([blob], path.split(/[/\\]/).pop() || "audio", { type: this.getMimeType(path) });
          files.push(file);
        } catch (err) {
          console.error(`Failed to read ${path}:`, err);
        }
      }

      return files;
    } catch (error) {
      console.error("Failed to open file dialog:", error);
      return [];
    }
  }

  async loadDirectory(): Promise<FileList | null> {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true });

      if (!result) return null;

      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(result);

      const files: File[] = [];
      for (const entry of entries) {
        const e = entry as { name?: string; isFile?: boolean };
        if (e.isFile && e.name?.match(/\.(mp3|flac|ogg|wav|m4a|aac|wma|flo)$/i)) {
          try {
            const { readFile } = await import("@tauri-apps/plugin-fs");
            const data = await readFile(`${result}/${e.name}`);
            const blob = new Blob([data], { type: this.getMimeType(e.name) });
            const file = new File([blob], e.name, { type: this.getMimeType(e.name) });
            files.push(file);
          } catch (err) {
            console.error(`Failed to read ${e.name}:`, err);
          }
        }
      }

      return files.length > 0 ? this.filesToFileList(files) : null;
    } catch (error) {
      console.error("Failed to open directory:", error);
      return null;
    }
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
