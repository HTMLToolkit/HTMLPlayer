import { toast } from "sonner";
import { musicIndexedDbHelper } from "./musicIndexedDbHelper";

export const createAudioProcessor = () => {
  
  const processAudioBatch = async (songs: Song[]): Promise<Song[]> => {
    const processedSongs: Song[] = [];
    const totalSongs = songs.length;
    let processedCount = 0;

    // Show initial toast
    const toastId = toast.loading(`Processing 0/${totalSongs} songs...`);

    for (const song of songs) {
      if (song.url.startsWith("blob:")) {
        try {
          // Load the audio data
          const res = await fetch(song.url);
          const buf = await res.arrayBuffer();
          const mimeType = res.headers.get("content-type") || "audio/mpeg";

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
            `Processing ${processedCount}/${totalSongs} songs...`,
            {
              id: toastId,
              description: `Current: ${song.title}`,
            }
          );
        } catch (error) {
          const err = error as Error;
          console.error(
            `Failed to process audio for song: ${song.title}`,
            err
          );
          toast.error(`Failed to process "${song.title}"`, {
            description: err.message || "Unknown error occurred",
          });
          processedSongs.push(song);
        }
      } else {
        processedSongs.push(song);
        processedCount++;
      }
    }

    // Show completion toast
    toast.success(`Processed ${processedCount} songs`, {
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
    getValidTempo
  };
};