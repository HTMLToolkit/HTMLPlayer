import { useState, useCallback } from "react";
import { MusicLibrary } from "../types/MusicLibrary";

// Define interfaces for dependencies to avoid circular imports
interface AudioPlaybackInterface {
  setPlayerState: React.Dispatch<React.SetStateAction<any>>;
}

interface MusicLibraryInterface {
  library: MusicLibrary;
}

export const useSearchAndNavigation = (
  audioPlayback: AudioPlaybackInterface,
  musicLibrary: MusicLibraryInterface
) => {
  console.log("useSearchAndNavigation called.");

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
    audioPlayback.setPlayerState((prev: any) => ({
      ...prev,
      view: "artist",
      currentArtist: artist,
    }));
  }, [audioPlayback]);

  const navigateToAlbum = useCallback((album: string) => {
    audioPlayback.setPlayerState((prev: any) => ({
      ...prev,
      view: "album",
      currentAlbum: album,
    }));
  }, [audioPlayback]);

  const navigateToSongs = useCallback(() => {
    audioPlayback.setPlayerState((prev: any) => ({
      ...prev,
      view: "songs",
      currentArtist: undefined,
      currentAlbum: undefined,
    }));
  }, [audioPlayback]);

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
