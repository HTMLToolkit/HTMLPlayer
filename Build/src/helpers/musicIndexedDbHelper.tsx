import { MusicLibrary, PlayerSettings } from './musicPlayerHook';

// IndexedDB configuration
const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 1;
const STORES = {
  LIBRARY: 'library',
  SETTINGS: 'settings',
} as const;

// IndexedDB utilities
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.LIBRARY)) {
        db.createObjectStore(STORES.LIBRARY, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }
    };
  });
};

const saveToIndexedDB = async (storeName: string, key: string, data: any): Promise<void> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // If saving library data, prepare songs with file data for storage
    let processedData = data;
    if (key === 'musicLibrary' && data?.songs) {
      processedData = {
        ...data,
        songs: await Promise.all(data.songs.map(async (song: any) => {
          if (song.url.startsWith('blob:') && !song.fileData) {
            try {
              // Convert blob URL to ArrayBuffer for storage
              const response = await fetch(song.url);
              const arrayBuffer = await response.arrayBuffer();
              return {
                ...song,
                fileData: arrayBuffer,
                mimeType: response.headers.get('content-type') || 'audio/mpeg'
              };
            } catch (error) {
              console.warn(`Failed to convert blob URL to file data for song: ${song.title}`, error);
              return song;
            }
          }
          return song;
        }))
      };
    }
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ id: key, data: processedData });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log(`Saved ${key} to IndexedDB`);
  } catch (error) {
    console.error(`Failed to save ${key} to IndexedDB:`, error);
    throw error;
  }
};

const loadFromIndexedDB = async (storeName: string, key: string): Promise<any> => {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    const result = await new Promise<any>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.data);
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log(`Loaded ${key} from IndexedDB`);
    
    // If loading library data, recreate blob URLs from stored file data
    if (key === 'musicLibrary' && result?.songs) {
      const restoredSongs = result.songs.map((song: any) => {
        if (song.fileData && song.mimeType) {
          return {
            ...song,
            url: '' // defer to musicPlayerHook for blob creation
          };
        }
        return song;
      });

      return {
        ...result,
        songs: restoredSongs
      };
    }
    
    return result;
  } catch (error) {
    console.error(`Failed to load ${key} from IndexedDB:`, error);
    return null;
  }
};

export const musicIndexedDbHelper = {
  async loadLibrary(): Promise<MusicLibrary | null> {
    return await loadFromIndexedDB(STORES.LIBRARY, 'musicLibrary');
  },

  async saveLibrary(library: MusicLibrary): Promise<void> {
    await saveToIndexedDB(STORES.LIBRARY, 'musicLibrary', library);
  },

  async loadSettings(): Promise<PlayerSettings | null> {
    return await loadFromIndexedDB(STORES.SETTINGS, 'playerSettings');
  },

  async saveSettings(settings: PlayerSettings): Promise<void> {
    await saveToIndexedDB(STORES.SETTINGS, 'playerSettings', settings);
  }
};