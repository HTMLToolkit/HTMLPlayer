import { toast } from "sonner";
import { musicIndexedDbHelper } from "./musicIndexedDbHelper";
import i18n from "i18next";
import initFlo from "@flo-audio/libflo-audio";

export const createAudioProcessor = () => {
  let floInitialized = false;
  const processAudioBatch = async (songs: Song[]): Promise<Song[]> => {
    // Ensure flo WASM is initialized before any decode
    if (!floInitialized) {
      await initFlo();
      floInitialized = true;
    }
    const processedSongs: Song[] = [];
    const totalSongs = songs.length;
    let processedCount = 0;

    // Show initial toast
    const toastId = toast.loading(
      i18n.t("audioProcessor.processingZero", { totalSongs }),
    );

    for (const song of songs) {
      if (song.url.startsWith("blob:")) {
        try {
          // Load the audio data
          const res = await fetch(song.url);
          const buf = await res.arrayBuffer();
          let mimeType = res.headers.get("content-type") || "audio/mpeg";
          const ext = song.url.split(".").pop()?.toLowerCase() || "";

          // If flo file, decode using @flo-audio/libflo-audio (placeholder)
          if (ext === "flo") {
            // TODO: Integrate @flo-audio/libflo-audio decoder here
            // Example:
            // import { decodeFlo } from '@flo-audio/libflo-audio';
            // const pcmData = await decodeFlo(buf);
            // ...convert pcmData to AudioBuffer and store/play as needed...
            mimeType = "audio/x-flo";
          }

          // Save to IndexedDB audio store
          await musicIndexedDbHelper.saveSongAudio(song.id, {
            fileData: buf,
            mimeType,
          });

          // Add processed song without the audio data
          processedSongs.push({
            ...song,
            hasStoredAudio: true,
            albumArt: song.albumArt, // Preserve album art when processing
          });

          processedCount++;
          // Update toast with progress
          toast.loading(
            i18n.t("audioProcessor.processing", { processedCount, totalSongs }),
            {
              id: toastId,
              description: i18n.t("audioProcessor.current", {
                songTitle: song.title,
              }),
            },
          );
        } catch (error) {
          const err = error as Error;
          console.error(
            i18n.t("audioProcessor.failedToProcess", { songTitle: song.title }),
            err,
          );
          toast.error(`Failed to process "${song.title}"`, {
            description: err.message || i18n.t("common.unknownError"),
          });
          processedSongs.push(song);
        }
      } else {
        processedSongs.push(song);
        processedCount++;
      }
    }

    // Show completion toast
    toast.success(i18n.t("audioProcessor.processed", { processedCount }), {
      id: toastId,
    });

    return processedSongs;
  };

  const getValidTempo = (tempo: number | undefined) => {
    if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0) {
      return 1; // fallback to normal speed
    }
    return tempo;
  };

  return {
    processAudioBatch,
    getValidTempo,
  };
};
