import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PlayerState } from "../types/PlayerState";
import { Playlist } from "../types/Playlist";
import { Song } from "../types/Song";
import { set } from "lodash";
import {
  cacheSong,
  getCachedSong,
  pdateSongCache,
  prepareSongsForPlaylist,
} from "./useSongCache";
import { settingsRef, setSettings } from "./usePlayerSettings";
import { isInitialized } from "./useMusicLibrary";

export const useAudioPlayback = () => {
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
      // Even if URL is empty, we might have it in IndexedDB
      if (!song.url && !song.hasStoredAudio) {
        console.error("No URL or stored audio available for song:", song);
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
            url: `indexeddb://${song.id}`, // Use indexeddb:// URL
          }
        : song;

      // First ensure the song is cached
      await cacheSong(songToPlay);
      const cachedSong = getCachedSong(song.id);
      if (!cachedSong) {
        console.error("Failed to play song: could not cache");
        return;
      }

      // Prepare playlist songs if setting a new playlist
      const preparedPlaylist = playlist
        ? {
            ...playlist,
            songs: prepareSongsForPlaylist(playlist.songs),
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
                setLibrary((prev) => ({
                  ...prev,
                  songs: prev.songs.map((s) =>
                    s.id === song.id ? updatedSong : s
                  ),
                }));

                audioRef.current!.src = newUrl;
                await audioRef.current!.play();
              } catch {
                setPlayerState((prev) => ({ ...prev, isPlaying: false }));
              }
            } else {
              console.error("Failed to play song:", error);
              toast.error(`Failed to play "${song.title}"`, {
                description: error.message || "Unknown error occurred",
              });
              setPlayerState((prev) => ({ ...prev, isPlaying: false }));
            }
          });
        } catch (error: any) {
          console.error("Failed to play song:", error);
          toast.error(`Failed to play "${song.title}"`, {
            description: error.message || "Unknown error occurred",
          });
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
        }

        // Update the cache for surrounding songs and next shuffled song
        if (playlist) {
          updateSongCache(song, playlist);
        }
      }
    },
    [
      setupAudioContext,
      cacheSong,
      getCachedSong,
      updateSongCache,
      prepareSongsForPlaylist,
    ]
  );

  const togglePlayPause = useCallback(() => {
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
    if (!playerState.currentPlaylist || !playerState.currentSong) return;
    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s) => s.id === playerState.currentSong!.id
    );

    if (playerState.shuffle) {
      const available = songs.filter(
        (s) => s.id !== playerState.currentSong!.id
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
    if (!playerState.currentPlaylist || !playerState.currentSong) return;
    const songs = playerState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s) => s.id === playerState.currentSong!.id
    );

    if (playerState.shuffle) {
      const available = songs.filter(
        (s) => s.id !== playerState.currentSong!.id
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
    const clamped = Math.max(0, Math.min(1, volume));
    setSettings((prev) => ({ ...prev, volume: clamped }));
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState((prev) => ({ ...prev, shuffle: !prev.shuffle }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState((prev) => ({
      ...prev,
      repeat:
        prev.repeat === "off" ? "all" : prev.repeat === "all" ? "one" : "off",
    }));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setPlayerState((prev) => ({ ...prev, currentTime: time }));
    }
  }, []);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
    audioRef.current.controls = true; // Enable browser controls

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
      if (settingsRef.current.autoPlayNext) {
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
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, []);

  useEffect(() => {
    playerStateRef.current = playerState;
  }, [playerState]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume;
    }
  }, [settings.volume]);

  useEffect(() => {
    setPlayerState((prev) => ({
      ...prev,
      volume: settings.volume,
      shuffle: settings.defaultShuffle,
      repeat: settings.defaultRepeat,
    }));
  }, [settings.volume, settings.defaultShuffle, settings.defaultRepeat]);

  useEffect(() => {
    if (!isInitialized) return;
    // Update last played song and playlist IDs in settings when they change
    setSettings((prev) => ({
      ...prev,
      lastPlayedSongId: playerState.currentSong?.id ?? prev.lastPlayedSongId,
      lastPlayedPlaylistId:
        playerState.currentPlaylist?.id ?? prev.lastPlayedPlaylistId,
    }));

    // Update Media Session metadata with album art
    if ("mediaSession" in navigator && playerState.currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playerState.currentSong.title,
        artist: playerState.currentSong.artist,
        album: playerState.currentSong.album,
        artwork: playerState.currentSong.albumArt
          ? [
              {
                src: playerState.currentSong.albumArt,
              },
            ]
          : [],
      });

      // Set up Media Session action handlers for previous and next track
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playPrevious();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playNext();
      });

      return () => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
        }
      };
    }
  }, [playerState.currentSong, playerState.currentPlaylist, isInitialized]);

  useEffect(() => {
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
