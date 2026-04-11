import { LibraryManager } from "../src/platform/library/library";
import type { Track, Playlist } from "../src/core/engine/types";

const createTrack = (id: string): Track => ({
  id,
  title: `Track ${id}`,
  artist: "Test Artist",
  album: "Test Album",
  duration: 180,
  url: `file:///test/${id}.mp3`,
});

describe("LibraryManager", () => {
  let library: LibraryManager;

  beforeEach(() => {
    library = new LibraryManager();
  });

  describe("Song operations", () => {
    it("should add a song", () => {
      const track = createTrack("song-1");
      library.addSong(track);
      expect(library.getState().songs.length).toBe(1);
    });

    it("should not add duplicate songs", () => {
      const track = createTrack("song-1");
      library.addSong(track);
      library.addSong(track);
      expect(library.getState().songs.length).toBe(1);
    });

    it("should remove a song", () => {
      const track = createTrack("song-1");
      library.addSong(track);
      library.removeSong("song-1");
      expect(library.getState().songs.length).toBe(0);
    });

    it("should update a song", () => {
      const track = createTrack("song-1");
      library.addSong(track);
      library.updateSong("song-1", { title: "Updated Title" });
      expect(library.getSong("song-1")?.title).toBe("Updated Title");
    });

    it("should get a specific song", () => {
      const track = createTrack("song-1");
      library.addSong(track);
      expect(library.getSong("song-1")?.id).toBe("song-1");
    });
  });

  describe("Playlist operations", () => {
    it("should add a playlist", () => {
      const playlist: Playlist = {
        id: "playlist-1",
        name: "Test Playlist",
        songs: [createTrack("a"), createTrack("b")],
      };
      library.addPlaylist(playlist);
      expect(library.getState().playlists.length).toBe(1);
    });

    it("should remove a playlist", () => {
      const playlist: Playlist = {
        id: "playlist-1",
        name: "Test Playlist",
        songs: [],
      };
      library.addPlaylist(playlist);
      library.removePlaylist("playlist-1");
      expect(library.getState().playlists.length).toBe(0);
    });

    it("should add song to playlist", () => {
      const playlist: Playlist = {
        id: "playlist-1",
        name: "Test Playlist",
        songs: [],
      };
      library.addPlaylist(playlist);
      library.addToPlaylist("playlist-1", createTrack("new-song"));
      expect(library.getPlaylist("playlist-1")?.songs.length).toBe(1);
    });

    it("should remove song from playlist", () => {
      const track = createTrack("song-to-remove");
      const playlist: Playlist = {
        id: "playlist-1",
        name: "Test Playlist",
        songs: [track],
      };
      library.addPlaylist(playlist);
      library.removeFromPlaylist("playlist-1", "song-to-remove");
      expect(library.getPlaylist("playlist-1")?.songs.length).toBe(0);
    });

    it("should reorder playlist songs", () => {
      const songs = [createTrack("a"), createTrack("b"), createTrack("c")];
      const playlist: Playlist = {
        id: "playlist-1",
        name: "Test Playlist",
        songs: songs,
      };
      library.addPlaylist(playlist);
      const reordered = [songs[2], songs[0], songs[1]];
      library.reorderPlaylistSongs("playlist-1", reordered);
      expect(library.getPlaylist("playlist-1")?.songs[0].id).toBe("c");
    });
  });

  describe("Favorites", () => {
    it("should add to favorites", () => {
      library.toggleFavorite("song-1");
      expect(library.isFavorite("song-1")).toBe(true);
    });

    it("should remove from favorites", () => {
      library.toggleFavorite("song-1");
      library.toggleFavorite("song-1");
      expect(library.isFavorite("song-1")).toBe(false);
    });

    it("should get favorite songs", () => {
      library.addSong(createTrack("song-1"));
      library.addSong(createTrack("song-2"));
      library.addSong(createTrack("song-3"));
      library.toggleFavorite("song-1");
      library.toggleFavorite("song-3");
      const favorites = library.getFavoriteSongs();
      expect(favorites.length).toBe(2);
    });
  });

  describe("Search", () => {
    beforeEach(() => {
      library.addSong(createTrack("song-1"));
      library.addSong({ ...createTrack("song-2"), artist: "Different Artist" });
      library.addSong({ ...createTrack("song-3"), album: "Dark Album" });
    });

    it("should search by title", () => {
      const results = library.search("Track");
      expect(results.length).toBe(3);
    });

    it("should search by artist", () => {
      const results = library.search("Different");
      expect(results.length).toBe(1);
      expect(results[0].artist).toBe("Different Artist");
    });

    it("should search by album", () => {
      const results = library.search("Dark");
      expect(results.length).toBe(1);
      expect(results[0].album).toBe("Dark Album");
    });

    it("should return all songs for empty query", () => {
      const results = library.search("");
      expect(results.length).toBe(3);
    });
  });

  describe("Artists and Albums", () => {
    beforeEach(() => {
      library.addSong({ ...createTrack("1"), artist: "Artist A", album: "Album X" });
      library.addSong({ ...createTrack("2"), artist: "Artist A", album: "Album Y" });
      library.addSong({ ...createTrack("3"), artist: "Artist B", album: "Album X" });
    });

    it("should get all artists", () => {
      const artists = library.getAllArtists();
      expect(artists).toContain("Artist A");
      expect(artists).toContain("Artist B");
    });

    it("should get all albums", () => {
      const albums = library.getAllAlbums();
      expect(albums).toContain("Album X");
      expect(albums).toContain("Album Y");
    });

    it("should get songs by artist", () => {
      const songs = library.getSongsByArtist("Artist A");
      expect(songs.length).toBe(2);
    });

    it("should get songs by album", () => {
      const songs = library.getSongsByAlbum("Album X");
      expect(songs.length).toBe(2);
    });
  });

  describe("Events", () => {
    it("should emit songadded event", () => {
      const callback = jest.fn();
      library.on("songadded", callback);
      library.addSong(createTrack("new"));
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: "new" }));
    });

    it("should emit songremoved event", () => {
      const callback = jest.fn();
      library.on("songremoved", callback);
      library.addSong(createTrack("new"));
      library.removeSong("new");
      expect(callback).toHaveBeenCalledWith("new");
    });

    it("should emit favoritechanged event", () => {
      const callback = jest.fn();
      library.on("favoritechanged", callback);
      library.toggleFavorite("song-1");
      expect(callback).toHaveBeenCalledWith({ songId: "song-1", isFavorite: true });
    });
  });

  describe("Clear library", () => {
    it("should clear all songs and playlists", () => {
      library.addSong(createTrack("song-1"));
      library.addPlaylist({ id: "p1", name: "Playlist", songs: [] });
      library.toggleFavorite("song-1");
      library.clearLibrary();
      const state = library.getState();
      expect(state.songs.length).toBe(0);
      expect(state.playlists.length).toBe(0);
      expect(state.favorites.length).toBe(0);
    });
  });
});