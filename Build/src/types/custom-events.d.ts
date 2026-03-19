/// <reference lib="dom" />

export type NavigationView = "home" | "songs" | "artist" | "album" | "playlist" | "search" | "favorites";

export interface NavigateDetail {
  view: NavigationView;
  artist?: string;
  album?: string;
  playlistId?: string;
  searchQuery?: string;
}

export type NavigateCustomEvent = CustomEvent<NavigateDetail>;

export interface NavigateEventMap {
  navigate: NavigateCustomEvent;
}
