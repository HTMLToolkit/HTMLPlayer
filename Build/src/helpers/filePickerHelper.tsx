import { toast } from "sonner";
import { parseBlob } from "music-metadata";

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
  let metadata: any = null;
  let albumArt: string | undefined = undefined;

  try {
    // Use music-metadata-browser - much more reliable!
    metadata = await parseBlob(file);
    
    // Extract album art if available
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0]; // Use first picture
      if (picture.data && picture.format) {
        try {
          const blob = new Blob([picture.data], { type: picture.format });
          albumArt = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read album art'));
            reader.readAsDataURL(blob);
          });
        } catch (artError) {
          console.warn(`Failed to process album art for ${file.name}:`, artError);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read metadata for ${file.name}:`, error);
  }

  // Extract metadata with fallbacks
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  let title = metadata?.common?.title || fileName;
  let artist = metadata?.common?.artist || "Unknown Artist";
  let album = metadata?.common?.album || "Unknown Album";
  let duration = metadata?.format?.duration || 0;

  // If no metadata was found, try parsing filename
  if (!metadata && fileName.includes(" - ")) {
    const parts = fileName.split(" - ");
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts[1].trim();
    }
  }

  // If duration is still 0, get it from audio element as fallback
  if (duration === 0) {
    const url = URL.createObjectURL(file);
    duration = await new Promise<number>((resolve) => {
      const audio = new Audio();
      
      const cleanup = () => {
        URL.revokeObjectURL(url);
        audio.removeEventListener('loadedmetadata', onLoad);
        audio.removeEventListener('error', onError);
      };
      
      const onLoad = () => {
        cleanup();
        resolve(audio.duration || 0);
      };
      
      const onError = () => {
        cleanup();
        resolve(0);
      };
      
      audio.addEventListener('loadedmetadata', onLoad);
      audio.addEventListener('error', onError);
      audio.src = url;
    });
  }

  return { title, artist, album, duration, albumArt };
}

// Batch processing function to handle multiple files efficiently
export async function extractMultipleAudioMetadata(
  files: File[], 
  batchSize: number = 3
): Promise<AudioMetadata[]> {
  const results: AudioMetadata[] = [];
  const totalFiles = files.length;
  let processedCount = 0;

  // Show progress toast
  const toastId = toast.loading(`Processing metadata 0/${totalFiles} files...`);

  try {
    // Process files in batches to avoid overwhelming the browser
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const metadata = await extractAudioMetadata(file);
          processedCount++;
          
          // Update progress toast
          toast.loading(
            `Processing metadata ${processedCount}/${totalFiles} files...`,
            {
              id: toastId,
              description: `Current: ${metadata.title}`,
            }
          );
          
          return metadata;
        } catch (error) {
          console.error(`Failed to process ${file.name}:`, error);
          processedCount++;
          
          // Return fallback metadata
          return {
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: "Unknown Artist",
            album: "Unknown Album",
            duration: 0,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      // Extract successful results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });

      // Small delay between batches to prevent browser freezing
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Success toast
    toast.success(`Successfully processed ${results.length} files`, {
      id: toastId,
    });
    
  } catch (error) {
    toast.error("Failed to process some files", {
      id: toastId,
      description: (error as Error).message,
    });
  }

  return results;
}

export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}