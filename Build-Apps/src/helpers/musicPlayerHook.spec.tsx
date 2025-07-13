import { renderHook, act, waitFor } from '@testing-library/react';
import { useMusicPlayer, Song } from './musicPlayerHook';

describe('useMusicPlayer', () => {
  let mockAudio: {
    play: jasmine.Spy;
    pause: jasmine.Spy;
    addEventListener: jasmine.Spy;
    removeEventListener: jasmine.Spy;
    src: string;
    volume: number;
    currentTime: number;
    duration: number;
  };

  let originalIndexedDB: IDBFactory;

  beforeEach(() => {
    mockAudio = {
      play: jasmine.createSpy('play').and.returnValue(Promise.resolve()),
      pause: jasmine.createSpy('pause'),
      addEventListener: jasmine.createSpy('addEventListener'),
      removeEventListener: jasmine.createSpy('removeEventListener'),
      src: '',
      volume: 1,
      currentTime: 0,
      duration: 0,
    };

    // Mock AudioContext and createMediaElementSource
    const mockAudioContext = {
      createAnalyser: jasmine.createSpy('createAnalyser').and.returnValue({
        fftSize: 2048,
        connect: jasmine.createSpy('connect')
      }),
      createMediaElementSource: jasmine.createSpy('createMediaElementSource').and.returnValue({
        connect: jasmine.createSpy('connect')
      }),
      destination: {},
      state: 'running',
      resume: jasmine.createSpy('resume').and.returnValue(Promise.resolve())
    };

    spyOn(window, 'AudioContext').and.returnValue(mockAudioContext as any);
    (window as any).webkitAudioContext = window.AudioContext;
    
    spyOn(window, 'Audio').and.returnValue(mockAudio as any);
    
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
                      result: null
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
              mockRequest.onsuccess({ target: mockRequest } as any);
            }
          }, 0);
        
        return mockRequest;
      })
    };

    // Replace IndexedDB with mock using Object.defineProperty
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

  it('should initialize with default state', async () => {
    const { result } = renderHook(() => useMusicPlayer());

    expect(result.current.playerState.currentSong).toBe(null);
    expect(result.current.playerState.isPlaying).toBe(false);
    expect(result.current.playerState.volume).toBe(0.75);
    expect(result.current.library.songs).toEqual([]);
    expect(result.current.library.playlists).toEqual([]);
    expect(result.current.library.favorites).toEqual([]);
    expect(result.current.isInitialized).toBe(false);

    // Wait for initialization to complete
    await waitFor(() => {
      if (!result.current.isInitialized) {
        throw new Error('Expected isInitialized to be true');
      }
    });
  });

  it('should play a song', async () => {
    const { result } = renderHook(() => useMusicPlayer());
    const testSong: Song = {
      id: '1',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      url: 'http://example.com/song.mp3',
    };

    await act(async () => {
      result.current.playSong(testSong);
    });

    expect(result.current.playerState.currentSong).toEqual(testSong);
    expect(result.current.playerState.isPlaying).toBe(true);
    expect(mockAudio.play).toHaveBeenCalled();
  });

  it('should toggle play/pause', async () => {
    const { result } = renderHook(() => useMusicPlayer());
    const testSong: Song = {
      id: '1',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      url: 'http://example.com/song.mp3',
    };

    // First play a song
    await act(async () => {
      result.current.playSong(testSong);
    });

    expect(result.current.playerState.isPlaying).toBe(true);

    // Then pause
    await act(async () => {
      result.current.togglePlayPause();
    });

    expect(result.current.playerState.isPlaying).toBe(false);
    expect(mockAudio.pause).toHaveBeenCalled();

    // Then play again
    await act(async () => {
      result.current.togglePlayPause();
    });

    expect(result.current.playerState.isPlaying).toBe(true);
    expect(mockAudio.play).toHaveBeenCalledTimes(2);
  });

  it('should set volume', () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(result.current.playerState.volume).toBe(0.5);
    expect(mockAudio.volume).toBe(0.5);
  });

  it('should clamp volume between 0 and 1', () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => {
      result.current.setVolume(-0.5);
    });

    expect(result.current.playerState.volume).toBe(0);

    act(() => {
      result.current.setVolume(1.5);
    });

    expect(result.current.playerState.volume).toBe(1);
  });

  it('should add and remove songs from library', async () => {
    const { result } = renderHook(() => useMusicPlayer());
    const testSong: Song = {
      id: '1',
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album',
      duration: 180,
      url: 'http://example.com/song.mp3',
    };

    await act(async () => {
      await result.current.addSong(testSong);
    });

    expect(result.current.library.songs).toContain(testSong);

    act(() => {
      result.current.removeSong('1');
    });

    expect(result.current.library.songs).not.toContain(testSong);
  });

  it('should manage favorites', () => {
    const { result } = renderHook(() => useMusicPlayer());

    act(() => {
      result.current.addToFavorites('1');
    });

    expect(result.current.library.favorites).toContain('1');
    expect(result.current.isFavorited('1')).toBe(true);

    act(() => {
      result.current.removeFromFavorites('1');
    });

    expect(result.current.library.favorites).not.toContain('1');
    expect(result.current.isFavorited('1')).toBe(false);
  });

  it('should toggle favorites', () => {
    const { result } = renderHook(() => useMusicPlayer());

    let wasAdded = false;
    act(() => {
      wasAdded = result.current.toggleFavorite('1');
    });

    expect(wasAdded).toBe(true);
    expect(result.current.library.favorites).toContain('1');

    act(() => {
      wasAdded = result.current.toggleFavorite('1');
    });

    expect(wasAdded).toBe(false);
    expect(result.current.library.favorites).not.toContain('1');
  });

  it('should get favorite songs', () => {
    const { result } = renderHook(() => useMusicPlayer());
    const testSongs: Song[] = [
      {
        id: '1',
        title: 'Favorite Song',
        artist: 'Artist 1',
        album: 'Album 1',
        duration: 180,
        url: 'http://example.com/song1.mp3',
      },
      {
        id: '2',
        title: 'Regular Song',
        artist: 'Artist 2',
        album: 'Album 2',
        duration: 200,
        url: 'http://example.com/song2.mp3',
      },
    ];

    act(() => {
      testSongs.forEach(song => result.current.addSong(song));
      result.current.addToFavorites('1');
    });

    const favoriteSongs = result.current.getFavoriteSongs();
    expect(favoriteSongs).toHaveSize(1);
    expect(favoriteSongs[0].id).toBe('1');
    expect(favoriteSongs[0].title).toBe('Favorite Song');
  });

  it('should search songs', () => {
    const { result } = renderHook(() => useMusicPlayer());
    const testSongs: Song[] = [
      {
        id: '1',
        title: 'Rock Song',
        artist: 'Rock Artist',
        album: 'Rock Album',
        duration: 180,
        url: 'http://example.com/rock.mp3',
      },
      {
        id: '2',
        title: 'Pop Song',
        artist: 'Pop Artist',
        album: 'Pop Album',
        duration: 200,
        url: 'http://example.com/pop.mp3',
      },
    ];

    act(() => {
      testSongs.forEach(song => result.current.addSong(song));
    });

    const results = result.current.searchSongs('rock');
    expect(results).toHaveSize(1);
    expect(results[0].title).toBe('Rock Song');
  });

  it('should create and remove playlists', () => {
    const { result } = renderHook(() => useMusicPlayer());

    let playlist: any;
    act(() => {
      playlist = result.current.createPlaylist('Test Playlist');
    });

    expect(result.current.library.playlists).toHaveSize(1);
    expect(result.current.library.playlists[0].name).toBe('Test Playlist');

    act(() => {
      result.current.removePlaylist(playlist.id);
    });

    expect(result.current.library.playlists).toHaveSize(0);
  });
});