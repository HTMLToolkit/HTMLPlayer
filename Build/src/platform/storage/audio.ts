import { getDb, STORES } from "./db";

export interface AudioData {
  fileData: ArrayBuffer;
  mimeType: string;
}

export const audioStorage = {
  async load(songId: string): Promise<AudioData | null> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.AUDIO_DATA, "readwrite");
      const store = tx.objectStore(STORES.AUDIO_DATA);

      const result = await new Promise<any>((resolve, reject) => {
        const req = store.get(songId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (result) {
        store.put({ ...result, lastAccessed: Date.now() });
      }

      return result
        ? { fileData: result.fileData, mimeType: result.mimeType }
        : null;
    } catch (error) {
      console.error(`Failed to load audio data for song ${songId}:`, error);
      return null;
    }
  },

  async save(songId: string, audioData: AudioData): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.AUDIO_DATA, "readwrite");
      const store = tx.objectStore(STORES.AUDIO_DATA);

      await new Promise<void>((resolve, reject) => {
        const req = store.put({
          songId,
          fileData: audioData.fileData,
          mimeType: audioData.mimeType,
          lastAccessed: Date.now(),
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error(`Failed to save audio data for song ${songId}:`, error);
      throw error;
    }
  },

  async remove(songId: string): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction(STORES.AUDIO_DATA, "readwrite");
      const store = tx.objectStore(STORES.AUDIO_DATA);

      await new Promise<void>((resolve, reject) => {
        const req = store.delete(songId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error(`Failed to remove audio data for song ${songId}:`, error);
      throw error;
    }
  },
};
