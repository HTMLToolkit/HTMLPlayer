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
      try {
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
      } catch (error) {
        console.error("Failed to setup audio context:", error);
      }
    }
  }, []); // Remove dependencies to prevent re-creation

  const playSong = useCallback(
    async (song: Song, playlist?: Playlist) => {
      console.log("useAudioPlayback: playSong called", { songId: song.id, playlistId: playlist?.id });
      
      if (!song.url && !song.hasStoredAudio) {
        console.error("useAudioPlayback: No URL or stored audio available for song:", song);
        toast.error(`Cannot play "${song.title}" - No audio source available`);
        return;
      }

      if (!audioContextRef.current) setupAudioContext();
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume();
      }

      try {
        // Prepare song for playing
        const songToPlay = song.hasStoredAudio
          ? { ...song, url: `indexeddb://${song.id}` }
          : song;

        // Cache the song
        await songCache.cacheSong(songToPlay);
        const cachedSong = songCache.getCachedSong(song.id);
        
        if (!cachedSong) {
          console.error("useAudioPlayback: Failed to play song: could not cache");
          return;
        }

        // Prepare playlist if provided
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
          audioRef.current.src = cachedSong.url;
          await audioRef.current.play();

          // Update cache for surrounding songs
          if (playlist) {
            console.log("useAudioPlayback: Updating song cache in playSong");
            songCache.updateSongCache(song, playlist, playerStateRef.current.shuffle);
          }
        }
      } catch (error: any) {
        console.error("useAudioPlayback: Failed to play song:", error);
        toast.error(`Failed to play "${song.title}"`, {
          description: error.message || "Unknown error occurred",
        });
        setPlayerState((prev) => ({ ...prev, isPlaying: false }));
      }
    },
    [setupAudioContext, songCache]
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
    const currentState = playerStateRef.current;
    if (!currentState.currentPlaylist || !currentState.currentSong) return;
    
    const songs = currentState.currentPlaylist.songs;
    if (!songs || songs.length === 0) return; // Fix for undefined length error
    
    const currentIndex = songs.findIndex(
      (s: { id: any }) => s.id === currentState.currentSong!.id
    );

    if (currentState.shuffle) {
      const available = songs.filter(
        (s: { id: any }) => s.id !== currentState.currentSong!.id
      );
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], currentState.currentPlaylist);
      }
    } else {
      if (currentIndex < songs.length - 1) {
        playSong(songs[currentIndex + 1], currentState.currentPlaylist);
      } else if (currentState.repeat === "all") {
        playSong(songs[0], currentState.currentPlaylist);
      }
    }
  }, [playSong]);

  const playPrevious = useCallback(() => {
    console.log("useAudioPlayback: playPrevious called");
    const currentState = playerStateRef.current;
    if (!currentState.currentPlaylist || !currentState.currentSong) return;
    
    const songs = currentState.currentPlaylist.songs;
    if (!songs || songs.length === 0) return; // Fix for undefined length error
    
    const currentIndex = songs.findIndex(
      (s: { id: any }) => s.id === currentState.currentSong!.id
    );

    if (currentState.shuffle) {
      const available = songs.filter(
        (s: { id: any }) => s.id !== currentState.currentSong!.id
      );
      if (available.length > 0) {
        const randomIndex = Math.floor(Math.random() * available.length);
        playSong(available[randomIndex], currentState.currentPlaylist);
      }
    } else {
      if (currentIndex > 0) {
        playSong(songs[currentIndex - 1], currentState.currentPlaylist);
      } else if (currentState.repeat === "all") {
        playSong(songs[songs.length - 1], currentState.currentPlaylist);
      }
    }
  }, [playSong]);

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

  // Audio setup effect - only run once
  useEffect(() => {
    console.log("useAudioPlayback: Audio setup useEffect triggered");
    if (audioRef.current) return; // Prevent re-initialization
    
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";

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
  }, []); // Empty deps to run only once

  // Update playerStateRef
  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  // Update playNextRef
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  // Sync volume only when settings change
  useEffect(() => {
    if (audioRef.current && playerSettings.settings.volume !== undefined) {
      audioRef.current.volume = playerSettings.settings.volume;
    }
  }, [playerSettings.settings.volume]);

  // Sync settings only when initialized
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

  // MediaSession handling
  useEffect(() => {
    if (!playerSettings.isInitialized) return;
    
    console.log("useAudioPlayback: MediaSession useEffect triggered", {
      currentSong: playerState.currentSong?.id,
      currentPlaylist: playerState.currentPlaylist?.id,
    });
    
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

      navigator.mediaSession.setActionHandler("previoustrack", playPrevious);
      navigator.mediaSession.setActionHandler("nexttrack", playNext);

      return () => {
        console.log("useAudioPlayback: Cleaning up MediaSession useEffect");
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
        }
      };
    }
  }, [
    playerState.currentSong, 
    playerState.currentPlaylist, 
    playerSettings.isInitialized, 
    playerSettings.setSettings,
    playNext, 
    playPrevious
  ]);

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
