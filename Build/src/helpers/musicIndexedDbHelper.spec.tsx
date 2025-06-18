import { musicIndexedDbHelper } from './musicIndexedDbHelper';
import { MusicLibrary, PlayerSettings } from './musicPlayerHook';

describe('musicIndexedDbHelper', () => {
  let originalIndexedDB: IDBFactory;

  beforeEach(() => {
    // Store original IndexedDB
    originalIndexedDB = window.indexedDB;
    
    // Create mock IndexedDB implementation
    const mockIndexedDB = {
      open: jasmine.createSpy('open').and.callFake(() => {
        const mockRequest = {
          onsuccess: null as any,
          onerror: null as any,
          onupgradeneeded: null as any,
          result: {
            objectStoreNames: { 
              contains: jasmine.createSpy('contains').and.returnValue(false) 
            },
            createObjectStore: jasmine.createSpy('createObjectStore'),
            transaction: jasmine.createSpy('transaction').and.returnValue({
              objectStore: jasmine.createSpy('objectStore').and.returnValue({
                get: jasmine.createSpy('get').and.callFake(() => {
                  const getRequest = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: { data: { songs: [], playlists: [], favorites: [] } }
                  };
                  setTimeout(() => {
                    if (getRequest.onsuccess) {
                      getRequest.onsuccess();
                    }
                  }, 0);
                  return getRequest;
                }),
                put: jasmine.createSpy('put').and.callFake(() => {
                  const putRequest = {
                    onsuccess: null as any,
                    onerror: null as any
                  };
                  setTimeout(() => {
                    if (putRequest.onsuccess) {
                      putRequest.onsuccess();
                    }
                  }, 0);
                  return putRequest;
                })
              })
            }),
            close: jasmine.createSpy('close')
          }
        };
        
        // Simulate successful database opening and upgrade
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.onupgradeneeded({ target: mockRequest } as any);
          }
          if (mockRequest.onsuccess) {
            mockRequest.onsuccess();
          }
        }, 0);
      
        return mockRequest;
      })
    };

    // Replace IndexedDB with mock
    Object.defineProperty(window, 'indexedDB', {
      value: mockIndexedDB,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Restore original IndexedDB
    Object.defineProperty(window, 'indexedDB', {
      value: originalIndexedDB,
      writable: true,
      configurable: true
    });
  });

  it('should load library data from IndexedDB', async () => {
    const result = await musicIndexedDbHelper.loadLibrary();
    
    expect(result).toEqual({ songs: [], playlists: [], favorites: [] });
  });

  it('should save library data to IndexedDB', async () => {
    const testLibrary: MusicLibrary = {
      songs: [],
      playlists: [],
      favorites: []
    };

    await musicIndexedDbHelper.saveLibrary(testLibrary);
    
    // Verify no errors were thrown
    expect(true).toBe(true);
  });

  it('should save settings to IndexedDB', async () => {
    const testSettings: PlayerSettings = {
      volume: 0.8,
      audioQuality: 'high',
      crossfade: 3,
      defaultShuffle: false,
      defaultRepeat: 'off',
      autoPlayNext: true,
      compactMode: false,
      showAlbumArt: true,
      showLyrics: false,
    };

    await musicIndexedDbHelper.saveSettings(testSettings);
    
    // Verify no errors were thrown
    expect(true).toBe(true);
  });
});