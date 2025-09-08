import { useState, useCallback } from "react";
import { setPlayerState, playerState } from "./useAudioPlayback";

export const useSearchAndNavigation = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const searchSongs = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (!query.trim()) return library.songs;
      return library.songs.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.artist.toLowerCase().includes(query.toLowerCase())
      );
    },
    [library.songs]
  );

  const getSearchResults = useCallback(() => {
    return searchSongs(searchQuery);
  }, [searchSongs, searchQuery]);

  const navigateToArtist = useCallback((artist: string) => {
    setPlayerState((prev) => ({
      ...prev,
      view: "artist",
      currentArtist: artist,
    }));
  }, []);

  const navigateToAlbum = useCallback((album: string) => {
    setPlayerState((prev) => ({
      ...prev,
      view: "album",
      currentAlbum: album,
    }));
  }, []);

  const navigateToSongs = useCallback(() => {
    setPlayerState((prev) => ({
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
