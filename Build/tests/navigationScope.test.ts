import { describe, it, expect } from "@jest/globals";
import {
  queueForNavigation,
  songsForNavigation,
  type NavigationScope,
} from "../src/ui/navigation/scope";
import type { NavigationState } from "../src/ui/navigation/NavigationProvider";
import type { Track, Playlist } from "../src/core/engine/types";

const track = (
  id: string,
  overrides: Partial<Track> = {},
): Track => ({
  id,
  title: `Track ${id}`,
  artist: "Test Artist",
  album: "Test Album",
  duration: 180,
  url: `file:///test/${id}.mp3`,
  ...overrides,
});

const labels = { allSongs: "All Songs", favorites: "Favorites" };

const scopeWith = (
  songs: Track[],
  favorites: string[] = [],
  playlists: Playlist[] = [],
): NavigationScope => ({
  songs,
  favorites,
  getPlaylist: (playlistId) =>
    playlists.find((playlist) => playlist.id === playlistId),
});

const nav = (state: NavigationState): NavigationState => state;

describe("songsForNavigation", () => {
  it("shows the whole library for the songs view regardless of any loaded playlist", () => {
    const songs = [track("a"), track("b")];
    const playlists = [{ id: "p1", name: "Mix", songs: [track("b")] }];

    const result = songsForNavigation(
      nav({ view: "songs" }),
      scopeWith(songs, [], playlists),
    );

    expect(result.map((song) => song.id)).toEqual(["a", "b"]);
  });

  it("shows the whole library for the songs view even when a playlist is loaded", () => {
    const songs = [track("a"), track("b"), track("c")];
    const playlists = [{ id: "p1", name: "One Song", songs: [track("c")] }];

    const result = songsForNavigation(
      nav({ view: "songs" }),
      scopeWith(songs, [], playlists),
    );

    expect(result).toHaveLength(3);
  });

  it("reflects a deletion instead of replaying a captured snapshot", () => {
    const scope = scopeWith([track("a"), track("b")]);
    expect(songsForNavigation(nav({ view: "songs" }), scope)).toHaveLength(2);

    const afterDelete = scopeWith([track("a")]);

    expect(songsForNavigation(nav({ view: "songs" }), afterDelete)).toEqual([
      track("a"),
    ]);
  });

  it("reads the playlist live so a removal inside it disappears", () => {
    const playlist: Playlist = { id: "p1", name: "Mix", songs: [track("a")] };
    const scope = scopeWith([track("a"), track("b")], [], [playlist]);
    expect(
      songsForNavigation(nav({ view: "playlist", playlistId: "p1" }), scope),
    ).toHaveLength(1);

    playlist.songs = [];

    expect(
      songsForNavigation(nav({ view: "playlist", playlistId: "p1" }), scope),
    ).toEqual([]);
  });

  it("returns nothing for a playlist view with no playlist id", () => {
    const scope = scopeWith([track("a")]);

    expect(songsForNavigation(nav({ view: "playlist" }), scope)).toEqual([]);
  });

  it("returns nothing for a playlist view pointing at a missing playlist", () => {
    const scope = scopeWith([track("a")]);

    expect(
      songsForNavigation(nav({ view: "playlist", playlistId: "gone" }), scope),
    ).toEqual([]);
  });

  it("filters the library by artist", () => {
    const scope = scopeWith([
      track("a", { artist: "Alpha" }),
      track("b", { artist: "Beta" }),
    ]);

    expect(
      songsForNavigation(nav({ view: "artist", artist: "Beta" }), scope).map(
        (song) => song.id,
      ),
    ).toEqual(["b"]);
  });

  it("filters the library by album", () => {
    const scope = scopeWith([
      track("a", { album: "One" }),
      track("b", { album: "Two" }),
    ]);

    expect(
      songsForNavigation(nav({ view: "album", album: "One" }), scope).map(
        (song) => song.id,
      ),
    ).toEqual(["a"]);
  });

  it("falls back to the whole library when the artist is missing", () => {
    const scope = scopeWith([track("a"), track("b")]);

    expect(songsForNavigation(nav({ view: "artist" }), scope)).toHaveLength(2);
  });

  it("shows only favorited songs in the favorites view", () => {
    const scope = scopeWith(
      [track("a"), track("b"), track("c")],
      ["b", "missing"],
    );

    expect(
      songsForNavigation(nav({ view: "favorites" }), scope).map(
        (song) => song.id,
      ),
    ).toEqual(["b"]);
  });

  it("filters the library by the search query", () => {
    const scope = scopeWith([
      track("a", { title: "Blue", artist: "X" }),
      track("b", { title: "Red", artist: "Blue Y" }),
    ]);

    expect(
      songsForNavigation(
        nav({ view: "search", searchQuery: "blue" }),
        scope,
      ).map((song) => song.id),
    ).toEqual(["a", "b"]);
  });

  it("shows the whole library for a search view with no query", () => {
    const scope = scopeWith([track("a"), track("b")]);

    expect(songsForNavigation(nav({ view: "search" }), scope)).toHaveLength(2);
  });

  it("shows the whole library for the home view", () => {
    const scope = scopeWith([track("a"), track("b")]);

    expect(songsForNavigation(nav({ view: "home" }), scope)).toHaveLength(2);
  });
});

describe("queueForNavigation", () => {
  it("queues the whole library in the songs view so next walks every track", () => {
    const songs = [track("a"), track("b")];
    const queue = queueForNavigation(nav({ view: "songs" }), scopeWith(songs), labels);

    expect(queue).toEqual({
      id: "all-songs",
      name: "All Songs",
      songs,
    });
  });

  it("queues the stored playlist itself for a playlist view", () => {
    const playlist: Playlist = { id: "p1", name: "Mix", songs: [track("b")] };
    const scope = scopeWith([track("a"), track("b")], [], [playlist]);

    expect(
      queueForNavigation(nav({ view: "playlist", playlistId: "p1" }), scope, labels),
    ).toBe(playlist);
  });

  it("has no queue for a playlist view whose playlist cannot be resolved", () => {
    const scope = scopeWith([track("a")]);

    expect(
      queueForNavigation(nav({ view: "playlist" }), scope, labels),
    ).toBeUndefined();
    expect(
      queueForNavigation(
        nav({ view: "playlist", playlistId: "gone" }),
        scope,
        labels,
      ),
    ).toBeUndefined();
  });

  it("queues favorites for the favorites view", () => {
    const scope = scopeWith([track("a"), track("b")], ["a"]);

    const queue = queueForNavigation(nav({ view: "favorites" }), scope, labels);

    expect(queue).toEqual({
      id: "favorites",
      name: "Favorites",
      songs: [track("a")],
    });
  });

  it("queues the artist filtered by the artist view", () => {
    const scope = scopeWith([
      track("a", { artist: "Alpha" }),
      track("b", { artist: "Beta" }),
    ]);

    const queue = queueForNavigation(
      nav({ view: "artist", artist: "Beta" }),
      scope,
      labels,
    );

    expect(queue?.id).toBe("artist-Beta");
    expect(queue?.songs.map((song) => song.id)).toEqual(["b"]);
  });

  it("has no queue for the home view", () => {
    expect(
      queueForNavigation(nav({ view: "home" }), scopeWith([track("a")]), labels),
    ).toBeUndefined();
  });
});