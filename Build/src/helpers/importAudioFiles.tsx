import { toast } from "sonner";
import { extractAudioMetadata, generateUniqueId } from "./filePickerHelper";
import { musicIndexedDbHelper } from "./musicIndexedDbHelper";
import { setAlbumArtInCache } from "../hooks/useAlbumArt";

export async function importAudioFiles(
  audioFiles: Array<{ file: File } | File>,
  addSong: (song: Song, file: File) => Promise<void>,
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

    // Process sequentially instead of Promise.all to reduce memory pressure
    for (const audioFile of batch) {
      try {
        const file: File = (audioFile as any).file || (audioFile as File);
        const metadata = await extractAudioMetadata(file);
        const songId = generateUniqueId();

        // Pre-decode FLO files for better performance and stability
        let processedFile = file;
        let processedMimeType = file.type;
        if (metadata.encoding?.codec === 'flo') {
          try {
            const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
            if (isSafari) {
              // Decode to WAV for Safari
              const { decodeFloToWav } = await import("./refloWavHelper");
              const arrayBuffer = await file.arrayBuffer();
              const wavBytes = await decodeFloToWav(arrayBuffer);
              const wavArrayBuffer = new Uint8Array(Array.from(wavBytes)).buffer;
              processedFile = new File([wavArrayBuffer], file.name.replace('.flo', '.wav'), { type: 'audio/wav' });
              processedMimeType = 'audio/wav';
            } else {
              // Decode to PCM for other browsers
              const { decodeFloToAudioBuffer } = await import("./floProcessor");
              const arrayBuffer = await file.arrayBuffer();
              const audioBuffer = await decodeFloToAudioBuffer(arrayBuffer, new AudioContext());
              // Store the raw PCM data (interleaved Float32Array)
              const frameCount = audioBuffer.length;
              const channels = audioBuffer.numberOfChannels;
              const pcmData = new Float32Array(frameCount * channels);
              for (let i = 0; i < frameCount; i++) {
                for (let channel = 0; channel < channels; channel++) {
                  pcmData[i * channels + channel] = audioBuffer.getChannelData(channel)[i];
                }
              }
              processedFile = new File([pcmData.buffer], file.name.replace('.flo', '.pcm'), { type: 'audio/pcm' });
              processedMimeType = 'audio/pcm';
              // Store additional metadata for AudioBuffer reconstruction
              metadata.encoding!.sampleRate = audioBuffer.sampleRate;
              metadata.encoding!.channels = audioBuffer.numberOfChannels;
            }
          } catch (error) {
            console.warn("Failed to pre-decode FLO file, using original:", error);
            // Fall back to original file
          }
        }

        // If there's album art, save it separately and set hasAlbumArt flag
        const hasAlbumArt = !!metadata.albumArt;
        if (hasAlbumArt && metadata.albumArt) {
          // Save album art to IndexedDB and in-memory cache
          await musicIndexedDbHelper.saveAlbumArt(songId, metadata.albumArt);
          setAlbumArtInCache(songId, metadata.albumArt);
        }

        const song: Song = {
          id: songId,
          title: metadata.title,
          artist: metadata.artist,
          album:
            metadata.album ||
            t("songInfo.album", { title: t("common.unknownAlbum") }),
          duration: metadata.duration,
          url: "", // Will be set by addSong
          albumArt: metadata.albumArt, // Keep for immediate display
          hasAlbumArt, // Flag for lazy loading later
          embeddedLyrics: metadata.embeddedLyrics,
          encoding: metadata.encoding,
          gapless: metadata.gapless,
          mimeType: processedMimeType,
        };

        await addSong(song, processedFile); // Pass processed File object

        // Clear file reference
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
  if (successCount > 0)
    toast.success(t("filePicker.successImport", { count: successCount }));
  if (errorCount > 0)
    toast.error(t("filePicker.failedImport", { count: errorCount }));
}
