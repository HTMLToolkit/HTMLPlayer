import type { Track, TrackSourceKind } from "../../core/engine/types";
import { isPlainObject } from "../../core/engine/validators";
import { getDb, STORES, tx, req } from "./db";
import { loadAudio, deleteAudio } from "./opfs";
import { directoryStore } from "./directoryStore";
import { albumArtStorage } from "./albumArt";
import { resolveFileAtPath } from "./directoryHandle";

const FINGERPRINT_BYTES = 512;
const MAX_BLOB_URLS = 32;

interface StoredTrackRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  mimeType?: string;
  hasStoredAudio: boolean;
  sourceKind?: TrackSourceKind;
  sourceId?: string;
  path?: string;
  hasAlbumArt?: boolean;
  embeddedLyrics?: Track["embeddedLyrics"];
  encoding?: Track["encoding"];
  gapless?: Track["gapless"];
  replayGain?: Track["replayGain"];
}

function toStoredTrackRecord(track: Track): StoredTrackRecord {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    url: "",
    mimeType: track.mimeType,
    hasStoredAudio: track.hasStoredAudio === true,
    sourceKind: track.sourceKind,
    sourceId: track.sourceId,
    path: track.path,
    hasAlbumArt: track.hasAlbumArt,
    embeddedLyrics: track.embeddedLyrics,
    encoding: track.encoding,
    gapless: track.gapless,
    replayGain: track.replayGain,
  };
}

function toTrack(stored: StoredTrackRecord): Track {
  return {
    ...stored,
    url: "",
  };
}

function isStoredTrackRecord(value: unknown): value is StoredTrackRecord {
  if (!isPlainObject(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.artist === "string" &&
    typeof candidate.album === "string" &&
    typeof candidate.duration === "number" &&
    typeof candidate.url === "string" &&
    typeof candidate.hasStoredAudio === "boolean"
  );
}

interface CachedBlobUrl {
  fingerprint: string;
  url: string;
}

const blobUrlCache = new Map<string, CachedBlobUrl>();
const inFlightUrls = new Map<string, Promise<string | null>>();

function uncacheBlobUrl(songId: string): void {
  const entry = blobUrlCache.get(songId);
  if (!entry) return;
  try {
    URL.revokeObjectURL(entry.url);
  } catch {}
  blobUrlCache.delete(songId);
}

function cacheBlobUrl(songId: string, entry: CachedBlobUrl): void {
  while (blobUrlCache.size >= MAX_BLOB_URLS && !blobUrlCache.has(songId)) {
    const oldestKey = blobUrlCache.keys().next().value;
    if (oldestKey === undefined) break;
    uncacheBlobUrl(oldestKey);
  }
  blobUrlCache.set(songId, entry);
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read audio blob"));
    reader.readAsArrayBuffer(blob);
  });
}

async function fingerprintBlob(blob: Blob): Promise<string> {
  const bytes = await readBytes(blob.slice(0, FINGERPRINT_BYTES));
  let hash = blob.size >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash * 31 + (bytes[i] ?? 0)) >>> 0;
  }
  return `${blob.size}:${hash.toString(16)}`;
}

async function createBlobUrl(track: Track, blob: Blob): Promise<string | null> {
  const fingerprint = await fingerprintBlob(blob);
  const cached = blobUrlCache.get(track.id);
  if (cached && cached.fingerprint !== fingerprint) {
    uncacheBlobUrl(track.id);
  }

  const priorUrl = track.url.startsWith("blob:") ? track.url : undefined;
  const url = URL.createObjectURL(blob);
  cacheBlobUrl(track.id, { fingerprint, url });

  if (priorUrl && priorUrl !== url) {
    try {
      URL.revokeObjectURL(priorUrl);
    } catch {}
  }

  return url;
}

export const trackStorage = {
  async saveTrack(track: Track): Promise<void> {
    await tx(STORES.METADATA, "readwrite", (transaction) =>
      req(
        transaction
          .objectStore(STORES.METADATA)
          .put(toStoredTrackRecord(track)),
      ),
    );
  },

  async loadTrack(id: string): Promise<Track | null> {
    const db = await getDb();
    const transaction = db.transaction([STORES.METADATA], "readonly");
    const stored = await req(transaction.objectStore(STORES.METADATA).get(id));
    return isStoredTrackRecord(stored) ? toTrack(stored) : null;
  },

  async loadAllTracks(): Promise<Track[]> {
    const db = await getDb();
    const transaction = db.transaction([STORES.METADATA], "readonly");
    const raw = await req(transaction.objectStore(STORES.METADATA).getAll());
    return Array.isArray(raw)
      ? raw.filter(isStoredTrackRecord).map(toTrack)
      : [];
  },

  async deleteTrack(trackId: string): Promise<void> {
    uncacheBlobUrl(trackId);
    await Promise.all([
      tx(STORES.METADATA, "readwrite", (transaction) =>
        req(transaction.objectStore(STORES.METADATA).delete(trackId)),
      ),
      deleteAudio(trackId),
      albumArtStorage.delete(trackId),
    ]);
  },

  async reconstructUrl(track: Track): Promise<Track> {
    if (track.url && !track.url.startsWith("blob:")) {
      return track;
    }
    if (track.hasStoredAudio !== true) {
      return track;
    }

    const cached = blobUrlCache.get(track.id);
    if (cached) {
      return { ...track, url: cached.url };
    }

    const inFlight = inFlightUrls.get(track.id);
    if (inFlight) {
      const url = await inFlight;
      return url ? { ...track, url } : track;
    }

    const promise = this.resolveStoredAudio(track);
    inFlightUrls.set(track.id, promise);
    try {
      const url = await promise;
      return url ? { ...track, url } : track;
    } finally {
      inFlightUrls.delete(track.id);
    }
  },

  resolveStoredAudio(track: Track): Promise<string | null> {
    if (track.sourceKind === "folderHandle") {
      return this.resolveFolderHandleAudio(track);
    }
    return this.resolveOpfsAudio(track);
  },

  async resolveOpfsAudio(track: Track): Promise<string | null> {
    const blob = await loadAudio(track.id);
    return blob ? createBlobUrl(track, blob) : null;
  },

  async resolveFolderHandleAudio(track: Track): Promise<string | null> {
    if (!track.sourceId || !track.path) return null;
    const directory = await directoryStore.get(track.sourceId);
    if (!directory) return null;
    const blob = await resolveFileAtPath(directory.handle, track.path);
    return blob ? createBlobUrl(track, blob) : null;
  },

  revokeAudioUrl(songId: string): void {
    uncacheBlobUrl(songId);
  },
};
