import { toast } from "sonner";
import { parseBlob, selectCover } from "music-metadata";

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

// Track processing state for beforeunload prompt
let isProcessing = false;

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (isProcessing) {
    event.preventDefault();
    // Modern browsers ignore custom messages, but setting returnValue triggers the prompt
    event.returnValue = '';
  }
};

// Function to set processing state and manage beforeunload listener
export function setProcessingState(processing: boolean) {
  isProcessing = processing;
  if (processing) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
}

// Utility for promise with timeout and retries
async function withTimeoutAndRetry<T>(
  promise: Promise<T>,
  timeoutMs: number,
  retries: number,
  errorMessage: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout: ${errorMessage}`)), timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`Attempt ${attempt} failed: ${lastError.message}`);
      if (attempt === retries) {
        throw lastError;
      }
    }
  }
  throw lastError || new Error("Unknown error after retries");
}

export function pickAudioFiles(): Promise<AudioFile[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
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
  setProcessingState(true);
  const worker = new Worker(new URL('./metadataWorker.ts', import.meta.url), { type: 'module' });

  try {
    return await withTimeoutAndRetry(
      new Promise<AudioMetadata>((resolve, reject) => {
        worker.onmessage = (event) => {
          const { metadata, albumArt, error } = event.data;
          if (error) {
            console.warn(`Worker error for ${file.name}:`, error);
            reject(new Error(error));
          } else {
            resolve({ ...metadata, albumArt });
          }
        };

        worker.onerror = (error) => {
          console.warn(`Worker failed for ${file.name}:`, error);
          reject(new Error('Worker error'));
        };

        worker.postMessage({ file, fileName: file.name });
      }),
      15000,
      3,
      `Metadata extraction for ${file.name}`
    );
  } catch (e) {
    console.warn(`Failed to read metadata for ${file.name}:`, e);
    // Fallback metadata extraction in main thread
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    let title = fileName;
    let artist = "Unknown Artist";
    let album = "Unknown Album";
    let duration = 0;
    let albumArt: string | undefined = undefined;

    try {
      const metadata = await withTimeoutAndRetry(
        parseBlob(file, { skipCovers: false, duration: true }),
        15000,
        3,
        `Fallback metadata parsing for ${file.name}`
      );

      if (metadata.common) {
        if (metadata.common.artist && typeof metadata.common.artist === "string")
          artist = metadata.common.artist;
        if (metadata.common.title && typeof metadata.common.title === "string")
          title = metadata.common.title;
        if (metadata.common.album && typeof metadata.common.album === "string")
          album = metadata.common.album;
        duration = metadata.format.duration ?? 0;

        const cover = selectCover(metadata.common.picture);
        if (cover && cover.data && cover.data.length > 0) {
          const uint8Array = new Uint8Array(cover.data);
          const blob = new Blob([uint8Array], { type: cover.format });
          albumArt = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read album art'));
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch (fallbackError) {
      console.warn(`Fallback metadata parsing failed for ${file.name}:`, fallbackError);
      if (fileName.includes(" - ")) {
        const parts = fileName.split(" - ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts[1].trim();
        }
      }
    }

    return { title, artist, album, duration, albumArt };
  } finally {
    worker.terminate();
    setProcessingState(false);
  }
}

export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
