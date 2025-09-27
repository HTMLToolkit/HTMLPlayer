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
      return 1;
    }
    return Math.max(0.25, Math.min(4.0, tempo));
  };

  const setupCrossfadeManager = (audioContext: AudioContext) => {
    try {
      if (!crossfadeManagerRef.current) {
        console.log("CrossfadeUtils: Creating new crossfade manager");
        crossfadeManagerRef.current = new CrossfadeManager(audioContext);
      }

      // Setup current audio source
      if (!currentAudioSourceRef.current && audioRef.current) {
        console.log("CrossfadeUtils: Setting up current audio source");
        currentAudioSourceRef.current =
          crossfadeManagerRef.current.createAudioSource(audioRef.current);
        crossfadeManagerRef.current.setCurrentSource(
          currentAudioSourceRef.current
        );
      }

      return crossfadeManagerRef.current;
    } catch (error) {
      console.error(
        "CrossfadeUtils: Failed to setup crossfade manager:",
        error
      );
      return null;
    }
  };

  const getNextSongForCrossfade = (
    getAndCacheNextSong: () => Song | null
  ): Song | null => {
    try {
      return getAndCacheNextSong();
    } catch (error) {
      console.error(
        "CrossfadeUtils: Failed to get next song for crossfade:",
        error
      );
      return null;
    }
  };

  const prepareNextSongForCrossfade = async (
    nextSong: Song,
    cacheSong: (song: Song) => Promise<void>,
    getCachedSong: (songId: string) => any,
    settingsRef: MutableRefObject<any>
  ): Promise<void> => {
    if (!nextAudioRef.current || !crossfadeManagerRef.current) {
      throw new Error(
        "CrossfadeUtils: Missing audio elements for crossfade preparation"
      );
    }

    console.log(
      "CrossfadeUtils: Preparing next song for crossfade:",
      nextSong.title
    );

    try {
      // Cache the song first
      console.log("CrossfadeUtils: Caching next song");
      await cacheSong(nextSong);
      const cachedSong = getCachedSong(nextSong.id);

      if (!cachedSong) {
        throw new Error(`Failed to cache next song: ${nextSong.title}`);
      }

      // Set up the next audio element
      nextAudioRef.current.pause();
      nextAudioRef.current.currentTime = 0;
      nextAudioRef.current.src = cachedSong.url;
      nextAudioRef.current.playbackRate = getValidTempo(
        settingsRef.current.tempo
      );

      console.log("CrossfadeUtils: Waiting for next audio to be ready");

      // Wait for the audio to be ready with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Timeout waiting for audio to load"));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeout);
          nextAudioRef.current?.removeEventListener("canplay", onCanPlay);
          nextAudioRef.current?.removeEventListener("loadeddata", onCanPlay);
          nextAudioRef.current?.removeEventListener("error", onError);
        };

        const onCanPlay = () => {
          console.log("CrossfadeUtils: Next audio is ready");
          cleanup();
          resolve();
        };

        const onError = (e: Event) => {
          console.error("CrossfadeUtils: Error loading next audio:", e);
          cleanup();
          reject(new Error("Failed to load next audio"));
        };

        // Check if already ready
        if (nextAudioRef.current!.readyState >= 2) {
          cleanup();
          resolve();
          return;
        }

        nextAudioRef.current!.addEventListener("canplay", onCanPlay);
        nextAudioRef.current!.addEventListener("loadeddata", onCanPlay);
        nextAudioRef.current!.addEventListener("error", onError);

        // Trigger loading
        nextAudioRef.current!.load();
      });

      // Create and prepare audio source for crossfade manager
      if (
        !nextAudioSourceRef.current ||
        nextAudioSourceRef.current.element !== nextAudioRef.current
      ) {
        nextAudioSourceRef.current =
          crossfadeManagerRef.current.createAudioSource(nextAudioRef.current);
      }

      crossfadeManagerRef.current.prepareNextSource(nextAudioSourceRef.current);
      console.log(
        "CrossfadeUtils: Next song prepared successfully for crossfade"
      );
    } catch (error) {
      console.error(
        "CrossfadeUtils: Failed to prepare next song for crossfade:",
        error
      );
      throw error;
    }
  };

  const updatePlayerStateAfterCrossfade = (
    nextSong: Song,
    playerStateRef: MutableRefObject<any>,
    playHistoryRef: MutableRefObject<
      Map<string, { lastPlayed: number; playCount: number }>
    >,
    updatePlayHistory: (
      playHistoryRef: MutableRefObject<
        Map<string, { lastPlayed: number; playCount: number }>
      >,
      songId: string
    ) => void,
    setPlayerState: (updater: (prev: any) => any) => void,
    audioRef: MutableRefObject<HTMLAudioElement | null>,
    nextAudioRef: MutableRefObject<HTMLAudioElement | null>,
    currentAudioSourceRef: MutableRefObject<any>,
    nextAudioSourceRef: MutableRefObject<any>,
    invalidateNextSongCache?: () => void
  ) => {
    console.log(
      "CrossfadeUtils: Updating player state after crossfade to:",
      nextSong.title
    );

    try {
      // Update play history ONLY if we're in shuffle mode and have a current song
      if (
        playerStateRef.current.currentSong &&
        playerStateRef.current.shuffle
      ) {
        updatePlayHistory(
          playHistoryRef,
          playerStateRef.current.currentSong.id
        );
        console.log("CrossfadeUtils: Updated play history for shuffle mode");
      }

      // Swap audio elements - next becomes current
      const tempAudio = audioRef.current;
      audioRef.current = nextAudioRef.current;
      nextAudioRef.current = tempAudio;

      // Swap audio sources
      const tempSource = currentAudioSourceRef.current;
      currentAudioSourceRef.current = nextAudioSourceRef.current;
      nextAudioSourceRef.current = tempSource;

      // Get current time from the crossfade manager (which tracks the active element)
      const currentTime = crossfadeManagerRef.current?.getCurrentTime() || 0;

      // Update player state
      setPlayerState((prev: any) => {
        console.log(
          "CrossfadeUtils: Finalizing player state after crossfade:",
          nextSong.title,
          "currentTime:",
          currentTime
        );
        return {
          ...prev,
          currentTime: currentTime,
          // currentSong and duration already set at crossfade start
        };
      });

      // Invalidate next song cache since we changed songs
      if (invalidateNextSongCache) {
        invalidateNextSongCache();
        console.log("CrossfadeUtils: Invalidated next song cache after crossfade");
      }

      console.log("CrossfadeUtils: Player state updated successfully");
    } catch (error) {
      console.error(
        "CrossfadeUtils: Error updating player state after crossfade:",
        error
      );
    }
  };

  const preloadNextSong = async (
    getNextSongForCrossfadeFunc: () => Song | null,
    cacheSong: (song: Song) => Promise<void>,
    getCachedSong: (songId: string) => any,
    settingsRef: MutableRefObject<any>
  ) => {
    if (!nextAudioRef.current || crossfadeManagerRef.current?.isCrossfading()) {
      console.log(
        "CrossfadeUtils: Skipping preload - no audio element or crossfade in progress"
      );
      return;
    }

    try {
      const nextSong = getNextSongForCrossfadeFunc();
      if (!nextSong) {
        console.log("CrossfadeUtils: No next song to preload");
        return;
      }

      console.log("CrossfadeUtils: Preloading next song:", nextSong.title);

      // Cache the next song
      await cacheSong(nextSong);
      const cachedSong = getCachedSong(nextSong.id);

      if (cachedSong) {
        // Pre-set the source but don't play yet
        nextAudioRef.current.src = cachedSong.url;
        nextAudioRef.current.playbackRate = getValidTempo(
          settingsRef.current.tempo
        );

        // Preload the audio data
        nextAudioRef.current.preload = "auto";
        nextAudioRef.current.load();

        console.log("CrossfadeUtils: Successfully preloaded next song");
      }
    } catch (error) {
      console.warn("CrossfadeUtils: Failed to preload next song:", error);
    }
  };

  const startCrossfadeTransition = async (
    playNextRef: MutableRefObject<(() => void) | null>,
    getNextSongForCrossfadeFunc: () => Song | null,
    prepareNextSongForCrossfadeFunc: (nextSong: Song) => Promise<void>,
    playerStateRef: MutableRefObject<any>,
    playHistoryRef: MutableRefObject<
      Map<string, { lastPlayed: number; playCount: number }>
    >,
    updatePlayHistory: (
      playHistoryRef: MutableRefObject<
        Map<string, { lastPlayed: number; playCount: number }>
      >,
      songId: string
    ) => void,
    setPlayerState: (updater: (prev: any) => any) => void,
    settingsRef: MutableRefObject<any>,
    audioContextRef?: MutableRefObject<AudioContext | null>,
    invalidateNextSongCache?: () => void
  ) => {
    console.log("CrossfadeUtils: Starting crossfade transition...");

    if (!playNextRef.current) {
      console.warn("CrossfadeUtils: No playNext function available");
      throw new Error("No playNext function available for crossfade");
    }

    // Initialize crossfade manager if needed
    if (!crossfadeManagerRef.current) {
      if (audioContextRef?.current) {
        console.log("CrossfadeUtils: Initializing crossfade manager");
        const manager = setupCrossfadeManager(audioContextRef.current);
        if (!manager) {
          throw new Error("Failed to initialize crossfade manager");
        }
      } else {
        throw new Error("No audio context available for crossfade");
      }
    }

    if (!audioRef.current) {
      throw new Error("No current audio element available");
    }

    if (!nextAudioRef.current) {
      throw new Error("No next audio element available");
    }

    // Ensure current source is properly set up
    if (
      !currentAudioSourceRef.current ||
      currentAudioSourceRef.current.element !== audioRef.current
    ) {
      console.log("CrossfadeUtils: Setting up current audio source");
      currentAudioSourceRef.current =
        crossfadeManagerRef.current!.createAudioSource(audioRef.current);
      crossfadeManagerRef.current!.setCurrentSource(
        currentAudioSourceRef.current
      );
    }

    // Cancel any existing crossfade
    if (crossfadeManagerRef.current && crossfadeManagerRef.current.isCrossfading()) {
      console.log("CrossfadeUtils: Cancelling existing crossfade");
      crossfadeManagerRef.current.cancelCrossfade();
    }

    try {
      // Get the next song
      const nextSong = getNextSongForCrossfadeFunc();
      if (!nextSong) {
        throw new Error("No next song available for crossfade");
      }

      console.log(
        "CrossfadeUtils: Preparing next song for crossfade:",
        nextSong.title
      );

      // Prepare the next audio source
      await prepareNextSongForCrossfadeFunc(nextSong);

      // Ensure audio context is running
      if (audioContextRef?.current?.state === "suspended") {
        console.log("CrossfadeUtils: Resuming audio context");
        await audioContextRef.current.resume();
      }

      const crossfadeDuration = Math.max(
        0.5,
        Math.min(10, settingsRef.current.crossfade || 3)
      );

      // If there's less time remaining than the crossfade duration, shorten the crossfade
      const timeRemaining = audioRef.current ? audioRef.current.duration - audioRef.current.currentTime : crossfadeDuration;
      const effectiveCrossfadeDuration = Math.min(crossfadeDuration, Math.max(0.5, timeRemaining));

      console.log(
        "CrossfadeUtils: Starting crossfade with effective duration:",
        effectiveCrossfadeDuration,
        "(requested:",
        crossfadeDuration,
        "time remaining:",
        timeRemaining.toFixed(1) + ")"
      );

      // Update player state immediately when crossfade starts
      console.log("CrossfadeUtils: Updating player state at crossfade start");
      setPlayerState((prev: any) => ({
        ...prev,
        currentSong: nextSong,
        currentTime: 0, // Start from beginning for the new song
        duration: nextSong.duration || 0,
        isPlaying: true,
      }));

      // Start the crossfade
      await crossfadeManagerRef.current!.startCrossfade({
        duration: effectiveCrossfadeDuration,
        curve: "smooth",
      });

      console.log("CrossfadeUtils: Crossfade completed, finalizing player state");

      // Finalize player state after crossfade completes (swap audio elements)
      updatePlayerStateAfterCrossfade(
        nextSong,
        playerStateRef,
        playHistoryRef,
        updatePlayHistory,
        setPlayerState,
        audioRef,
        nextAudioRef,
        currentAudioSourceRef,
        nextAudioSourceRef,
        invalidateNextSongCache
      );

      console.log(
        "CrossfadeUtils: Crossfade transition completed successfully"
      );
    } catch (error) {
      console.error("CrossfadeUtils: Crossfade transition failed:", error);

      // Revert UI state back to current song since crossfade failed
      console.log("CrossfadeUtils: Reverting UI state after failed crossfade");
      setPlayerState((prev: any) => ({
        ...prev,
        currentSong: playerStateRef.current.currentSong, // Revert to the song that was actually playing
        currentTime: audioRef.current?.currentTime || prev.currentTime,
        duration: playerStateRef.current.currentSong?.duration || prev.duration,
      }));

      // Cleanup failed crossfade
      if (crossfadeManagerRef.current?.isCrossfading()) {
        crossfadeManagerRef.current.cancelCrossfade();
      }

      throw error; // Re-throw to be handled by caller
    }
  };

  const cleanupCrossfadeManager = () => {
    console.log("CrossfadeUtils: Cleaning up crossfade manager");

    try {
      if (crossfadeManagerRef.current) {
        crossfadeManagerRef.current.destroy();
        crossfadeManagerRef.current = null;
      }

      currentAudioSourceRef.current = null;
      nextAudioSourceRef.current = null;

      console.log("CrossfadeUtils: Cleanup completed");
    } catch (error) {
      console.error("CrossfadeUtils: Error during cleanup:", error);
    }
  };

  return {
    setupCrossfadeManager,
    getNextSongForCrossfade,
    prepareNextSongForCrossfade,
    updatePlayerStateAfterCrossfade,
    preloadNextSong,
    startCrossfadeTransition,
    cleanupCrossfadeManager,
  };
};
