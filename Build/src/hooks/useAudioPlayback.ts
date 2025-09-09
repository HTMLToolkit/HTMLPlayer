import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayerState } from "../types/PlayerState";
import { Playlist } from "../types/Playlist";
import { Song } from "../types/Song";
import { PlayerSettings } from "../types/PlayerSettings";

// Define interfaces for dependencies to avoid circular imports
interface SongCacheInterface {
  cacheSong: (song: Song) => Promise<void>;
  getCachedSong: (songId: string) => { song: Song; url: string } | undefined;
  updateSongCache: (song: Song | null, playlist: Playlist | null, shuffle: boolean) => Promise<void>;
  memoizedPrepareSongsForPlaylist: (songs: Song[]) => Song[];
}

interface MusicLibraryInterface {
  setLibrary: React.Dispatch<React.SetStateAction<any>>;
}

interface PlayerSettingsInterface {
  settings: PlayerSettings;
  settingsRef: React.RefObject<PlayerSettings>;
  setSettings: (settings: Partial<PlayerSettings>) => void;
  isInitialized: boolean;
}

export const useAudioPlayback = (
  songCache: SongCacheInterface,
  musicLibrary: MusicLibraryInterface,
  playerSettings: PlayerSettingsInterface
) => {
  const instantiationRef = useRef(false);
  if (instantiationRef.current) {
    console.warn("useAudioPlayback: Attempted re-instantiation, preventing loop");
    throw new Error("Preventing recursive useAudioPlayback instantiation");
  }
  instantiationRef.current = true;
  console.log("useAudioPlayback: Instantiated");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const playNextRef = useRef<(() => void) | null>(null);
  
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentSong: null,
    currentPlaylist: null,
    isPlaying: false,
    volume: 0.75,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: "off",
    analyserNode: null,
    view: "songs",
  });
  
  const playerStateRef = useRef(playerState);

  const setupAudioContext = useCallback(() => {
    console.log("useAudioPlayback: setupAudioContext called");
    if (!audioContextRef.current && audioRef.current) {
      const context = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = context.createMediaElementSource(
          audioRef.current
        );
      }

      sourceNodeRef.current.connect(analyser);
      analyser.connect(context.destination);

      audioContextRef.current = context;
      setPlayerState((prev) => ({ ...prev, analyserNode: analyser }));
    }
  }, []);

  const playSong = useCallback(
    async (song: Song, playlist?: Playlist) => {
      console.log("useAudioPlayback: playSong called", { songId: song.id, playlistId: playlist?.id });
      // Even if URL is empty, we might have it in IndexedDB
      if (!song.url && !song.hasStoredAudio) {
        console.error("useAudioPlayback: No URL or stored audio available for song:", song);
        toast.error(`Cannot play "${song.title}" - No audio source available`);
        return;
      }

      if (!audioContextRef.current) setupAudioContext();
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }

      // Prepare song for playing, handling both IndexedDB and direct URLs
      const songToPlay = song.hasStoredAudio
        ? {
            ...song,
            url: `indexeddb://${song.id}`,
          }
        : song;

      // First ensure the song is cached
      await songCache.cacheSong(songToPlay);
      const cachedSong = songCache.getCachedSong(song.id);
      if (!cachedSong) {
        console.error("useAudioPlayback: Failed to play song: could not cache");
        return;
      }

      // Prepare playlist songs if setting a new playlist
      const preparedPlaylist = playlist
        ? {
            ...playlist,
            songs: songCache.memoizedPrepareSongsForPlaylist(playlist.songs),
          }
        : playerStateRef.current.currentPlaylist;

      setPlayerState((prev) => ({
        ...prev,
        currentSong: song,
        currentPlaylist: preparedPlaylist,
        isPlaying: true,
        currentTime: 0,
      }));

      if (audioRef.current) {
        // Use the cached URL instead of the original URL
        audioRef.current.src = cachedSong.url;
        try {
          await audioRef.current.play().catch(async (error: any) => {
            if (
              error.name === "NotSupportedError" &&
              song.fileData &&
              song.mimeType
            ) {
              try {
                const blob = new Blob([song.fileData], { type: song.mimeType });
                const newUrl = URL.createObjectURL(blob);
                const updatedSong = { ...song, url: newUrl };

                setPlayerState((prev) => ({
                  ...prev,
                  currentSong: updatedSong,
                }));
                musicLibrary.setLibrary((prev: { songs: any[]; }) => ({
                  ...prev,
                  songs: prev.songs.map((s: { id: string; }) =>
                    s.id === song.id ? updatedSong : s
                  ),
                }));

                audioRef.current!.src = newUrl;
                await audioRef.current!.play();
              } catch {
                setPlayerState((prev) => ({ ...prev, isPlaying: false }));
              }
            } else {
              console.error("useAudioPlayback: Failed to play song:", error);
              toast.error(`Failed to play "${song.title}"`, {
                description: error.message || "Unknown error occurred",
              });
              setPlayerState((prev) => ({ ...prev, isPlaying: false }));
            }
          });
        } catch (error: any) {
          console.error("useAudioPlayback: Failed to play song:", error);
          toast.error(`Failed to play "${song.title}"`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
        }

        // Update the cache for surrounding songs and next shuffled song
        if (playlist) {
          console.log("useAudioPlayback: Updating song cache in playSong");
          songCache.updateSongCache(song, playlist, playerState.shuffle);
        }
      }
    },
    [setupAudioContext, songCache, musicLibrary, playerState.shuffle]
  );

  const togglePlayPause = useCallback(() => {
    console.log("useAudioPlayback: togglePlayPause called", { isPlaying: playerState.isPlaying });
    if (!audioRef.current || !playerState.currentSong) return;
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    if (playerState.isPlaying) {
      audioRef.current.pause();
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      audioRef.current
        .play()
        .catch(() => setPlayerState((prev) => ({ ...prev, isPlaying: false })));
      setPlayerState((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.isPlaying, playerState.currentSong]);

  const playNext = useCallback(() => {
    console.log("useAudioPlayback: playNext called");
    if (!playerState.currentPlaylist || !playerState.currentSong) return;
    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s: { id: any }) => s.id === playerState.currentSong!.id
    );

    if (playerState.shuffle) {
      const available = songs.filter(
        (s: { id: any }) => s.id !== playerState.currentSong!.id
      );
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], playerState.currentPlaylist);
      }
    } else {
      if (currentIndex < songs.length - 1) {
        playSong(songs[currentIndex + 1], playerState.currentPlaylist);
      } else if (playerState.repeat === "all") {
        playSong(songs[0], playerState.currentPlaylist);
      }
    }
  }, [playerState, playSong]);

  const playPrevious = useCallback(() => {
    console.log("useAudioPlayback: playPrevious called");
    if (!playerState.currentPlaylist || !playerState.currentSong) return;
    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s: { id: any }) => s.id === playerState.currentSong!.id
    );

    if (playerState.shuffle) {
      const available = songs.filter(
        (s: { id: any }) => s.id !== playerState.currentSong!.id
      );
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], playerState.currentPlaylist);
      }
    } else {
      if (currentIndex > 0) {
        playSong(songs[currentIndex - 1], playerState.currentPlaylist);
      } else if (playerState.repeat === "all") {
        playSong(songs[songs.length - 1], playerState.currentPlaylist);
      }
    }
  }, [playerState, playSong]);

  const setVolume = useCallback((volume: number) => {
    console.log("useAudioPlayback: setVolume called", { volume });
    const clamped = Math.max(0, Math.min(1, volume));
    playerSettings.setSettings({ volume: clamped });
    if (audioRef.current) audioRef.current.volume = clamped;
  }, [playerSettings]);

  const toggleShuffle = useCallback(() => {
    console.log("useAudioPlayback: toggleShuffle called");
    setPlayerState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    console.log("useAudioPlayback: toggleRepeat called");
    setPlayerState((prev) => ({
      ...prev,
      repeat:
        prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const seekTo = useCallback((time: number) => {
    console.log("useAudioPlayback: seekTo called", { time });
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState((prev) => ({ ...prev, currentTime: time }));
    }
  }, []);

  useEffect(() => {
    console.log("useAudioPlayback: Audio setup useEffect triggered");
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.controls = true;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      setPlayerState((prev) => ({
        ...prev,
        currentTime: audio.currentTime,
      }));
    };

    const handleLoadedMetadata = () => {
      setPlayerState((prev) => ({
        ...prev,
        duration: audio.duration,
      }));
    };

    const handleEnded = () => {
      console.log("useAudioPlayback: handleEnded triggered");
      if (playerSettings.settingsRef.current?.autoPlayNext) {
        if (playerStateRef.current.repeat === "one") {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          }
        } else if (playNextRef.current) {
          playNextRef.current();
        }
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      console.log("useAudioPlayback: Cleaning up audio useEffect");
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, [playerSettings]);

  useEffect(() => {
    console.log("useAudioPlayback: playerStateRef update useEffect triggered");
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    console.log("useAudioPlayback: Volume sync useEffect triggered", {
      volume: playerSettings.settings.volume,
    });
    if (audioRef.current) {
      audioRef.current.volume = playerSettings.settings.volume;
    }
  }, [playerSettings.settings.volume]);

  useEffect(() => {
    if (!playerSettings.isInitialized) return;
    
    console.log("useAudioPlayback: Settings sync useEffect triggered");
    setPlayerState((prev) => ({
      ...prev,
      volume: playerSettings.settings.volume,
      shuffle: playerSettings.settings.defaultShuffle,
      repeat: playerSettings.settings.defaultRepeat,
    }));
  }, [
    playerSettings.settings.volume,
    playerSettings.settings.defaultShuffle,
    playerSettings.settings.defaultRepeat,
    playerSettings.isInitialized,
  ]);

  useEffect(() => {
    console.log("useAudioPlayback: MediaSession useEffect triggered", {
      currentSong: playerState.currentSong?.id,
      currentPlaylist: playerState.currentPlaylist?.id,
    });
    
    if (!playerSettings.isInitialized) return;
    
    playerSettings.setSettings({
      lastPlayedSongId: playerState.currentSong?.id ?? "none",
      lastPlayedPlaylistId: playerState.currentPlaylist?.id ?? "none",
    });

    if ("mediaSession" in navigator && playerState.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playerState.currentSong.title,
        artist: playerState.currentSong.artist,
        album: playerState.currentSong.album,
        artwork: playerState.currentSong.albumArt
          ? [{ src: playerState.currentSong.albumArt }]
          : [],
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrevious();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNext();
      });

      return () => {
        console.log("useAudioPlayback: Cleaning up MediaSession useEffect");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
        }
      };
    }
  }, [playerState.currentSong, playerState.currentPlaylist, playerSettings.isInitialized, playerSettings, playNext, playPrevious]);

  useEffect(() => {
    console.log("useAudioPlayback: playNextRef update useEffect triggered");
    playNextRef.current = playNext;
  }, [playNext]);

  return {
    audioRef,
    audioContextRef,
    sourceNodeRef,
    playerState,
    setPlayerState,
    playSong,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    seekTo,
    playerStateRef,
  };
};
