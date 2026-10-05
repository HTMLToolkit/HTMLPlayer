import { toast } from "sonner";
import {
  identifyFormat,
  isImportableFile,
  metadataExtractorFor,
} from "../platform/audio/formats";
import { describeError, logger } from "./logger";
import {
  createDuplicateDetector,
  findTrackBySourcePath,
} from "../platform/library/duplicateDetector";
import {
  createMetadataExtractor,
  createFloMetadataExtractor,
  compressAlbumArt,
  generateUniqueId,
} from "../platform/metadata";
import { albumArtStorage, opfsAvailability } from "../platform/storage";
import { dataUrlToBlob } from "../platform/storage/albumArt";
import {
  AlbumArtManager,
  MusicBrainzProvider,
  DiscogsProvider,
} from "../platform/providers";
import type { ImportContext } from "./addSong";
import type {
  ExtractedMetadata,
  MetadataExtractor,
} from "../platform/metadata";
import type { Track } from "../core/engine/types";

export type Translate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export interface AudioImportOpts {
  t: Translate;
  addSong: (song: Track, file: File, context?: ImportContext) => Promise<void>;
  getExistingTracks?: () => Track[];
}

export interface ImportFileItem {
  file: File | null;
  path?: string;
}

export interface ImportAudioResult {
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  songs: Array<Track | null>;
}

function describeImportSource(item: ImportFileItem | File): string {
  if ("file" in item) return item.file?.name ?? item.path ?? "<unknown file>";
  return item.name;
}

function getMetadataExtractor(file: File): MetadataExtractor | null {
  switch (metadataExtractorFor(identifyFormat(file.name, file.type))) {
    case "flo":
      return createFloMetadataExtractor();
    case "music-metadata":
      return createMetadataExtractor();
    case "none":
      return null;
  }
}

function untaggedMetadata(file: File): ExtractedMetadata {
  return {
    title: file.name.replace(/\.[^/.]+$/, ""),
    artist: "Unknown Artist",
    album: "Unknown Album",
    duration: 0,
  };
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
  const metadata = extractor
    ? await extractor.extractMetadata(file)
    : untaggedMetadata(file);

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
  audioFiles: Array<ImportFileItem | File>,
  addSong: AudioImportOpts["addSong"],
  t: Translate,
  getExistingTracks?: () => Track[],
  context?: ImportContext,
): Promise<ImportAudioResult> {
  if (!audioFiles || audioFiles.length === 0) {
    return {
      successCount: 0,
      duplicateCount: 0,
      errorCount: 0,
      songs: [],
    };
  }

  const BATCH_SIZE = 10;
  let successCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let currentBatch = 1;
  const albumArtManager = createAlbumArtManager();
  const duplicateDetector = createDuplicateDetector();
  const resolvedSongs: Array<Track | null> = new Array(audioFiles.length).fill(
    null,
  );

  const storage = opfsAvailability();
  if (!storage.available) {
    logger.error("Cannot import songs", {
      reason: storage.reason,
      detail: storage.message,
      fileCount: audioFiles.length,
    });
    toast.error(t("common.error"), {
      description: storage.message,
    });
    return {
      successCount: 0,
      errorCount: audioFiles.length,
      duplicateCount,
      songs: resolvedSongs,
    };
  }

  const pending: Array<{ item: ImportFileItem | File; index: number }> = [];
  for (let index = 0; index < audioFiles.length; index++) {
    const item = audioFiles[index]!;
    const sourceFile = "file" in item ? item.file : item;
    if (sourceFile === null) continue;

    const itemPath = "file" in item ? item.path : undefined;
    const known = findTrackBySourcePath(
      getExistingTracks ? getExistingTracks() : [],
      {
        sourceKind: context?.sourceKind,
        sourceId: context?.sourceKind ? context?.sourceId : undefined,
        path: itemPath ?? context?.path,
      },
    );

    if (known) {
      duplicateCount++;
      resolvedSongs[index] = known;
      if ("file" in item) item.file = null;
      continue;
    }

    if (!isImportableFile(sourceFile)) continue;

    pending.push({ item, index });
  }

  const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    toast.loading(t("batch.processing", { currentBatch, totalBatches }));

    for (const { item: audioFile, index: absoluteIndex } of batch) {
      try {
        const sourceFile = "file" in audioFile ? audioFile.file : audioFile;
        if (sourceFile === null) continue;
        const file: File = sourceFile;
        const itemPath = "file" in audioFile ? audioFile.path : undefined;
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

        const isUnknownArtist = metadata.artist === t("common.unknownArtist");
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

        let albumArtUrl: string | undefined;
        if (hasAlbumArt && albumArtDataUrl) {
          albumArtUrl =
            (await albumArtStorage.save(
              songId,
              dataUrlToBlob(albumArtDataUrl),
            )) ?? albumArtDataUrl;
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
          albumArt: albumArtUrl,
          hasAlbumArt,
          embeddedLyrics: metadata.embeddedLyrics,
          encoding: metadata.encoding,
          gapless: metadata.gapless,
          replayGain: metadata.replayGain,
          mimeType: processedMimeType,
          fileName: file.name,
        };

        if (context?.sourceKind) {
          song.sourceKind = context.sourceKind;
          if (context.sourceId) song.sourceId = context.sourceId;
        }
        song.path = itemPath ?? context?.path;

        const candidates = getExistingTracks ? getExistingTracks() : [];
        const duplicate =
          findTrackBySourcePath(candidates, {
            sourceKind: song.sourceKind,
            sourceId: song.sourceId,
            path: song.path,
          }) ??
          (await duplicateDetector.findDuplicateTrack(
            processedFile,
            song,
            candidates,
          ));

        if (duplicate) {
          duplicateCount++;
          resolvedSongs[absoluteIndex] = duplicate;
          if (typeof audioFile === "object" && "file" in audioFile) {
            audioFile.file = null;
          }
          continue;
        }

        await addSong(song, processedFile, context);
        resolvedSongs[absoluteIndex] = song;

        if (typeof audioFile === "object" && "file" in audioFile) {
          audioFile.file = null;
        }

        successCount++;
      } catch (error) {
        logger.error("Failed to process song", {
          file: describeImportSource(audioFile),
          error: describeError(error),
        });
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
  if (duplicateCount > 0) {
    toast.info(t("filePicker.duplicatesSkipped", { count: duplicateCount }));
  }
  if (errorCount > 0) {
    toast.error(t("filePicker.failedImport", { count: errorCount }));
  }

  return { successCount, duplicateCount, errorCount, songs: resolvedSongs };
}
