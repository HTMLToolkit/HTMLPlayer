import { toast } from "sonner";
import { logger } from "./logger";
import {
  createMetadataExtractor,
  createFloMetadataExtractor,
  compressAlbumArt,
  generateUniqueId,
} from "../platform/metadata";
import { albumArtStorage } from "../platform/storage";
import {
  AlbumArtManager,
  MusicBrainzProvider,
  DiscogsProvider,
} from "../platform/providers";
import type { ExtractedMetadata } from "../platform/metadata";
import type { Track } from "../core/engine/types";

type Translate = (key: string, options?: Record<string, unknown>) => string;

function getMetadataExtractor(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "flo") {
    return createFloMetadataExtractor();
  }
  return createMetadataExtractor();
}

function createAlbumArtManager(): AlbumArtManager {
  const manager = new AlbumArtManager();
  manager.addProvider(new MusicBrainzProvider());
  manager.addProvider(new DiscogsProvider());
  return manager;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

async function fetchRemoteAlbumArt(
  artist: string,
  album: string,
  manager: AlbumArtManager,
): Promise<string | undefined> {
  try {
    const result = await manager.fetchAlbumArt({ artist, album });
    if (!result) return undefined;

    const response = await fetch(result.url, { mode: "cors" });
    if (!response.ok) return undefined;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return undefined;

    return await blobToDataUrl(blob);
  } catch (error) {
    logger.warn("Failed to fetch remote album art", {
      error: String(error),
    });
    return undefined;
  }
}

async function extractAudioMetadata(
  file: File,
  t: Translate,
): Promise<{
  metadata: ExtractedMetadata;
  albumArt: string | undefined;
}> {
  const extractor = getMetadataExtractor(file);
  const metadata = await extractor.extractMetadata(file);

  let albumArt = metadata.albumArt;
  if (albumArt) {
    try {
      albumArt = await compressAlbumArt(albumArt);
    } catch (e) {
      if (e instanceof Error) {
        logger.warn("Failed to compress album art:", { error: e.message });
      } else {
        logger.warn("Failed to compress album art");
      }
    }
  }

  const translated: ExtractedMetadata = {
    ...metadata,
    artist:
      metadata.artist === "Unknown Artist"
        ? t("common.unknownArtist")
        : metadata.artist,
    album:
      metadata.album === "Unknown Album"
        ? t("common.unknownAlbum")
        : metadata.album,
  };

  return { metadata: translated, albumArt };
}

export async function importAudioFiles(
  audioFiles: Array<{ file: File | null } | File>,
  addSong: (song: Track, file: File) => Promise<void>,
  t: Translate,
) {
  if (!audioFiles || audioFiles.length === 0) return;

  const BATCH_SIZE = 10;
  let successCount = 0;
  let errorCount = 0;
  let currentBatch = 1;
  const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);
  const albumArtManager = createAlbumArtManager();

  for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
    const batch = audioFiles.slice(i, i + BATCH_SIZE);
    toast.loading(t("batch.processing", { currentBatch, totalBatches }));

    for (const audioFile of batch) {
      try {
        const sourceFile = "file" in audioFile ? audioFile.file : audioFile;
        if (sourceFile === null) continue;
        const file: File = sourceFile;
        const { metadata, albumArt: compressedArt } =
          await extractAudioMetadata(file, t);
        const songId = generateUniqueId();

        let processedFile = file;
        let processedMimeType = file.type;

        const isFlo =
          file.name.toLowerCase().endsWith(".flo") ||
          metadata.encoding?.codec === "flo";

        if (isFlo) {
          processedMimeType = "audio/x-flo";
        }

        let albumArtDataUrl = compressedArt;
        let hasAlbumArt = !!compressedArt;

        const isUnknownArtist =
          metadata.artist === t("common.unknownArtist");
        const isUnknownAlbum = metadata.album === t("common.unknownAlbum");

        if (!hasAlbumArt && !isUnknownArtist && !isUnknownAlbum) {
          const remoteArt = await fetchRemoteAlbumArt(
            metadata.artist,
            metadata.album,
            albumArtManager,
          );

          if (remoteArt) {
            try {
              albumArtDataUrl = await compressAlbumArt(remoteArt);
              hasAlbumArt = true;
            } catch (e) {
              if (e instanceof Error) {
                logger.warn("Failed to compress remote album art", {
                  error: e.message,
                });
              } else {
                logger.warn("Failed to compress remote album art");
              }
            }
          }
        }

        if (hasAlbumArt && albumArtDataUrl) {
          await albumArtStorage.save(songId, albumArtDataUrl);
        }

        const song: Track = {
          id: songId,
          title: metadata.title,
          artist: metadata.artist,
          album:
            metadata.album ||
            t("songInfo.album", { title: t("common.unknownAlbum") }),
          duration: metadata.duration,
          url: "",
          albumArt: albumArtDataUrl,
          hasAlbumArt,
          embeddedLyrics: metadata.embeddedLyrics,
          encoding: metadata.encoding,
          gapless: metadata.gapless,
          replayGain: metadata.replayGain,
          mimeType: processedMimeType,
        };

        await addSong(song, processedFile);

        if (typeof audioFile === "object" && "file" in audioFile) {
          audioFile.file = null;
        }

        successCount++;
      } catch (error) {
        if (error instanceof Error) {
          logger.error("Failed to process song:", { error: error.message });
        } else {
          logger.error("Failed to process song");
        }
        errorCount++;
      }
    }

    currentBatch++;

    await new Promise((r) => setTimeout(r, 100));
  }

  toast.dismiss();
  if (successCount > 0) {
    toast.success(t("filePicker.successImport", { count: successCount }));
  }
  if (errorCount > 0) {
    toast.error(t("filePicker.failedImport", { count: errorCount }));
  }
}