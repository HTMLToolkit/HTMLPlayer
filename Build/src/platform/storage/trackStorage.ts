import type { Track } from "../../core/engine/types";
import { getDb, STORES } from "./unifiedDB";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("trackStorage");

interface StoredTrack extends Omit<Track, "hasStoredAudio"> {
  hasStoredAudio: boolean;
  audioData?: ArrayBuffer;
  lastAccessed?: number;
}

function trackToStored(track: Track, audioData?: ArrayBuffer, hasExistingAudio?: boolean): StoredTrack {
  const hasAudio = !!audioData || hasExistingAudio === true;
  return {
    ...track,
    hasStoredAudio: hasAudio,
    audioData,
    lastAccessed: hasAudio ? Date.now() : undefined,
  };
}

function storedToTrack(stored: StoredTrack): Track {
  const { audioData, lastAccessed, ...track } = stored;
  return {
    ...track,
    hasStoredAudio: stored.hasStoredAudio,
  };
}

export const trackStorage = {
  async saveTrack(track: Track, audioData?: ArrayBuffer): Promise<void> {
    console.log("[saveTrack] called", { trackId: track.id, hasStoredAudio: track.hasStoredAudio, audioDataSize: audioData?.byteLength });
    
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readwrite");
    const store = tx.objectStore(STORES.TRACKS);
    
    const existing = await new Promise<StoredTrack | undefined>((resolve, reject) => {
      const req = store.get(track.id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    
    const existingAudio = existing?.audioData;
    const hasExistingAudio = !!(existing?.hasStoredAudio && existingAudio);
    const finalAudioData = hasExistingAudio ? existingAudio : audioData;
    
    console.log("[saveTrack] hasExistingAudio:", hasExistingAudio, "finalAudioData:", finalAudioData?.byteLength);
    
    const stored = trackToStored(track, finalAudioData, hasExistingAudio);
    store.put(stored);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log("[saveTrack] completed");
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveTracks(tracks: Track[], audioDataMap?: Map<string, ArrayBuffer>): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readwrite");
    const store = tx.objectStore(STORES.TRACKS);

    for (const track of tracks) {
      const newAudioData = audioDataMap?.get(track.id);
      
      const existing = await new Promise<StoredTrack | undefined>((resolve, reject) => {
        const req = store.get(track.id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      
      const existingAudio = existing?.audioData;
      const hasExistingAudio = !!(existing?.hasStoredAudio && existingAudio);
      const finalAudioData = hasExistingAudio ? existingAudio : newAudioData;
      
      store.put(trackToStored(track, finalAudioData, hasExistingAudio));
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadTrack(id: string): Promise<Track | null> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readwrite");
    const store = tx.objectStore(STORES.TRACKS);

    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => {
        const stored = req.result as StoredTrack | undefined;
        if (!stored) {
          resolve(null);
          return;
        }
        
        store.put({ ...stored, lastAccessed: Date.now() });
        resolve(storedToTrack(stored));
      };
      req.onerror = () => reject(req.error);
    });
  },

  async loadAllTracks(): Promise<Track[]> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readonly");
    const store = tx.objectStore(STORES.TRACKS);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const tracks = (req.result as StoredTrack[]).map(storedToTrack);
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getAudioData(trackId: string): Promise<ArrayBuffer | null> {
    console.log("[getAudioData] called for:", trackId);
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readonly");
    const store = tx.objectStore(STORES.TRACKS);

    return new Promise((resolve, reject) => {
      const req = store.get(trackId);
      req.onsuccess = () => {
        const stored = req.result as StoredTrack | undefined;
        console.log("[getAudioData] result:", stored ? { id: stored.id, hasStoredAudio: stored.hasStoredAudio, audioDataSize: stored.audioData?.byteLength } : null);
        resolve(stored?.audioData ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async deleteTrack(trackId: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readwrite");
    const store = tx.objectStore(STORES.TRACKS);
    store.delete(trackId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async reconstructUrl(track: Track): Promise<Track> {
    console.log("[reconstructUrl] called", { trackId: track.id, hasStoredAudio: track.hasStoredAudio, url: track.url });
    
    if (!track.hasStoredAudio) {
      console.log("[reconstructUrl] no hasStoredAudio, returning as-is");
      return track;
    }

    if (track.url && track.url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(track.url);
      } catch {}
    }

    try {
      const audioData = await this.getAudioData(track.id);
      console.log("[reconstructUrl] got audioData:", audioData ? audioData.byteLength : null);
      
      if (audioData) {
        const blob = new Blob([audioData], { type: track.mimeType || "audio/mpeg" });
        const url = URL.createObjectURL(blob);
        logger.info("Reconstructed audio URL from stored data", { trackId: track.id });
        return { ...track, url };
      } else {
        logger.warn("hasStoredAudio is true but no audio data found", { trackId: track.id });
      }
    } catch (error) {
      logger.error("Failed to reconstruct audio URL", { trackId: track.id, error: String(error) });
    }

    return track;
  },
};
