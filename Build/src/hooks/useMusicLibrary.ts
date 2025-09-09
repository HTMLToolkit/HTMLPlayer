import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { musicIndexedDbHelper } from "../helpers/musicIndexedDbHelper";
import { MusicLibrary } from "../types/MusicLibrary";
import { Playlist } from "../types/Playlist";
import { Song } from "../types/Song";
import { useSongCache } from "./useSongCache";
import { useAudioPlayback } from "./useAudioPlayback";
import { usePlayerSettings } from "./usePlayerSettings";
import { debounce } from "lodash";

export const useMusicLibrary = () => {
  console.log("useMusicLibrary called.");
  
  const songCache = useSongCache();
  const audioPlayback = useAudioPlayback();
  const playerSettings = usePlayerSettings();

  const [isInitialized, setIsInitialized] = useState(false);

  const [library, setLibrary] = useState<MusicLibrary>(() => ({
    songs: [],
    playlists: [],
    favorites: [],
  }));

  const libraryRef = useRef(library);

  const processAudioBatch = useCallback(
    async (songs: Song[]): Promise<Song[]> => {
      const processedSongs: Song[] = [];
      const totalSongs = songs.length;
      let processedCount = 0;

      // Show initial toast
      const toastId = toast.loading(`Processing 0/${totalSongs} songs...`);

      for (const song of songs) {
        if (song.url.startsWith("blob:")) {
          try {
            // Load the audio data
            const res = await fetch(song.url);
            const buf = await res.arrayBuffer();
            const mimeType = res.headers.get("content-type") || "audio/mpeg";

            // Save to IndexedDB audio store
            await musicIndexedDbHelper.saveSongAudio(song.id, {
              fileData: buf,
              mimeType,
            });

            // Add processed song without the audio data
            processedSongs.push({
              ...song,
              hasStoredAudio: true,
              albumArt: song.albumArt, // Preserve album art when processing
            });

            processedCount++;
            // Update toast with progress
            toast.loading(
              `Processing ${processedCount}/${totalSongs} songs...`,
              {
                id: toastId,
                description: `Current: ${song.title}`,
              }
            );
          } catch (error) {
            const err = error as Error;
            console.error(
              `Failed to process audio for song: ${song.title}`,
              err
            );
            toast.error(`Failed to process "${song.title}"`, {
              description: err.message || "Unknown error occurred",
            });
            processedSongs.push(song);
          }
        } else {
          processedSongs.push(song);
          processedCount++;
        }
      }

      // Show completion toast
      toast.success(`Processed ${processedCount} songs`, {
        id: toastId,
      });

      return processedSongs;
    },
    []
  );

  const addSong = useCallback(
    async (songs: Song[]) => {
      // First, update library synchronously with all songs
      setLibrary((prev) => {
        const newSongs = [...prev.songs, ...songs];
        const allSongsPlaylistExists = prev.playlists.some(
          (p) => p.id === "all-songs"
        );

        let newPlaylists = prev.playlists.map((p) =>
          p.id === "all-songs"
            ? { ...p, songs: songCache.memoizedPrepareSongsForPlaylist(newSongs) }
            : p
        );

        if (!allSongsPlaylistExists) {
          newPlaylists = [
            {
              id: "all-songs",
              name: "All Songs",
              songs: songCache.memoizedPrepareSongsForPlaylist(newSongs),
            },
            ...newPlaylists,
          ];
        }
        return {
          ...prev,
          songs: newSongs,
          playlists: newPlaylists,
        };
      });

      // Then, process audio data in batches in the background
      try {
        const processedSongs = await processAudioBatch(songs);

        // Update the library with processed versions
        setLibrary((prev) => {
          const newSongs = prev.songs.map((existingSong) => {
            const processedSong = processedSongs.find(
              (p) => p.id === existingSong.id
            );
            return processedSong || existingSong;
          });

          return {
            ...prev,
            songs: newSongs,
            playlists: prev.playlists.map((p) =>
              p.id === "all-songs"
                ? { ...p, songs: songCache.memoizedPrepareSongsForPlaylist(newSongs) }
                : p
            ),
          };
        });
      } catch (error) {
        console.error("Failed to process songs batch:", error);
        toast.error("Failed to process some songs", {
          description: (error as Error).message || "Unknown error occurred",
        });
      }
    },
    [processAudioBatch, songCache.memoizedPrepareSongsForPlaylist]
  );

  const removeSong = useCallback(async (songId: string) => {
    // First, update library synchronously
    setLibrary((prev) => {
      const newSongs = prev.songs.filter((s) => s.id !== songId);
      const newPlaylists = prev.playlists.map((p) => ({
        ...p,
        songs: p.songs.filter((s: { id: string; }) => s.id !== songId),
      }));
      return {
        ...prev,
        songs: newSongs,
        playlists: newPlaylists,
        favorites: prev.favorites.filter((id) => id !== songId),
      };
    });

    // Then, remove the audio data from IndexedDB asynchronously
    try {
      await musicIndexedDbHelper.removeSongAudio(songId);
    } catch (error) {
      console.error("Failed to remove song audio from IndexedDB:", error);
    }
  }, []);

  const createPlaylist = useCallback(
    (name: string, songs: Song[] = []) => {
      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name,
        songs: songCache.memoizedPrepareSongsForPlaylist(songs),
      };
      setLibrary((prev) => ({
        ...prev,
        playlists: [...prev.playlists, newPlaylist],
      }));
      return newPlaylist;
    },
    [songCache.memoizedPrepareSongsForPlaylist]
  );

  const removePlaylist = useCallback((playlistId: string) => {
    setLibrary((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== playlistId),
    }));
  }, []);

  const addToFavorites = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(songId)
        ? prev.favorites
        : [...prev.favorites, songId],
    }));
  }, []);

  const removeFromFavorites = useCallback((songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((id) => id !== songId),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, songId: string) => {
    setLibrary((prev) => {
      // Find the song and playlist
      const song = prev.songs.find((s) => s.id === songId);
      if (!song) return prev;

      return {
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id === playlistId) {
            // Don't add if song is already in playlist
            if (p.songs.some((s: { id: string; }) => s.id === songId)) return p;
            return {
              ...p,
              songs: [...p.songs, song],
            };
          }
          return p;
        }),
      };
    });
  }, []);

  const toggleFavorite = useCallback(
    (songId: string) => {
      const isFav = library.favorites.includes(songId);
      if (isFav) removeFromFavorites(songId);
      else addToFavorites(songId);
      return !isFav;
    },
    [library.favorites, addToFavorites, removeFromFavorites]
  );

  const isFavorited = useCallback(
    (songId: string) => {
      return library.favorites.includes(songId);
    },
    [library.favorites]
  );

  const getFavoriteSongs = useCallback(() => {
    return library.songs.filter((s) => library.favorites.includes(s.id));
  }, [library]);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const persistedLibrary = await musicIndexedDbHelper.loadLibrary();
        const persistedSettings = await musicIndexedDbHelper.loadSettings();

        if (persistedLibrary) {
          const validLibrary = {
            ...persistedLibrary,
            songs: persistedLibrary.songs.filter(
              (song: Song) => song.url && song.url !== ""
            ),
          };
          // Create or ensure All Songs playlist exists with prepared songs
          const allSongsPlaylist = {
            id: "all-songs",
            name: "All Songs",
            songs: songCache.memoizedPrepareSongsForPlaylist(validLibrary.songs),
          };

          // Add or update All Songs playlist
          const updatedLibrary = {
            ...validLibrary,
            playlists: validLibrary.playlists.some((p: { id: string; }) => p.id === "all-songs")
              ? validLibrary.playlists.map((p: { id: string; }) =>
                p.id === "all-songs"
                  ? {
                    ...p,
                    songs: songCache.memoizedPrepareSongsForPlaylist(validLibrary.songs),
                  }
                  : p
              )
              : [allSongsPlaylist, ...validLibrary.playlists],
          };

          setLibrary(updatedLibrary);

          let songToPlay: Song | null = null;
          let playlistToSet: Playlist | null = null;

          if (persistedSettings?.lastPlayedSongId) {
            songToPlay =
              updatedLibrary.songs.find(
                (s: { id: any; }) => s.id === persistedSettings.lastPlayedSongId
              ) || null;
          }
          if (persistedSettings?.lastPlayedPlaylistId) {
            playlistToSet =
              updatedLibrary.playlists.find(
                (p: { id: any; }) => p.id === persistedSettings.lastPlayedPlaylistId
              ) || null;
          }

          // Default to All Songs playlist if none set or if last played playlist doesn't exist
          if (
            !playlistToSet ||
            !playlistToSet.songs ||
            playlistToSet.songs.length === 0
          ) {
            playlistToSet = allSongsPlaylist;
          }

          // If no song set but we have songs, play the first one from the current playlist
          if (!songToPlay && playlistToSet.songs.length > 0) {
            songToPlay = playlistToSet.songs[0];
          }

          audioPlayback.setPlayerState((prev: any) => ({
            ...prev,
            currentSong: songToPlay,
            currentPlaylist: playlistToSet,
            isPlaying: false,
            currentTime: 0,
            duration: songToPlay?.duration || 0,
          }));
        }

        if (persistedSettings) playerSettings.setSettings(persistedSettings);
      } catch (error) {
        console.error("Failed to load persisted data:", error);
      } finally {
        setIsInitialized(true);
      }
    };
    loadPersistedData();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const saveLibrary = async () => {
      try {
        await musicIndexedDbHelper.saveLibrary(library);
      } catch (error) {
        console.error("Failed to persist library data:", error);
      }
    };
    saveLibrary();
  }, [library, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const updatePlayerState = debounce((updatedPlaylist: Playlist) => {
      console.log("useMusicLibrary: Updating playerState.currentPlaylist", {
        playlistId: updatedPlaylist.id,
        songs: updatedPlaylist.songs.map((s) => s.id),
      });
      
      audioPlayback.setPlayerState((prev: any) => ({
        ...prev,
        currentPlaylist: updatedPlaylist,
      }));
    }, 100);

    if (audioPlayback.playerState.currentPlaylist) {
      const updatedPlaylist = library.playlists.find(
        (p) => p.id === audioPlayback.playerState.currentPlaylist?.id
      );
      if (updatedPlaylist) {
        const areSongsEqual =
          updatedPlaylist.songs.length ===
          audioPlayback.playerState.currentPlaylist.songs.length &&
          updatedPlaylist.songs.every((song: { id: any; url: any; }, index: string | number) =>
            song.id === audioPlayback.playerState.currentPlaylist.songs[index].id &&
            song.url === audioPlayback.playerState.currentPlaylist.songs[index].url
          );
        if (!areSongsEqual) {
          updatePlayerState(updatedPlaylist);
        }
      }
    }

    return () => {
      updatePlayerState.cancel();
    };
  }, [library.playlists, audioPlayback.playerState.currentPlaylist?.id, isInitialized]);
  return {
    library,
    setLibrary,
    addSong,
    removeSong,
    createPlaylist,
    removePlaylist,
    addToFavorites,
    removeFromFavorites,
    addToPlaylist,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    isInitialized,
  };
};
