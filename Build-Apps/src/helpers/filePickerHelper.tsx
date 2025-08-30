import { toast } from "sonner";
import * as jsmediatags from "jsmediatags/dist/jsmediatags.min.js";

export type AudioFile = {
  file: File;
  name: string;
  size: number;
  type: string;
};

export type AudioMetadata = {
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt?: string;
};

export function pickAudioFiles(): Promise<AudioFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    // Allow specific audio types only (case insensitive)
    input.accept = ".mp3,.wav,.m4a,.flac,.aif,.aiff,.ogg";
    input.multiple = true;

    input.onchange = (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;

      if (!files || files.length === 0) {
        resolve([]);
        return;
      }

      const audioFiles: AudioFile[] = [];
      const audioTest = document.createElement("audio");

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate audio file type by MIME type prefix
        const allowedExtensions = [
          "mp3",
          "wav",
          "m4a",
          "flac",
          "aif",
          "aiff",
          "ogg",
        ];

        const fileExtension = file.name.split(".").pop()?.toLowerCase();

        if (
          !file.type.startsWith("audio/") &&
          !(fileExtension && allowedExtensions.includes(fileExtension))
        ) {
          toast.error(`Skipping non-audio file: ${file.name}`);
          continue;
        }

        // Check if browser can play the file type
        const canPlay = audioTest.canPlayType(file.type);
        if (canPlay !== "probably" && canPlay !== "maybe") {
          toast.error(
            `Skipping unsupported audio format by browser: ${file.name} (${file.type})`
          );
          continue;
        }

        audioFiles.push({
          file,
          name: file.name,
          size: file.size,
          type: file.type,
        });
      }

      resolve(audioFiles);
    };

    input.onerror = () => {
      reject(new Error("File selection failed"));
    };

    input.oncancel = () => {
      resolve([]);
    };

    input.click();
  });
}

export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  let id3Tags: any = null;
  let albumArt: string | undefined = undefined;

  try {
    id3Tags = await new Promise((resolve) => {
      new jsmediatags.Reader(file).read({
        onSuccess: (tag: any) => resolve(tag.tags),
        onError: (error: any) => {
          console.warn("Failed to read ID3 tags with jsmediatags:", error);
          resolve(null);
        },
      });
    }).catch((e) => {
      console.warn("Error reading ID3 tags with jsmediatags:", e);
      return null;
    });

    // Extract album art if available
    if (id3Tags && id3Tags.picture) {
      const { data } = id3Tags.picture;
      const format = id3Tags.picture.format;
      if (data) {
        // data is an array of bytes, convert it to a blob and then a data URL
        const blob = new Blob([new Uint8Array(data)], { type: format });
        albumArt = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (e) {
    console.warn("Error processing ID3 tags:", e);
  }

  const fileName = file.name.replace(/\.[^/.]+$/, "");
  let title = fileName;
  let artist = "Unknown Artist";
  let album = "Unknown Album";

  if (id3Tags) {
    if (id3Tags.artist && typeof id3Tags.artist === "string")
      artist = id3Tags.artist;
    if (id3Tags.title && typeof id3Tags.title === "string")
      title = id3Tags.title;
    if (id3Tags.album && typeof id3Tags.album === "string")
      album = id3Tags.album;
  } else if (fileName.includes(" - ")) {
    const parts = fileName.split(" - ");
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts[1].trim();
    }
  }

  const url = URL.createObjectURL(file);
  const audio = new Audio();
  const duration = await new Promise<number>((resolve) => {
    audio.onloadedmetadata = () => {
      resolve(audio.duration || 0);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(url);
    };
    audio.src = url;
  });

  return { title, artist, album, duration, albumArt };
}

export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
