import { toast } from "sonner";
import i18n from "i18next";

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

  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now());

  const createPlaylist = (name: string, songs: Song[] = []) => {
    const newPlaylist: Playlist = {
      id: uuid(),
      name,
      songs: prepareSongsForPlaylist(songs),
    };
    setLibrary((prev) => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist],
    }));
    return newPlaylist;
  };

  const createFolder = (name: string) => {
    const newFolder: PlaylistFolder = {
      id: uuid(),
      name,
      children: [],
    };
    setLibrary((prev) => ({
      ...prev,
      playlists: [...prev.playlists, newFolder],
    }));
    return newFolder;
  };

  const removePlaylist = (playlistId: string) => {
    setLibrary((prev) => {
      // Recursive function to remove playlist from the tree
      const removeFrom = (items: (Playlist | PlaylistFolder)[]): (Playlist | PlaylistFolder)[] => {
        return items
          .filter((p) => p.id !== playlistId)
          .map((p) => {
            if ('children' in p) {
              return { ...p, children: removeFrom(p.children) };
            }
            return p;
          });
      };

      return {
        ...prev,
        playlists: removeFrom(prev.playlists),
      };
    });
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
      // Find the song
      const song = prev.songs.find((s) => s.id === songId);
      if (!song) return prev;

      // Recursive function to update playlists in the tree
      const updatePlaylists = (items: (Playlist | PlaylistFolder)[]): (Playlist | PlaylistFolder)[] => {
        return items.map((p) => {
          if (p.id === playlistId && 'songs' in p) {
            // Don't add if song is already in playlist
            if (p.songs.some((s) => s.id === songId)) return p;
            return {
              ...p,
              songs: [...p.songs, song],
            };
          }
          if ('children' in p) {
            return { ...p, children: updatePlaylists(p.children) };
          }
          return p;
        });
      };

      return {
        ...prev,
        playlists: updatePlaylists(prev.playlists),
      };
    });
  };

  const reorderPlaylistSongs = (playlistId: string | null, newSongs: Song[]) => {
    setLibrary((prev) => {
      // If playlistId is undefined, update root songs (for All Songs)
      if (!playlistId) {
        return {
          ...prev,
          songs: newSongs,
          playlists: prev.playlists.map((p) =>
            p.id === "all-songs"
              ? { ...p, songs: newSongs }
              : p
          ),
        };
      }
      // Otherwise, update the playlist in the tree
      const updatePlaylists = (items: (Playlist | PlaylistFolder)[]): (Playlist | PlaylistFolder)[] => {
        return items.map((p) => {
          if (p.id === playlistId && 'songs' in p) {
            return {
              ...p,
              songs: newSongs,
            };
          }
          if ('children' in p) {
            return { ...p, children: updatePlaylists(p.children) };
          }
          return p;
        });
      };
      return {
        ...prev,
        playlists: updatePlaylists(prev.playlists),
      };
    });
  };

  const moveSongToPlaylist = (songId: string, sourcePlaylistId: string | null, targetPlaylistId: string) => {
    setLibrary((prev) => {
      // Find the song first
      const song = prev.songs.find((s) => s.id === songId);
      if (!song) return prev;

      // Helper function to remove song from a playlist
      const removeSongFromPlaylist = (items: (Playlist | PlaylistFolder)[], playlistId: string | null): (Playlist | PlaylistFolder)[] => {
        if (playlistId === null || playlistId === "all-songs") {
          // Don't remove from "all-songs" or null (root songs)
          return items;
        }
        
        return items.map((p) => {
          if (p.id === playlistId && 'songs' in p) {
            return {
              ...p,
              songs: p.songs.filter((s) => s.id !== songId),
            };
          }
          if ('children' in p) {
            return { ...p, children: removeSongFromPlaylist(p.children, playlistId) };
          }
          return p;
        });
      };

      // Helper function to add song to a playlist
      const addSongToPlaylist = (items: (Playlist | PlaylistFolder)[], playlistId: string): (Playlist | PlaylistFolder)[] => {
        return items.map((p) => {
          if (p.id === playlistId && 'songs' in p) {
            // Don't add if song is already in playlist
            if (p.songs.some((s) => s.id === songId)) return p;
            return {
              ...p,
              songs: [...p.songs, song],
            };
          }
          if ('children' in p) {
            return { ...p, children: addSongToPlaylist(p.children, playlistId) };
          }
          return p;
        });
      };

      // Remove from source playlist (if specified and not "all-songs")
      let updatedPlaylists = prev.playlists;
      if (sourcePlaylistId && sourcePlaylistId !== "all-songs") {
        updatedPlaylists = removeSongFromPlaylist(updatedPlaylists, sourcePlaylistId);
      }

      // Add to target playlist
      updatedPlaylists = addSongToPlaylist(updatedPlaylists, targetPlaylistId);

      return {
        ...prev,
        playlists: updatedPlaylists,
      };
    });
  };

  const moveToFolder = (itemId: string, folderId: string | null, beforeId?: string | null) => {
    setLibrary((prev) => {
      // Debug logs: log the intent of the move
      console.debug('[playlistManager] moveToFolder called with', { itemId, folderId, beforeId });
      // Recursively find and remove the item from any depth
      let removedItem: Playlist | PlaylistFolder | null = null;
      const removeRecursive = (items: (Playlist | PlaylistFolder)[]): (Playlist | PlaylistFolder)[] => {
        return items
          .filter((p) => {
            if (p.id === itemId) {
              removedItem = p;
              return false;
            }
            return true;
          })
          .map((p) => {
            if ('children' in p) {
              return { ...p, children: removeRecursive(p.children) };
            }
            return p;
          });
      };

      // Remove the item from the tree
      let newPlaylists = removeRecursive(prev.playlists);
      if (!removedItem) {
        // eslint-disable-next-line no-console
        console.warn('[playlistManager] moveToFolder: item not found', itemId);
        return prev;
      }

      // Prevent moving folder into itself or its descendants
      if (folderId && removedItem && 'children' in removedItem) {
        const isDescendant = (items: (Playlist | PlaylistFolder)[], targetId: string): boolean => {
          for (const item of items) {
            if (item.id === targetId) return true;
            if ('children' in item && isDescendant(item.children, targetId)) return true;
          }
          return false;
        };
        // Find the target folder
        const findFolder = (items: (Playlist | PlaylistFolder)[], id: string): PlaylistFolder | null => {
          for (const item of items) {
            if (item.id === id && 'children' in item) return item as PlaylistFolder;
            if ('children' in item) {
              const found = findFolder(item.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const targetFolder = findFolder(newPlaylists, folderId);
        const removedFolder = removedItem as PlaylistFolder;
        if (targetFolder && isDescendant(removedFolder.children, folderId)) {
          return prev;
        }
      }

      // Recursively insert the item into the target folder or root
      const insertRecursive = (items: (Playlist | PlaylistFolder)[], parentId: string | null, newItem: Playlist | PlaylistFolder, beforeId: string | null): (Playlist | PlaylistFolder)[] => {
        if (parentId === null) {
          // Insert at root
          if (!beforeId) return [...items, newItem];
          const idx = items.findIndex((p) => p.id === beforeId);
          if (idx === -1) return [...items, newItem];
          return [...items.slice(0, idx), newItem, ...items.slice(idx)];
        }
        return items.map((p) => {
          if (p.id === parentId && 'children' in p) {
            const children = p.children;
            if (!beforeId) {
              return { ...p, children: [...children, newItem] };
            }
            const idx = children.findIndex((c) => c.id === beforeId);
            if (idx === -1) {
              return { ...p, children: [...children, newItem] };
            }
            return { ...p, children: [...children.slice(0, idx), newItem, ...children.slice(idx)] };
          } else if ('children' in p) {
            return { ...p, children: insertRecursive(p.children, parentId, newItem, beforeId) };
          }
          return p;
        });
      };

      if (folderId) {
        // eslint-disable-next-line no-console
        console.debug('[playlistManager] inserting into folder', folderId, 'beforeId', beforeId);
        newPlaylists = insertRecursive(newPlaylists, folderId, removedItem, beforeId || null);
      } else {
        // eslint-disable-next-line no-console
        console.debug('[playlistManager] inserting into root beforeId', beforeId);
        newPlaylists = insertRecursive(newPlaylists, null, removedItem, beforeId || null);
      }

      return { ...prev, playlists: newPlaylists };
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
        i18n.t("playlist.exportedAs", { name: playlist.name, format: format.toUpperCase() })
      );
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        i18n.t("playlist.exportFailed") + " " +
        (error instanceof Error ? error.message : i18n.t("common.unknownError"))
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
              throw new Error(i18n.t("playlist.invalidFormat"));
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
              i18n.t("playlist.importedPlaylist", { name: playlistData.name, count: playlistData.songs.length })
            );
            toast.info(
              i18n.t("playlist.noteManualAdd")
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
              i18n.t("playlist.importedM3u", { count: songs.length })
            );
            toast.info(
              i18n.t("playlist.noteManualAdd")
            );
            resolve();
          } else {
            throw new Error(
              i18n.t("playlist.unsupportedFormat")
            );
          }
        } catch (error) {
          console.error("Import failed:", error);
          const message =
            error instanceof Error
              ? error.message
              : i18n.t("playlist.failedToParse");
          toast.error(i18n.t("playlist.importFailedWithMessage", { message }));
          reject(error);
        }
      };

      reader.onerror = () => {
        const error = new Error(i18n.t("playlist.failedToReadFile"));
        toast.error(i18n.t("playlist.failedToReadFile"));
        reject(error);
      };

      reader.readAsText(file);
    });
  };

  return {
    prepareSongsForPlaylist,
    createPlaylist,
    createFolder,
    removePlaylist,
    addToFavorites,
    removeFromFavorites,
    addToPlaylist,
    reorderPlaylistSongs,
    moveSongToPlaylist,
    moveToFolder,
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