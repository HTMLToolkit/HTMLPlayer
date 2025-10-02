// IndexedDB configuration
import i18n from "i18next";

const DB_NAME = "HTMLPlayerDB";
const DB_VERSION = 1; // set back to 1 as new name/db
const STORES = {
  LIBRARY: "library",
  SETTINGS: "settings",
  AUDIO_DATA: "audioData", // New store for actual audio data
} as const;

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

      // Move existing audio data to new store if upgrading
      if (oldVersion < 2) {
        // Ensure we have a transaction to work with
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (transaction) {
          const libraryStore = transaction.objectStore(STORES.LIBRARY);
          const audioStore = transaction.objectStore(STORES.AUDIO_DATA);

          libraryStore.get("musicLibrary").onsuccess = function (e: any) {
            const library = e.target.result?.data;
            if (library?.songs) {
              library.songs.forEach((song: any) => {
                if (song.fileData && song.mimeType) {
                  audioStore.add({
                    songId: song.id,
                    fileData: song.fileData,
                    mimeType: song.mimeType,
                    lastAccessed: Date.now(),
                  });
                  // Clean up song data
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
  data: any
): Promise<void> => {
  try {
    // First, get existing data if needed
    if (key === "musicLibrary" && data?.songs) {
    }

    // Open new transaction after loading existing data
    const db = await openDatabase();
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    // Process the data
    let processedData = data;
    if (key === "musicLibrary" && data?.songs) {
      processedData = {
        ...data,
        songs: data.songs.map((song: any) => ({
          ...song,
          hasStoredAudio: song.hasStoredAudio || false,
          url: "", // Clear URL - will be created on-demand
          albumArt: song.albumArt, // Preserve album art data
        })),
      };
    }

    // Create a promise that resolves when the transaction completes
    const savePromise = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      store.put({ id: key, data: processedData });
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
  key: string
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
      result.songs = result.songs || [];

      // Transform the songs to include proper URLs and metadata
      const songsWithoutAudio = result.songs.map((song: any) => {
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
          albumArt: song.albumArt, // Keep album art when loading
        };
      });

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
        "readwrite"
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
};
