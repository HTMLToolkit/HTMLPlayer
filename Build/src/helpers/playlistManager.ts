import { toast } from "sonner";

export const createPlaylistManager = (
  setLibrary: (updater: (prev: MusicLibrary) => MusicLibrary) => void,
  library: MusicLibrary,
  setSearchQuery: (query: string) => void,
  searchQuery: string,
  setPlayerState: (updater: (prev: any) => any) => void
) => {

  const prepareSongsForPlaylist = (songs: Song[], songCacheRef?: React.MutableRefObject<Map<string, any>>): Song[] => {
    return songs.map((song) => {
      if (song.hasStoredAudio) {
        // Always use indexeddb:// URL for stored songs
        return {
          ...song,
          url: `indexeddb://${song.id}`,
        };
      } else if (songCacheRef?.current.has(song.id)) {
        // If song is in cache, use its cached URL
        const cached = songCacheRef.current.get(song.id);
        return {
          ...song,
          url: cached?.url || song.url,
        };
      }
      return song;
    });
  };

  const createPlaylist = (name: string, songs: Song[] = []) => {
    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name,
      songs: prepareSongsForPlaylist(songs),
    };
    setLibrary((prev) => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
    }));
    return newPlaylist;
  };

  const removePlaylist = (playlistId: string) => {
    setLibrary((prev) => ({
      ...prev,
      playlists: prev.playlists.filter((p) => p.id !== playlistId),
    }));
  };

  const addToFavorites = (songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(songId)
        ? prev.favorites
        : [...prev.favorites, songId],
    }));
  };

  const removeFromFavorites = (songId: string) => {
    setLibrary((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((id) => id !== songId),
    }));
  };

  const addToPlaylist = (playlistId: string, songId: string) => {
    setLibrary((prev) => {
      // Find the song and playlist
      const song = prev.songs.find((s) => s.id === songId);
      if (!song) return prev;

      return {
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id === playlistId) {
            // Don't add if song is already in playlist
            if (p.songs.some((s) => s.id === songId)) return p;
            return {
              ...p,
              songs: [...p.songs, song],
            };
          }
          return p;
        }),
      };
    });
  };

  const toggleFavorite = (songId: string) => {
    const isFav = library.favorites.includes(songId);
    if (isFav) removeFromFavorites(songId);
    else addToFavorites(songId);
    return !isFav;
  };

  const isFavorited = (songId: string) => {
    return library.favorites.includes(songId);
  };

  const getFavoriteSongs = () => {
    return library.songs.filter((s) => library.favorites.includes(s.id));
  };

  const searchSongs = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) return library.songs;
    return library.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(query.toLowerCase()) ||
        s.artist.toLowerCase().includes(query.toLowerCase())
    );
  };

  const getSearchResults = () => {
    return searchSongs(searchQuery);
  };

  const navigateToArtist = (artist: string) => {
    setPlayerState((prev: any) => ({
      ...prev,
      view: "artist",
      currentArtist: artist,
    }));
  };

  const navigateToAlbum = (album: string) => {
    setPlayerState((prev: any) => ({
      ...prev,
      view: "album",
      currentAlbum: album,
    }));
  };

  const navigateToSongs = () => {
    setPlayerState((prev: any) => ({
      ...prev,
      view: "songs",
      currentArtist: undefined,
      currentAlbum: undefined,
    }));
  };

  // Export playlist to JSON or M3U format
  const exportPlaylist = (playlist: Playlist, format: "json" | "m3u" = "json") => {
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === "json") {
        // Export as JSON with full metadata
        const exportData = {
          name: playlist.name,
          created: new Date().toISOString(),
          songs: playlist.songs.map((song) => ({
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            // Don't include URL or file data for privacy/size reasons
          })),
        };
        content = JSON.stringify(exportData, null, 2);
        filename = `${playlist.name.replace(/[^a-z0-9]/gi, "_")}.json`;
        mimeType = "application/json";
      } else {
        // Export as M3U playlist
        content = "#EXTM3U\n";
        playlist.songs.forEach((song) => {
          content += `#EXTINF:${Math.floor(song.duration)},${song.artist} - ${
            song.title
          }\n`;
          content += `# ${song.album}\n`;
        });
        filename = `${playlist.name.replace(/[^a-z0-9]/gi, "_")}.m3u`;
        mimeType = "audio/x-mpegurl";
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        `Exported playlist "${playlist.name}" as ${format.toUpperCase()}`
      );
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        `Failed to export playlist: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Import playlist from JSON file
  const importPlaylist = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;

          if (file.name.endsWith(".json")) {
            // Parse JSON playlist
            const playlistData = JSON.parse(content);

            if (!playlistData.name || !Array.isArray(playlistData.songs)) {
              throw new Error("Invalid playlist format");
            }

            // Create new playlist with imported metadata (songs will need to be matched/re-added)
            const newPlaylist: Playlist = {
              id: Date.now().toString(),
              name: `${playlistData.name} (Imported)`,
              songs: [], // Empty for now, user will need to add songs manually
            };

            // Add the playlist
            createPlaylist(newPlaylist.name, newPlaylist.songs);

            toast.success(
              `Imported playlist "${playlistData.name}" with ${playlistData.songs.length} song references`
            );
            toast.info(
              "Note: You'll need to add songs to this playlist manually as audio files cannot be imported."
            );
            resolve();
          } else if (
            file.name.endsWith(".m3u") ||
            file.name.endsWith(".m3u8")
          ) {
            // Parse M3U playlist
            const lines = content.split("\n").filter((line) => line.trim());
            const songs: Array<{ title: string; artist: string }> = [];

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith("#EXTINF:")) {
                // Extract artist and title from M3U format
                const match = line.match(/#EXTINF:\d+,(.+?) - (.+)/);
                if (match) {
                  songs.push({
                    artist: match[1],
                    title: match[2],
                  });
                }
              }
            }

            // Create playlist
            const playlistName = file.name.replace(/\.(m3u|m3u8)$/i, "");
            createPlaylist(`${playlistName} (Imported)`, []);

            toast.success(
              `Imported M3U playlist with ${songs.length} song references`
            );
            toast.info(
              "Note: You'll need to add songs to this playlist manually as audio files cannot be imported."
            );
            resolve();
          } else {
            throw new Error(
              "Unsupported file format. Please use .json, .m3u, or .m3u8 files."
            );
          }
        } catch (error) {
          console.error("Import failed:", error);
          const message =
            error instanceof Error
              ? error.message
              : "Failed to parse playlist file";
          toast.error(`Import failed: ${message}`);
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error("Failed to read file");
        toast.error("Failed to read file");
        reject(error);
      };

      reader.readAsText(file);
    });
  };

  return {
    prepareSongsForPlaylist,
    createPlaylist,
    removePlaylist,
    addToFavorites,
    removeFromFavorites,
    addToPlaylist,
    toggleFavorite,
    isFavorited,
    getFavoriteSongs,
    searchSongs,
    getSearchResults,
    navigateToArtist,
    navigateToAlbum,
    navigateToSongs,
    exportPlaylist,
    importPlaylist
  };
};