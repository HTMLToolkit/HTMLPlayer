import { openDB, IDBPDatabase } from 'idb';
import DOMPurify from 'dompurify';

interface Playlist {
  id: string;
  name: string;
  art?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface Track {
  id: string;
  url: string;
  name: string;
  artist?: string;
  album?: string;
  duration?: number;
  art?: string;
  rating?: number;
  deleted?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

interface Settings {
  theme: string;
  visualizerStyle: string;
  cacheEnabled: boolean;
  maxCacheSize?: number; // in MB
  autoCleanup?: boolean;
}

// Database connection with proper typing and error handling
let dbInstance: IDBPDatabase | null = null;

const getDB = async (): Promise<IDBPDatabase> => {
  if (dbInstance) return dbInstance;
  
  try {
    dbInstance = await openDB('HTMLPlayer', 3, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Create initial stores if this is a new database
        if (oldVersion < 1) {
          db.createObjectStore('playlists', { keyPath: 'id' });
          db.createObjectStore('tracks', { keyPath: 'id' });
          db.createObjectStore('settings');
          db.createObjectStore('playback');
        }
        
        // Add audioblobs store in version 2
        if (oldVersion < 2) {
          db.createObjectStore('audioblobs');
        }

        // Add metadata and indexes in version 3
        if (oldVersion < 3) {
          // Get the tracks store from the transaction
          let tracksStore;
          
          // Check if tracks store exists, if not create it
          if (!db.objectStoreNames.contains('tracks')) {
            tracksStore = db.createObjectStore('tracks', { keyPath: 'id' });
          } else {
            tracksStore = transaction.objectStore('tracks');
          }
          
          // Create indexes if they don't exist
          if (!tracksStore.indexNames.contains('deleted')) {
            tracksStore.createIndex('deleted', 'deleted');
          }
          if (!tracksStore.indexNames.contains('rating')) {
            tracksStore.createIndex('rating', 'rating');
          }
          if (!tracksStore.indexNames.contains('createdAt')) {
            tracksStore.createIndex('createdAt', 'createdAt');
          }
        }
      },
      blocked() {
        console.warn('Database upgrade blocked - please close other tabs');
      },
      blocking() {
        console.warn('Database blocking - closing connection');
        dbInstance?.close();
        dbInstance = null;
      }
    });
    return dbInstance;
  } catch (error) {
    console.error('Failed to open database:', error);
    throw new Error('Database initialization failed');
  }
};

// Enhanced error handling wrapper
const withErrorHandling = async <T>(
  operation: () => Promise<T>,
  fallback: T,
  operationName: string
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    console.error(`Storage operation failed (${operationName}):`, error);
    return fallback;
  }
};

// Playlist operations with validation
export async function savePlaylist(playlist: Playlist): Promise<boolean> {
  return withErrorHandling(async () => {
    if (!playlist.id || !playlist.name.trim()) {
      throw new Error('Invalid playlist data');
    }

    const db = await getDB();
    const now = Date.now();
    const sanitizedPlaylist = {
      ...playlist,
      name: DOMPurify.sanitize(playlist.name.trim()),
      updatedAt: now,
      createdAt: playlist.createdAt || now
    };
    
    await db.put('playlists', sanitizedPlaylist);
    return true;
  }, false, 'savePlaylist');
}

export async function loadPlaylists(): Promise<Playlist[]> {
  return withErrorHandling(async () => {
    const db = await getDB();
    const playlists = await db.getAll('playlists');
    return playlists.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [], 'loadPlaylists');
}

export async function deletePlaylist(id: string): Promise<boolean> {
  return withErrorHandling(async () => {
    const db = await getDB();
    await db.delete('playlists', id);
    return true;
  }, false, 'deletePlaylist');
}

// Enhanced track operations
export async function saveTrack(track: Track): Promise<boolean> {
  return withErrorHandling(async () => {
    if (!track.id || !track.url || !track.name.trim()) {
      throw new Error('Invalid track data');
    }

    const db = await getDB();
    const now = Date.now();
    const sanitizedTrack = {
      ...track,
      name: DOMPurify.sanitize(track.name.trim()),
      artist: track.artist ? DOMPurify.sanitize(track.artist.trim()) : undefined,
      album: track.album ? DOMPurify.sanitize(track.album.trim()) : undefined,
      updatedAt: now,
      createdAt: track.createdAt || now
    };
    
    await db.put('tracks', sanitizedTrack);
    return true;
  }, false, 'saveTrack');
}

export async function loadTracks(includeDeleted = false): Promise<Track[]> {
  return withErrorHandling(async () => {
    const db = await getDB();
    const tracks = await db.getAll('tracks');
    
    const filteredTracks = includeDeleted 
      ? tracks 
      : tracks.filter(track => !track.deleted);
    
    return filteredTracks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [], 'loadTracks');
}

export async function getTrackById(id: string): Promise<Track | null> {
  return withErrorHandling(async () => {
    const db = await getDB();
    return await db.get('tracks', id) || null;
  }, null, 'getTrackById');
}

export async function searchTracks(query: string): Promise<Track[]> {
  return withErrorHandling(async () => {
    const tracks = await loadTracks();
    const searchTerm = query.toLowerCase().trim();
    
    return tracks.filter(track => 
      track.name.toLowerCase().includes(searchTerm) ||
      track.artist?.toLowerCase().includes(searchTerm) ||
      track.album?.toLowerCase().includes(searchTerm)
    );
  }, [], 'searchTracks');
}

// Enhanced settings with validation
const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  visualizerStyle: 'particles',
  cacheEnabled: true,
  maxCacheSize: 500, // 500MB default
  autoCleanup: true
};

export async function saveSettings(settings: Partial<Settings>): Promise<boolean> {
  return withErrorHandling(async () => {
    const db = await getDB();
    const currentSettings = await loadSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    
    // Validate settings
    if (updatedSettings.maxCacheSize && updatedSettings.maxCacheSize < 10) {
      updatedSettings.maxCacheSize = 10; // Minimum 10MB
    }
    
    await db.put('settings', updatedSettings, 'user-settings');
    return true;
  }, false, 'saveSettings');
}

export async function loadSettings(): Promise<Settings> {
  return withErrorHandling(async () => {
    const db = await getDB();
    const settings = await db.get('settings', 'user-settings');
    return { ...DEFAULT_SETTINGS, ...settings };
  }, DEFAULT_SETTINGS, 'loadSettings');
}

// Enhanced playback position tracking
export async function savePlaybackPosition(trackId: string | null, position: number): Promise<boolean> {
  if (!trackId || position < 0) return false;
  
  return withErrorHandling(async () => {
    const db = await getDB();
    await db.put('playback', { position, timestamp: Date.now() }, trackId);
    return true;
  }, false, 'savePlaybackPosition');
}

export async function loadPlaybackPosition(trackId: string | null): Promise<number | null> {
  if (!trackId) return null;
  
  return withErrorHandling(async () => {
    const db = await getDB();
    const data = await db.get('playback', trackId);
    return data?.position || null;
  }, null, 'loadPlaybackPosition');
}

// Enhanced audio caching with size management
export async function cacheAudioBlob(url: string, blob: Blob): Promise<boolean> {
  return withErrorHandling(async () => {
    const settings = await loadSettings();
    
    if (!settings.cacheEnabled) return false;
    
    // Check cache size before adding
    const currentSize = await getAudioCacheSize();
    const maxSize = (settings.maxCacheSize || 500) * 1024 * 1024; // Convert MB to bytes
    
    if (currentSize + blob.size > maxSize && settings.autoCleanup) {
      await cleanupOldCache(blob.size);
    }
    
    const db = await getDB();
    await db.put('audioblobs', {
      blob,
      timestamp: Date.now(),
      size: blob.size
    }, url);
    
    return true;
  }, false, 'cacheAudioBlob');
}

export async function getCachedAudioBlob(url: string): Promise<Blob | null> {
  return withErrorHandling(async () => {
    const db = await getDB();
    const data = await db.get('audioblobs', url);
    return data?.blob || null;
  }, null, 'getCachedAudioBlob');
}

// Smart cache cleanup
async function cleanupOldCache(requiredSpace: number): Promise<void> {
  const db = await getDB();
  const keys = await db.getAllKeys('audioblobs');
  const entries = await Promise.all(
    keys.map(async key => ({
      key,
      data: await db.get('audioblobs', key)
    }))
  );
  
  // Sort by timestamp (oldest first)
  entries.sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0));
  
  let freedSpace = 0;
  for (const entry of entries) {
    if (freedSpace >= requiredSpace) break;
    
    await db.delete('audioblobs', entry.key);
    freedSpace += entry.data?.size || 0;
  }
}

// Enhanced blob URL management with cleanup
const blobUrls = new Map<string, { url: string; lastUsed: number }>();
const BLOB_URL_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

export async function getAudioBlobUrl(trackUrl: string): Promise<string> {
  // Check if we already have a blob URL for this track
  const existing = blobUrls.get(trackUrl);
  if (existing) {
    existing.lastUsed = Date.now();
    return existing.url;
  }

  // Try to get from cache or fetch new
  const settings = await loadSettings();
  let blob: Blob;

  if (settings.cacheEnabled) {
    const cachedBlob = await getCachedAudioBlob(trackUrl);
    if (cachedBlob) {
      blob = cachedBlob;
    } else {
      try {
        const response = await fetch(trackUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blob = await response.blob();
        await cacheAudioBlob(trackUrl, blob);
      } catch (error) {
        console.error('Failed to fetch audio:', error);
        throw error;
      }
    }
  } else {
    const response = await fetch(trackUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    blob = await response.blob();
  }

  // Create and store the blob URL
  const blobUrl = URL.createObjectURL(blob);
  blobUrls.set(trackUrl, { url: blobUrl, lastUsed: Date.now() });
  return blobUrl;
}

export function revokeAudioBlobUrl(trackUrl: string): void {
  const entry = blobUrls.get(trackUrl);
  if (entry) {
    URL.revokeObjectURL(entry.url);
    blobUrls.delete(trackUrl);
  }
}

// Automatic cleanup of unused blob URLs
setInterval(() => {
  const now = Date.now();
  for (const [trackUrl, entry] of blobUrls.entries()) {
    if (now - entry.lastUsed > BLOB_URL_CLEANUP_INTERVAL) {
      URL.revokeObjectURL(entry.url);
      blobUrls.delete(trackUrl);
    }
  }
}, BLOB_URL_CLEANUP_INTERVAL);

// Enhanced cache management
export async function clearAudioCache(): Promise<boolean> {
  return withErrorHandling(async () => {
    const db = await getDB();
    await db.clear('audioblobs');
    
    // Cleanup all blob URLs
    for (const [trackUrl, entry] of blobUrls.entries()) {
      URL.revokeObjectURL(entry.url);
      blobUrls.delete(trackUrl);
    }
    
    return true;
  }, false, 'clearAudioCache');
}

export async function getAudioCacheSize(): Promise<number> {
  return withErrorHandling(async () => {
    const db = await getDB();
    const keys = await db.getAllKeys('audioblobs');
    const entries = await Promise.all(keys.map(key => db.get('audioblobs', key)));
    return entries.reduce((total, entry) => total + (entry?.size || 0), 0);
  }, 0, 'getAudioCacheSize');
}

export async function getCacheStats(): Promise<{
  totalSize: number;
  itemCount: number;
  maxSize: number;
  utilizationPercent: number;
}> {
  const [totalSize, settings] = await Promise.all([
    getAudioCacheSize(),
    loadSettings()
  ]);
  
  const maxSize = (settings.maxCacheSize || 500) * 1024 * 1024;
  const db = await getDB();
  const itemCount = (await db.getAllKeys('audioblobs')).length;
  
  return {
    totalSize,
    itemCount,
    maxSize,
    utilizationPercent: (totalSize / maxSize) * 100
  };
}

// Database maintenance
export async function optimizeDatabase(): Promise<boolean> {
  return withErrorHandling(async () => {
    // Clean up old playback positions (older than 30 days)
    const db = await getDB();
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const playbackKeys = await db.getAllKeys('playback');
    for (const key of playbackKeys) {
      const data = await db.get('playback', key);
      if (data?.timestamp && data.timestamp < thirtyDaysAgo) {
        await db.delete('playback', key);
      }
    }
    
    return true;
  }, false, 'optimizeDatabase');
}

// Export database
export async function exportUserData(): Promise<string> {
  const [playlists, tracks, settings] = await Promise.all([
    loadPlaylists(),
    loadTracks(true), // Include deleted for backup
    loadSettings()
  ]);
  
  return JSON.stringify({
    version: 3,
    exportDate: new Date().toISOString(),
    playlists,
    tracks,
    settings
  }, null, 2);
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}