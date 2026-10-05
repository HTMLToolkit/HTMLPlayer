import type { Track, Playlist } from "../../core/engine/types";
import type { NavigationState } from "./NavigationProvider";

export interface NavigationScope {
  songs: Track[];
  favorites: string[];
  getPlaylist: (playlistId: string) => Playlist | undefined;
}

export interface NavigationLabels {
  allSongs: string;
  favorites: string;
}

function matchesQuery(song: Track, query: string): boolean {
  const lowered = query.toLowerCase();
  return (
    song.title.toLowerCase().includes(lowered) ||
    song.artist.toLowerCase().includes(lowered)
  );
}

export function songsForNavigation(
  state: NavigationState,
  scope: NavigationScope,
): Track[] {
  switch (state.view) {
    case "artist":
      return state.artist
        ? scope.songs.filter((song) => song.artist === state.artist)
        : scope.songs;
    case "album":
      return state.album
        ? scope.songs.filter((song) => song.album === state.album)
        : scope.songs;
    case "favorites": {
      const favorites = new Set(scope.favorites);
      return scope.songs.filter((song) => favorites.has(song.id));
    }
    case "playlist": {
      if (!state.playlistId) return [];
      return scope.getPlaylist(state.playlistId)?.songs ?? [];
    }
    case "search": {
      const query = state.searchQuery;
      return query
        ? scope.songs.filter((song) => matchesQuery(song, query))
        : scope.songs;
    }
    case "home":
    case "songs":
    default:
      return scope.songs;
  }
}

export function queueForNavigation(
  state: NavigationState,
  scope: NavigationScope,
  labels: NavigationLabels,
): Playlist | undefined {
  if (state.view === "playlist" && state.playlistId) {
    const stored = scope.getPlaylist(state.playlistId);
    if (stored) return stored;
  }

  const songs = songsForNavigation(state, scope);

  switch (state.view) {
    case "artist":
      return state.artist
        ? { id: `artist-${state.artist}`, name: state.artist, songs }
        : undefined;
    case "album":
      return state.album
        ? { id: `album-${state.album}`, name: state.album, songs }
        : undefined;
    case "favorites":
      return { id: "favorites", name: labels.favorites, songs };
    case "search":
      return { id: "search", name: state.searchQuery ?? "", songs };
    case "songs":
      return { id: "all-songs", name: labels.allSongs, songs };
    default:
      return undefined;
  }
}
