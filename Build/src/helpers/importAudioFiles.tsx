import { toast } from "sonner";
import {
  extractAudioMetadata,
  generateUniqueId,
} from "./filePickerHelper";

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
        const song: Song = {
          id: generateUniqueId(),
          title: metadata.title,
          artist: metadata.artist,
          album:
            metadata.album ||
            t("songInfo.album", { title: t("common.unknownAlbum") }),
          duration: metadata.duration,
          url: '', // Will be set by addSong
          albumArt: metadata.albumArt,
          embeddedLyrics: metadata.embeddedLyrics,
          encoding: metadata.encoding,
          gapless: metadata.gapless,
        };
        
        await addSong(song, file); // Pass File object directly
        
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
    await new Promise(r => setTimeout(r, 100));
  }
  
  toast.dismiss();
  if (successCount > 0)
    toast.success(t("filePicker.successImport", { count: successCount }));
  if (errorCount > 0)
    toast.error(t("filePicker.failedImport", { count: errorCount }));
}