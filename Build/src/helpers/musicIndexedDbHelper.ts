// IndexedDB configuration
import i18n from "i18next";

const DB_NAME = "HTMLPlayerDB";
const DB_VERSION = 2; // Bump version for album art store
const STORES = {
  LIBRARY: "library",
  SETTINGS: "settings",
  AUDIO_DATA: "audioData", // Store for actual audio data
  ALBUM_ART: "albumArt", // New store for album art (lazy loaded)
} as const;

// In-memory cache for album art to avoid repeated IndexedDB reads
const albumArtCache = new Map<string, string>();
const MAX_ALBUM_ART_CACHE = 50; // Only keep 50 album arts in memory

// IndexedDB utilities
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.LIBRARY)) {
        db.createObjectStore(STORES.LIBRARY, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.AUDIO_DATA)) {
        const audioStore = db.createObjectStore(STORES.AUDIO_DATA, {
          keyPath: "songId",
        });
        audioStore.createIndex("lastAccessed", "lastAccessed", {
          unique: false,
        });
      }
      // Create album art store for lazy loading
      if (!db.objectStoreNames.contains(STORES.ALBUM_ART)) {
        db.createObjectStore(STORES.ALBUM_ART, { keyPath: "songId" });
      }

      // Migration: Move album art from library to separate store
      if (oldVersion < 2 && oldVersion > 0) {
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (transaction) {
          const libraryStore = transaction.objectStore(STORES.LIBRARY);
          const albumArtStore = transaction.objectStore(STORES.ALBUM_ART);

          libraryStore.get("musicLibrary").onsuccess = function (e: any) {
            const library = e.target.result?.data;
            if (library?.songs) {
              library.songs.forEach((song: any) => {
                // Migrate album art to separate store
                if (song.albumArt) {
                  albumArtStore.put({
                    songId: song.id,
                    albumArt: song.albumArt,
                  });
                  // Mark that album art exists but don't store it in library
                  song.hasAlbumArt = true;
                  delete song.albumArt;
                }
                // Also migrate audio data if present (from version 0)
                if (song.fileData && song.mimeType) {
                  const audioStore = transaction.objectStore(STORES.AUDIO_DATA);
                  audioStore.put({
                    songId: song.id,
                    fileData: song.fileData,
                    mimeType: song.mimeType,
                    lastAccessed: Date.now(),
                  });
                  delete song.fileData;
                  delete song.mimeType;
                }
              });
              // Save cleaned up library
              libraryStore.put({ id: "musicLibrary", data: library });
            }
          };
        }
      }
    };
  });
};

const saveToIndexedDB = async (
  storeName: string,
  key: string,
  data: any,
): Promise<void> => {
  try {
    // Open database
    const db = await openDatabase();

    // For library data, we need to save album art separately
    if (key === "musicLibrary" && data?.songs) {
      // First pass: extract album art and save to separate store
      const albumArtsToSave: { songId: string; albumArt: string }[] = [];

      const BATCH_SIZE = 100;
      const processedSongs: any[] = [];

      // Process songs in batches to prevent RAM spikes
      for (let i = 0; i < data.songs.length; i += BATCH_SIZE) {
        const batch = data.songs.slice(i, i + BATCH_SIZE);
        const processedBatch = batch.map((song: any) => {
          // Extract album art for separate storage
          if (song.albumArt) {
            albumArtsToSave.push({ songId: song.id, albumArt: song.albumArt });
          }

          return {
            ...song,
            hasStoredAudio: song.hasStoredAudio || false,
            hasAlbumArt: !!song.albumArt || song.hasAlbumArt || false,
            url: "", // Clear URL - will be created on-demand
            albumArt: undefined, // Don't store album art in library - load lazily
            embeddedLyrics: song.embeddedLyrics, // Preserve embedded lyrics
            encoding: song.encoding, // Preserve encoding
            gapless: song.gapless, // Preserve gapless flag
          };
        });
        processedSongs.push(...processedBatch);

        // Yield to main thread between batches for large libraries
        if (
          i + BATCH_SIZE < data.songs.length &&
          data.songs.length > BATCH_SIZE
        ) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Save album art separately in batches (don't block library save)
      if (albumArtsToSave.length > 0) {
        // Do this in background after library is saved
        setTimeout(async () => {
          try {
            const artDb = await openDatabase();
            const ART_BATCH_SIZE = 20; // Smaller batches for album art (they're big)

            for (let i = 0; i < albumArtsToSave.length; i += ART_BATCH_SIZE) {
              const artBatch = albumArtsToSave.slice(i, i + ART_BATCH_SIZE);
              const artTransaction = artDb.transaction(
                [STORES.ALBUM_ART],
                "readwrite",
              );
              const artStore = artTransaction.objectStore(STORES.ALBUM_ART);

              for (const art of artBatch) {
                artStore.put(art);
              }

              await new Promise<void>((resolve, reject) => {
                artTransaction.oncomplete = () => resolve();
                artTransaction.onerror = () => reject(artTransaction.error);
              });

              // Yield between batches
              if (i + ART_BATCH_SIZE < albumArtsToSave.length) {
                await new Promise((resolve) => setTimeout(resolve, 10));
              }
            }
            artDb.close();
            console.log(
              `Saved ${albumArtsToSave.length} album arts to IndexedDB`,
            );
          } catch (error) {
            console.error("Failed to save album art:", error);
          }
        }, 100);
      }

      // Save library without album art data
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      const processedData = {
        ...data,
        songs: processedSongs,
      };

      const savePromise = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        store.put({ id: key, data: processedData });
      });

      await savePromise;
      db.close();
      console.log(`Saved ${key} to IndexedDB`);
      return;
    }

    // Non-library data - save normally
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    // Create a promise that resolves when the transaction completes
    const savePromise = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      store.put({ id: key, data });
    });

    // Wait for transaction to complete before closing
    await savePromise;
    db.close();
    console.log(`Saved ${key} to IndexedDB`);
  } catch (error) {
    console.error(`Failed to save ${key} to IndexedDB:`, error);
    throw error;
  }
};

const loadFromIndexedDB = async (
  storeName: string,
  key: string,
): Promise<any> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);

    const result = await new Promise<any>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log(`Loaded ${key} from IndexedDB`);

    // If loading library data, create placeholder URLs for display
    if (key === "musicLibrary" && result?.songs) {
      // Ensure we have a songs array even if empty
      const rawSongs = result.songs || [];

      // Process songs in batches to prevent RAM spikes on large libraries
      const BATCH_SIZE = 100;
      const songsWithoutAudio: any[] = [];

      for (let i = 0; i < rawSongs.length; i += BATCH_SIZE) {
        const batch = rawSongs.slice(i, i + BATCH_SIZE);

        // Transform this batch - don't include albumArt, it will be loaded lazily
        const transformedBatch = batch.map((song: any) => {
          // Always set up the indexeddb URL if the song has stored audio
          const placeholderUrl = song.hasStoredAudio
            ? `indexeddb://${song.id}` // Will be loaded from IndexedDB
            : song.url || ""; // Keep original URL if no stored data, or empty if none

          return {
            // Ensure all required fields exist first
            id: song.id || `song-${Date.now()}-${Math.random()}`,
            title: song.title || i18n.t("common.unknownTitle"),
            artist: song.artist || i18n.t("common.unknownArtist"),
            album: song.album || i18n.t("common.unknownAlbum"),
            duration: song.duration || 0,
            // Then add the library-specific fields
            url: placeholderUrl,
            hasStoredAudio: song.hasStoredAudio || false,
            // DON'T load albumArt here - it will be lazy loaded on-demand
            // This is the key memory optimization - album art is loaded only when visible
            hasAlbumArt: song.hasAlbumArt || !!song.albumArt || false,
            albumArt: undefined, // Will be loaded lazily via loadAlbumArt()
            embeddedLyrics: song.embeddedLyrics, // Restore embedded lyrics
            encoding: song.encoding, // Restore encoding
            gapless: song.gapless, // Restore gapless flag
          };
        });

        songsWithoutAudio.push(...transformedBatch);

        // Yield to main thread between batches for large libraries
        if (i + BATCH_SIZE < rawSongs.length && rawSongs.length > BATCH_SIZE) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      return {
        songs: songsWithoutAudio,
        playlists: result.playlists || [],
        favorites: result.favorites || [],
      };
    }

    return result;
  } catch (error) {
    console.error(`Failed to load ${key} from IndexedDB:`, error);
    return null;
  }
};

// Add new type for song audio data
interface SongAudioData {
  fileData: ArrayBuffer;
  mimeType: string;
}

export const musicIndexedDbHelper = {
  async loadLibrary(): Promise<MusicLibrary | null> {
    try {
      const library = await loadFromIndexedDB(STORES.LIBRARY, "musicLibrary");
      console.log("Loaded library state:", {
        songCount: library?.songs?.length || 0,
        playlistCount: library?.playlists?.length || 0,
        favoriteCount: library?.favorites?.length || 0,
      });
      return library;
    } catch (error) {
      console.error("Failed to load library:", error);
      return {
        songs: [],
        playlists: [],
        favorites: [],
      };
    }
  },

  async saveLibrary(library: MusicLibrary): Promise<void> {
    await saveToIndexedDB(STORES.LIBRARY, "musicLibrary", library);
  },

  async loadSettings(): Promise<PlayerSettings | null> {
    return await loadFromIndexedDB(STORES.SETTINGS, "playerSettings");
  },

  async saveSettings(settings: PlayerSettings): Promise<void> {
    await saveToIndexedDB(STORES.SETTINGS, "playerSettings", settings);
  },

  async loadSongAudio(songId: string): Promise<SongAudioData | null> {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.AUDIO_DATA], "readwrite");
      const store = transaction.objectStore(STORES.AUDIO_DATA);

      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get(songId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (result) {
        // Update last accessed time
        store.put({
          ...result,
          lastAccessed: Date.now(),
        });

        return {
          fileData: result.fileData,
          mimeType: result.mimeType,
        };
      }

      db.close();
      return null;
    } catch (error) {
      console.error(`Failed to load audio data for song ${songId}:`, error);
      return null;
    }
  },

  async saveSongAudio(songId: string, audioData: SongAudioData): Promise<void> {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(
        [STORES.AUDIO_DATA, STORES.LIBRARY],
        "readwrite",
      );
      const audioStore = transaction.objectStore(STORES.AUDIO_DATA);
      const libraryStore = transaction.objectStore(STORES.LIBRARY);

      // Save audio data
      await new Promise<void>((resolve, reject) => {
        const request = audioStore.put({
          songId,
          fileData: audioData.fileData,
          mimeType: audioData.mimeType,
          lastAccessed: Date.now(),
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update song metadata to indicate audio is available
      const libraryData = await new Promise<any>((resolve, reject) => {
        const request = libraryStore.get("musicLibrary");
        request.onsuccess = () => resolve(request.result?.data);
        request.onerror = () => reject(request.error);
      });

      if (libraryData?.songs) {
        const updatedSongs = libraryData.songs.map((song: any) => {
          if (song.id === songId) {
            return {
              ...song,
              hasStoredAudio: true,
            };
          }
          return song;
        });

        await new Promise<void>((resolve, reject) => {
          const request = libraryStore.put({
            id: "musicLibrary",
            data: {
              ...libraryData,
              songs: updatedSongs,
            },
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      db.close();
    } catch (error) {
      console.error(`Failed to save audio data for song ${songId}:`, error);
      throw error;
    }
  },

  async removeSongAudio(songId: string): Promise<void> {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.AUDIO_DATA], "readwrite");
      const store = transaction.objectStore(STORES.AUDIO_DATA);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(songId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
    } catch (error) {
      console.error(`Failed to remove audio data for song ${songId}:`, error);
      throw error;
    }
  },

  async shouldShowDialog(dialogKey: string): Promise<boolean> {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.SETTINGS], "readonly");
      const store = transaction.objectStore(STORES.SETTINGS);

      const result = await new Promise<any>((resolve, reject) => {
        const request = store.get(`dialog-${dialogKey}`);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();
      // Return true if no preference is set (show by default), false if user chose not to show
      return result?.data?.dontShowAgain !== true;
    } catch (error) {
      console.error(
        `Failed to check dialog preference for ${dialogKey}:`,
        error,
      );
      return true; // Default to showing the dialog if there's an error
    }
  },

  async setDialogPreference(
    dialogKey: string,
    dontShowAgain: boolean,
  ): Promise<void> {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.SETTINGS], "readwrite");
      const store = transaction.objectStore(STORES.SETTINGS);

      await new Promise<void>((resolve, reject) => {
        const request = store.put({
          id: `dialog-${dialogKey}`,
          data: { dontShowAgain, timestamp: Date.now() },
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      console.log(
        `Saved dialog preference for ${dialogKey}: dontShowAgain=${dontShowAgain}`,
      );
    } catch (error) {
      console.error(
        `Failed to save dialog preference for ${dialogKey}:`,
        error,
      );
      throw error;
    }
  },

  // Lazy load album art for a single song
  async loadAlbumArt(songId: string): Promise<string | null> {
    // Check in-memory cache first
    if (albumArtCache.has(songId)) {
      return albumArtCache.get(songId)!;
    }

    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.ALBUM_ART], "readonly");
      const store = transaction.objectStore(STORES.ALBUM_ART);

      const result = await new Promise<
        { songId: string; albumArt: string } | undefined
      >((resolve, reject) => {
        const request = store.get(songId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();

      if (result?.albumArt) {
        // Cache in memory (with LRU eviction)
        if (albumArtCache.size >= MAX_ALBUM_ART_CACHE) {
          // Remove oldest entry (first key)
          const firstKey = albumArtCache.keys().next().value;
          if (firstKey) albumArtCache.delete(firstKey);
        }
        albumArtCache.set(songId, result.albumArt);
        return result.albumArt;
      }

      return null;
    } catch (error) {
      console.error(`Failed to load album art for ${songId}:`, error);
      return null;
    }
  },

  // Load album art for multiple songs at once (more efficient than one-by-one)
  async loadAlbumArtBatch(songIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const toLoad: string[] = [];

    // Check cache first
    for (const songId of songIds) {
      if (albumArtCache.has(songId)) {
        result.set(songId, albumArtCache.get(songId)!);
      } else {
        toLoad.push(songId);
      }
    }

    if (toLoad.length === 0) {
      return result;
    }

    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.ALBUM_ART], "readonly");
      const store = transaction.objectStore(STORES.ALBUM_ART);

      // Load all needed album arts in parallel
      const loadPromises = toLoad.map((songId) => {
        return new Promise<{ songId: string; albumArt: string } | null>(
          (resolve, reject) => {
            const request = store.get(songId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
          },
        );
      });

      const loadedArts = await Promise.all(loadPromises);
      db.close();

      // Process results and cache
      for (const art of loadedArts) {
        if (art?.albumArt) {
          // Cache with LRU eviction
          if (albumArtCache.size >= MAX_ALBUM_ART_CACHE) {
            const firstKey = albumArtCache.keys().next().value;
            if (firstKey) albumArtCache.delete(firstKey);
          }
          albumArtCache.set(art.songId, art.albumArt);
          result.set(art.songId, art.albumArt);
        }
      }

      return result;
    } catch (error) {
      console.error("Failed to load album art batch:", error);
      return result;
    }
  },

  // Save album art for a single song (used when adding new songs)
  async saveAlbumArt(songId: string, albumArt: string): Promise<void> {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.ALBUM_ART], "readwrite");
      const store = transaction.objectStore(STORES.ALBUM_ART);

      await new Promise<void>((resolve, reject) => {
        const request = store.put({ songId, albumArt });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();

      // Update cache
      if (albumArtCache.size >= MAX_ALBUM_ART_CACHE) {
        const firstKey = albumArtCache.keys().next().value;
        if (firstKey) albumArtCache.delete(firstKey);
      }
      albumArtCache.set(songId, albumArt);
    } catch (error) {
      console.error(`Failed to save album art for ${songId}:`, error);
    }
  },

  // Clear album art cache to free memory
  clearAlbumArtCache(): void {
    albumArtCache.clear();
  },
};

export default musicIndexedDbHelper;

export async function resetAllDialogPreferences(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORES.SETTINGS], "readwrite");
    const store = transaction.objectStore(STORES.SETTINGS);
    // Get all keys
    const keys = await new Promise<string[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
    // Delete all dialog-* keys
    await Promise.all(
      keys
        .filter((key) => key.startsWith("dialog-"))
        .map((key) => {
          return new Promise<void>((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }),
    );
    db.close();
  } catch (error) {
    console.error("Failed to reset dialog preferences:", error);
    throw error;
  }
}
