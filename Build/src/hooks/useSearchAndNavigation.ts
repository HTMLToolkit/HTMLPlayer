import { useState, useCallback } from "react";
import { useAudioPlayback } from "./useAudioPlayback";
import { useMusicLibrary } from "./useMusicLibrary";

export const useSearchAndNavigation = () => {
  console.log("useSearchAndNavigation called.");
  const audioPlayback = useAudioPlayback();
  const musicLibrary = useMusicLibrary();

  const [searchQuery, setSearchQuery] = useState("");

  const searchSongs = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) return musicLibrary.library.songs;
      return musicLibrary.library.songs.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artist.toLowerCase().includes(query.toLowerCase())
      );
    },
    [musicLibrary.library.songs]
  );

  const getSearchResults = useCallback(() => {
    return searchSongs(searchQuery);
  }, [searchSongs, searchQuery]);

  const navigateToArtist = useCallback((artist: string) => {
    audioPlayback.setPlayerState((prev) => ({
      ...prev,
      view: "artist",
      currentArtist: artist,
    }));
  }, []);

  const navigateToAlbum = useCallback((album: string) => {
    audioPlayback.setPlayerState((prev) => ({
      ...prev,
      view: "album",
      currentAlbum: album,
    }));
  }, []);

  const navigateToSongs = useCallback(() => {
    audioPlayback.setPlayerState((prev) => ({
      ...prev,
      view: "songs",
      currentArtist: undefined,
      currentAlbum: undefined,
    }));
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchSongs,
    getSearchResults,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
  };
};
