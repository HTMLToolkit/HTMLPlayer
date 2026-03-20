import { toast } from "sonner";
import { createMetadataExtractor, createFloMetadataExtractor, compressAlbumArt, generateUniqueId } from "../platform/metadata";
import { albumArtStorage } from "../platform/storage";
import { setAlbumArtInCache } from "../hooks/useAlbumArt";
import type { ExtractedMetadata } from "../platform/metadata";
import type { Track } from "../core/engine/types";

function getMetadataExtractor(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "flo") {
    return createFloMetadataExtractor();
  }
  return createMetadataExtractor();
}

async function extractAudioMetadata(file: File, t: any): Promise<{
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
      console.warn("Failed to compress album art:", e);
    }
  }
  
  const translated: ExtractedMetadata = {
    ...metadata,
    artist: metadata.artist === "Unknown Artist" ? t("common.unknownArtist") : metadata.artist,
    album: metadata.album === "Unknown Album" ? t("common.unknownAlbum") : metadata.album,
  };
  
  return { metadata: translated, albumArt };
}

export async function importAudioFiles(
  audioFiles: Array<{ file: File } | File>,
  addSong: (song: Track, file: File) => Promise<void>,
  t: any,
) {
  if (!audioFiles || audioFiles.length === 0) return;

  const BATCH_SIZE = 10;
  let successCount = 0;
  let errorCount = 0;
  let currentBatch = 1;
  const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);

  for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
    const batch = audioFiles.slice(i, i + BATCH_SIZE);
    toast.loading(t("batch.processing", { currentBatch, totalBatches }));

    // Process sequentially to reduce memory pressure
    for (const audioFile of batch) {
      try {
        const file: File = (audioFile as any).file || (audioFile as File);
        const { metadata, albumArt: compressedArt } = await extractAudioMetadata(file, t);
        const songId = generateUniqueId();

        // Pre-decode flo files for better performance
        let processedFile = file;
        let processedMimeType = file.type;

        const isFlo =
          file.name.toLowerCase().endsWith(".flo") ||
          metadata.encoding?.codec === "flo";

        if (isFlo) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const isSafari = /^((?!chrome|android).)*safari/i.test(
              navigator.userAgent,
            );

            if (isSafari) {
              // Safari: Pre-decode to WAV for compatibility
              const { decodeFloToWav } = await import("../platform/audio/floWavDecoder");
              const wavBytes = await decodeFloToWav(arrayBuffer);
              const wavArray = new Uint8Array(wavBytes);
              const wavBlob = new Blob([wavArray], { type: "audio/wav" });
              processedFile = new File(
                [wavBlob],
                file.name.replace(/\.flo$/i, ".wav"),
                { type: "audio/wav" },
              );
              processedMimeType = "audio/wav";
              console.log(`Pre-decoded flo to WAV for Safari: ${file.name}`);
            } else {
              // Non-Safari: Pre-decode to PCM for Web Audio API
              const { decodeFloToAudioBuffer } = await import("../platform/audio/floDecoder");
              const audioContext = new AudioContext();
              const audioBuffer = await decodeFloToAudioBuffer(
                arrayBuffer,
                audioContext,
              );

              // Store as interleaved Float32Array PCM
              const frameCount = audioBuffer.length;
              const channels = audioBuffer.numberOfChannels;
              const pcmData = new Float32Array(frameCount * channels);

              // Interleave channels
              for (let i = 0; i < frameCount; i++) {
                for (let ch = 0; ch < channels; ch++) {
                  pcmData[i * channels + ch] =
                    audioBuffer.getChannelData(ch)[i];
                }
              }

              const pcmBlob = new Blob([pcmData.buffer], { type: "audio/pcm" });
              processedFile = new File(
                [pcmBlob],
                file.name.replace(/\.flo$/i, ".pcm"),
                { type: "audio/pcm" },
              );
              processedMimeType = "audio/pcm";

              // Store AudioBuffer properties for reconstruction
              metadata.encoding = {
                ...metadata.encoding,
                sampleRate: audioBuffer.sampleRate,
                channels: audioBuffer.numberOfChannels,
                bitsPerSample: 32, // Float32
                codec: "pcm-float32",
              };

              // Close the temporary AudioContext
              await audioContext.close();

              console.log(`Pre-decoded flo to PCM: ${file.name}`);
            }
          } catch (error) {
            console.warn(
              "Failed to pre-decode flo file, storing original:",
              error,
            );
            // Keep original file if pre-decoding fails
            processedMimeType = "audio/x-flo";
          }
        }

        // Save album art separately if present
        const hasAlbumArt = !!compressedArt;
        if (hasAlbumArt && compressedArt) {
          await albumArtStorage.save(songId, compressedArt);
          setAlbumArtInCache(songId, compressedArt);
        }

        const song: Track = {
          id: songId,
          title: metadata.title,
          artist: metadata.artist,
          album:
            metadata.album ||
            t("songInfo.album", { title: t("common.unknownAlbum") }),
          duration: metadata.duration,
          url: "", // Will be set by addSong
          albumArt: compressedArt, // Keep for immediate display
          hasAlbumArt,
          embeddedLyrics: metadata.embeddedLyrics,
          encoding: metadata.encoding,
          gapless: metadata.gapless,
          mimeType: processedMimeType,
        };

        await addSong(song, processedFile);

        // Clear file reference to help GC
        if (typeof audioFile === "object" && "file" in audioFile) {
          (audioFile as { file: File }).file = null as any;
        }

        successCount++;
      } catch (error) {
        console.error("Failed to process song:", error);
        errorCount++;
      }
    }

    currentBatch++;

    // Give browser time to garbage collect between batches
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
