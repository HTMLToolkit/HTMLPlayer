import type { Track } from "../../core/engine/types";
import { isPlainObject, isTrack } from "../../core/engine/validators";
import { getDb, STORES } from "./unifiedDB";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("trackStorage");

interface StoredTrack extends Omit<Track, "hasStoredAudio"> {
  hasStoredAudio: boolean;
  audioData?: ArrayBuffer;
  lastAccessed?: number;
}

function trackToStored(
  track: Track,
  audioData?: ArrayBuffer,
  hasExistingAudio?: boolean,
): StoredTrack {
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
  const hasUsableAudio =
    stored.hasStoredAudio && audioData instanceof ArrayBuffer;
  const orphanedBlob =
    !hasUsableAudio &&
    typeof track.url === "string" &&
    track.url.startsWith("blob:");
  return {
    ...track,
    url: orphanedBlob ? "" : track.url,
    hasStoredAudio: hasUsableAudio,
  };
}

function isStoredTrack(value: unknown): value is StoredTrack {
  if (!isTrack(value) || !isPlainObject(value)) return false;
  return typeof value.hasStoredAudio === "boolean";
}

interface ReconstructedUrl {
  fingerprint: string;
  url: string;
}

const reconstructedUrls = new Map<string, ReconstructedUrl>();

function fingerprintAudioData(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  const sampleLength = Math.min(bytes.length, 512);
  let hash = bytes.length >>> 0;
  for (let i = 0; i < sampleLength; i++) {
    hash = (hash * 31 + (bytes[i] ?? 0)) >>> 0;
  }
  return `${bytes.length}:${hash.toString(16)}`;
}

export const trackStorage = {
  async saveTrack(track: Track, audioData?: ArrayBuffer): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readwrite");
    const store = tx.objectStore(STORES.TRACKS);

    const existing = await new Promise<StoredTrack | undefined>(
      (resolve, reject) => {
        const req = store.get(track.id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      },
    );

    const existingAudio = existing?.audioData;
    const hasExistingAudio = !!(existing?.hasStoredAudio && existingAudio);
    const finalAudioData = hasExistingAudio ? existingAudio : audioData;

    const stored = trackToStored(track, finalAudioData, hasExistingAudio);
    store.put(stored);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async saveTracks(
    tracks: Track[],
    audioDataMap?: Map<string, ArrayBuffer>,
  ): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readwrite");
    const store = tx.objectStore(STORES.TRACKS);

    for (const track of tracks) {
      const newAudioData = audioDataMap?.get(track.id);

      const existing = await new Promise<StoredTrack | undefined>(
        (resolve, reject) => {
          const req = store.get(track.id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        },
      );

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
        const stored = req.result;
        if (!isStoredTrack(stored)) {
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
        const raw = req.result;
        const stored = Array.isArray(raw) ? raw.filter(isStoredTrack) : [];
        const tracks = stored.map(storedToTrack);
        resolve(tracks);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async getAudioData(trackId: string): Promise<ArrayBuffer | null> {
    const db = await getDb();
    const tx = db.transaction(STORES.TRACKS, "readonly");
    const store = tx.objectStore(STORES.TRACKS);

    return new Promise((resolve, reject) => {
      const req = store.get(trackId);
      req.onsuccess = () => {
        const stored = req.result as StoredTrack | undefined;
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
    if (!track.hasStoredAudio) {
      return track;
    }

    const audioData = await this.getAudioData(track.id);

    if (audioData) {
      const fingerprint = fingerprintAudioData(audioData);
      const existing = reconstructedUrls.get(track.id);

      if (existing && existing.fingerprint === fingerprint) {
        return { ...track, url: existing.url };
      }

      if (existing) {
        URL.revokeObjectURL(existing.url);
        reconstructedUrls.delete(track.id);
      }

      const blob = new Blob([audioData], {
        type: track.mimeType || "audio/mpeg",
      });
      const url = URL.createObjectURL(blob);
      reconstructedUrls.set(track.id, { fingerprint, url });
      logger.info("Reconstructed audio URL from stored data", {
        trackId: track.id,
      });

      return { ...track, url };
    } else {
      logger.warn("hasStoredAudio is true but no audio data found", {
        trackId: track.id,
      });
    }

    return track;
  },
};
