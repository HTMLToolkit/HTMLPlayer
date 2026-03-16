import type { Track } from "../../core/engine/types";

export type PlatformType = "web" | "desktop" | "mobile";

export interface StorageBackend {
  name: string;
  platform: PlatformType;
  supportsDirectoryPicker: boolean;
  loadFiles(): Promise<File[]>;
  loadDirectory(): Promise<FileList | null>;
  supportsFileHandle: boolean;
}

export interface AudioLoader {
  loadTrack(file: File): Promise<Track>;
  loadTracks(files: File[]): Promise<Track[]>;
}

export abstract class BaseStorageBackend implements StorageBackend, AudioLoader {
  abstract name: string;
  abstract platform: PlatformType;
  abstract supportsDirectoryPicker: boolean;
  abstract supportsFileHandle: boolean;

  abstract loadFiles(): Promise<File[]>;
  abstract loadDirectory(): Promise<FileList | null>;
  abstract loadTrack(file: File): Promise<Track>;
  abstract loadTracks(files: File[]): Promise<Track[]>;

  protected getMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      flac: "audio/flac",
      ogg: "audio/ogg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      aac: "audio/aac",
      wma: "audio/x-ms-wma",
      flo: "audio/x-flo",
    };
    return mimeTypes[ext || ""] || "audio/mpeg";
  }

  protected filesToFileList(files: File[]): FileList {
    const dt = new DataTransfer();
    files.forEach((file) => dt.items.add(file));
    return dt.files;
  }
}