import { MutableRefObject } from "react";
import { CrossfadeManager, AudioSource } from "./crossfadeHelper";

export const createCrossfadeManager = (
  audioRef: MutableRefObject<HTMLAudioElement | null>,
  nextAudioRef: MutableRefObject<HTMLAudioElement | null>,
  crossfadeManagerRef: MutableRefObject<CrossfadeManager | null>,
  currentAudioSourceRef: MutableRefObject<AudioSource | null>,
  nextAudioSourceRef: MutableRefObject<AudioSource | null>
) => {

  const getValidTempo = (tempo: number | undefined) => {
    if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo <= 0) {
      return 1; // fallback to normal speed
    }
    return tempo;
  };

  const setupCrossfadeManager = (audioContext: AudioContext) => {
    if (!crossfadeManagerRef.current) {
      crossfadeManagerRef.current = new CrossfadeManager(audioContext);
    }

    // Setup current audio source
    if (!currentAudioSourceRef.current && audioRef.current) {
      currentAudioSourceRef.current = crossfadeManagerRef.current.createAudioSource(audioRef.current);
      crossfadeManagerRef.current.setCurrentSource(currentAudioSourceRef.current);
    }

    return crossfadeManagerRef.current;
  };

  const getNextSongForCrossfade = (getAndCacheNextSong: () => Song | null): Song | null => {
    return getAndCacheNextSong();
  };

  const prepareNextSongForCrossfade = async (
    nextSong: Song,
    cacheSong: (song: Song) => Promise<void>,
    getCachedSong: (songId: string) => any,
    settingsRef: MutableRefObject<any>
  ) => {
    if (!nextAudioRef.current || !crossfadeManagerRef.current) return;

    // Check if song is already preloaded
    if (
      nextAudioRef.current.src &&
      !nextAudioRef.current.src.includes("about:blank")
    ) {
      // Song is already preloaded, just set up the audio source
      if (!nextAudioSourceRef.current) {
        nextAudioSourceRef.current =
          crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
      }
      crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
      return;
    }

    // Song not preloaded, do full preparation
    await cacheSong(nextSong);
    const cachedSong = getCachedSong(nextSong.id);
    if (!cachedSong) {
      throw new Error("Failed to cache next song for crossfade");
    }

    // Set up the next audio element
    nextAudioRef.current.src = cachedSong.url;
    nextAudioRef.current.playbackRate = getValidTempo(settingsRef.current.tempo);

    // Create audio source for crossfade manager
    if (!nextAudioSourceRef.current) {
      nextAudioSourceRef.current =
        crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
    }

    // Prepare for crossfade
    crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
  };

  const updatePlayerStateAfterCrossfade = (
    nextSong: Song,
    playerStateRef: MutableRefObject<any>,
    recentlyPlayed: string[],
    setRecentlyPlayed: (updater: (prev: string[]) => string[]) => void,
    setPlayerState: (updater: (prev: any) => any) => void
  ) => {
    console.log("updatePlayerStateAfterCrossfade called with:", nextSong.title);
    console.log(
      "Current song before update:",
      playerStateRef.current.currentSong?.title
    );
    console.log(
      "Current recently played before update:",
      recentlyPlayed.slice(0, 3)
    );

    // Update recently played ONLY if we're in shuffle mode and have a current song
    if (playerStateRef.current.currentSong && playerStateRef.current.shuffle) {
      const updatedRecentlyPlayed = [
        playerStateRef.current.currentSong.id,
        ...recentlyPlayed.slice(0, 19),
      ];
      console.log(
        "Updated recently played after crossfade:",
        updatedRecentlyPlayed.slice(0, 3)
      );

      // Update the state
      setRecentlyPlayed(() => updatedRecentlyPlayed);
    }

    // Swap audio elements - next becomes current
    const tempAudio = audioRef.current;
    audioRef.current = nextAudioRef.current;
    nextAudioRef.current = tempAudio;

    // Swap audio sources
    const tempSource = currentAudioSourceRef.current;
    currentAudioSourceRef.current = nextAudioSourceRef.current;
    nextAudioSourceRef.current = tempSource;

    // Update player state
    setPlayerState((prev: any) => ({
      ...prev,
      currentSong: nextSong,
      currentTime: 0,
      isPlaying: true,
    }));
  };

  const preloadNextSong = async (
    getNextSongForCrossfadeFunc: () => Song | null,
    cacheSong: (song: Song) => Promise<void>,
    getCachedSong: (songId: string) => any,
    settingsRef: MutableRefObject<any>
  ) => {
    if (
      !nextAudioRef.current ||
      crossfadeManagerRef.current?.isCrossfading()
    ) {
      return;
    }

    const nextSong = getNextSongForCrossfadeFunc();
    if (!nextSong) return;

    try {
      // Cache the next song without starting playback
      await cacheSong(nextSong);
      const cachedSong = getCachedSong(nextSong.id);
      if (cachedSong) {
        // Pre-set the source but don't play yet
        nextAudioRef.current.src = cachedSong.url;
        nextAudioRef.current.playbackRate = getValidTempo(settingsRef.current.tempo);
        console.log("Preloaded next song for crossfade:", nextSong.title);
      }
    } catch (error) {
      console.warn("Failed to preload next song:", error);
    }
  };

  const startCrossfadeTransition = async (
    playNextRef: MutableRefObject<(() => void) | null>,
    getNextSongForCrossfadeFunc: () => Song | null,
    prepareNextSongForCrossfadeFunc: (nextSong: Song) => Promise<void>,
    updatePlayerStateAfterCrossfadeFunc: (nextSong: Song) => void,
    settingsRef: MutableRefObject<any>
  ) => {
    if (
      !playNextRef.current ||
      !crossfadeManagerRef.current ||
      !nextAudioRef.current
    ) {
      return;
    }

    try {
      // Get the next song info
      const nextSong = getNextSongForCrossfadeFunc();
      if (!nextSong) {
        console.warn("No next song found for crossfade");
        return;
      }

      // Prepare the next audio source
      await prepareNextSongForCrossfadeFunc(nextSong);

      // Start the crossfade
      await crossfadeManagerRef.current.startCrossfade({
        duration: settingsRef.current.crossfade,
        curve: "exponential",
      });

      // Update current song state after crossfade completes
      console.log("Crossfade completed, updating state");
      updatePlayerStateAfterCrossfadeFunc(nextSong);
    } catch (error) {
      console.error("Crossfade failed:", error);
      // Fallback to regular transition
      playNextRef.current();
    }
  };

  const cleanupCrossfadeManager = () => {
    // Cleanup crossfade manager
    if (crossfadeManagerRef.current) {
      crossfadeManagerRef.current.destroy();
    }
  };

  return {
    setupCrossfadeManager,
    getNextSongForCrossfade,
    prepareNextSongForCrossfade,
    updatePlayerStateAfterCrossfade,
    preloadNextSong,
    startCrossfadeTransition,
    cleanupCrossfadeManager
  };
};