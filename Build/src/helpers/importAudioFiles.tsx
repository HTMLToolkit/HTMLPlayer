import { toast } from "sonner";
import { extractAudioMetadata, createAudioUrl, generateUniqueId } from "./filePickerHelper";
import { useTranslation } from "react-i18next";

export async function importAudioFiles(audioFiles: Array<{ file: File } | File>, addSong: (song: Song) => Promise<void>, t: any) {
  if (!audioFiles || audioFiles.length === 0) return;
  const BATCH_SIZE = 20;
  let successCount = 0;
  let errorCount = 0;
  let currentBatch = 1;
  const totalBatches = Math.ceil(audioFiles.length / BATCH_SIZE);
  for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
    const batch = audioFiles.slice(i, i + BATCH_SIZE);
    toast.loading(t("batch.processing", { currentBatch, totalBatches }));
    const batchPromises = batch.map(async (audioFile: { file: File } | File) => {
      try {
        const file: File = (audioFile as any).file || (audioFile as File);
        const metadata = await extractAudioMetadata(file);
        const audioUrl = createAudioUrl(file);
        const song: Song = {
          id: generateUniqueId(),
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album || t("songInfo.album", { title: t("common.unknownAlbum") }),
          duration: metadata.duration,
          url: audioUrl,
          albumArt: metadata.albumArt,
          embeddedLyrics: metadata.embeddedLyrics,
          encoding: metadata.encoding,
          gapless: metadata.gapless,
        };
        await addSong(song);
        URL.revokeObjectURL(audioUrl);
        if (typeof audioFile === 'object' && 'file' in audioFile) {
          (audioFile as { file: File }).file = null as any;
        }
        successCount++;
      } catch {
        errorCount++;
      }
    });
    await Promise.all(batchPromises);
    currentBatch++;
  }
  toast.dismiss();
  if (successCount > 0) toast.success(t("filePicker.successImport", { count: successCount }));
  if (errorCount > 0) toast.error(t("filePicker.failedImport", { count: errorCount }));
}
