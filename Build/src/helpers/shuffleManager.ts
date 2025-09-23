import { MutableRefObject } from "react";

// Smart shuffle algorithm that avoids recently played songs
export const getSmartShuffledSong = (
  availableSongs: Song[],
  currentSongId: string,
  recentlyPlayedIds: string[]
): Song | null => {
  if (availableSongs.length === 0) return null;

  // Filter out the current song and recently played songs
  const filteredSongs = availableSongs.filter(
    (song) => song.id !== currentSongId && !recentlyPlayedIds.includes(song.id)
  );

  // If we've filtered out too many songs, fall back to avoiding only the last few
  const songsToChooseFrom =
    filteredSongs.length > 0
      ? filteredSongs
      : availableSongs.filter(
          (song) =>
            song.id !== currentSongId &&
            !recentlyPlayedIds
              .slice(-Math.min(3, recentlyPlayedIds.length))
              .includes(song.id)
        );

  // If still no songs available, just exclude current song
  const finalSongs =
    songsToChooseFrom.length > 0
      ? songsToChooseFrom
      : availableSongs.filter((song) => song.id !== currentSongId);

  if (finalSongs.length === 0) return null;

  // Weighted random selection - prefer songs that haven't been played recently
  const weights = finalSongs.map((song) => {
    const timesInRecent = recentlyPlayedIds.filter(
      (id) => id === song.id
    ).length;
    return Math.max(1, 10 - timesInRecent * 3); // Higher weight for less recently played
  });

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let randomWeight = Math.random() * totalWeight;

  for (let i = 0; i < finalSongs.length; i++) {
    randomWeight -= weights[i];
    if (randomWeight <= 0) {
      return finalSongs[i];
    }
  }

  // Fallback to the last song
  return finalSongs[finalSongs.length - 1];
};

// Next song cache manager
export const createNextSongManager = (
  nextSongCacheRef: MutableRefObject<Song | null>,
  nextSongCacheValidRef: MutableRefObject<boolean>
) => {
  // Function to determine and cache the next song to ensure consistency between crossfade and playNext
  const getAndCacheNextSong = (
    playerStateRef: MutableRefObject<any>,
    settingsRef: MutableRefObject<any>,
    recentlyPlayedRef: MutableRefObject<string[]>,
    currentRecentlyPlayed?: string[]
  ): Song | null => {
    if (
      !playerStateRef.current.currentPlaylist ||
      !playerStateRef.current.currentSong
    ) {
      return null;
    }

    // If we have a valid cached next song, return it
    if (nextSongCacheValidRef.current && nextSongCacheRef.current) {
      console.log("Using cached next song:", nextSongCacheRef.current.title);
      return nextSongCacheRef.current;
    }

    // Use provided recently played list or current state from ref
    const recentlyPlayedToUse =
      currentRecentlyPlayed || recentlyPlayedRef.current;

    console.log(
      "Computing new next song. Current song:",
      playerStateRef.current.currentSong.title
    );
    console.log("Recently played to use:", recentlyPlayedToUse.slice(0, 3));

    const songs = playerStateRef.current.currentPlaylist.songs;
    const currentIndex = songs.findIndex(
      (s: { id: any }) => s.id === playerStateRef.current.currentSong!.id
    );
    let nextSong: Song | null = null;

    if (playerStateRef.current.shuffle) {
      const available = songs.filter(
        (s: { id: any }) => s.id !== playerStateRef.current.currentSong!.id
      );
      if (available.length > 0) {
        if (settingsRef.current.smartShuffle) {
          // Use smart shuffle algorithm
          nextSong = getSmartShuffledSong(
            available,
            playerStateRef.current.currentSong!.id,
            recentlyPlayedToUse
          );
          if (!nextSong) {
            nextSong = available[Math.floor(Math.random() * available.length)];
          }
          console.log("Smart shuffle selected:", nextSong?.title);
        } else {
          // Use regular shuffle
          const randomIndex = Math.floor(Math.random() * available.length);
          nextSong = available[randomIndex];
          console.log("Regular shuffle selected:", nextSong?.title);
        }
      }
    } else {
      if (currentIndex < songs.length - 1) {
        nextSong = songs[currentIndex + 1];
      } else if (playerStateRef.current.repeat === "all") {
        nextSong = songs[0];
      }
      console.log("Sequential next song:", nextSong?.title);
    }

    // Cache the result
    nextSongCacheRef.current = nextSong;
    nextSongCacheValidRef.current = true;
    console.log("Cached next song:", nextSong?.title);

    return nextSong;
  };

  // Function to invalidate the next song cache
  const invalidateNextSongCache = () => {
    console.log("Invalidating next song cache");
    nextSongCacheRef.current = null;
    nextSongCacheValidRef.current = false;
  };

  return {
    getAndCacheNextSong,
    invalidateNextSongCache,
  };
};
