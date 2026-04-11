import type { Track, Playlist } from "../../core/engine/types";
import type { SettingsState } from "../settings/types";
import type { SongScore } from "../library/scoring";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("session");

export interface SessionState {
  lastPlayedSongId: string | null;
  lastPlayedPlaylistId: string | null;
  lastPosition: number;
  volume: number;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  timestamp: number;
}

export interface PersistentState {
  library: {
    songs: Track[];
    playlists: Playlist[];
    favorites: string[];
  };
  settings: Partial<SettingsState>;
  scoring: Map<string, SongScore>;
  session: SessionState;
}

const SESSION_KEY = "htmlplayer-session";

export class SessionManager {
  private session: SessionState = {
    lastPlayedSongId: null,
    lastPlayedPlaylistId: null,
    lastPosition: 0,
    volume: 1,
    shuffle: false,
    repeat: "off",
    timestamp: Date.now(),
  };

  saveSession(updates: Partial<SessionState>): void {
    this.session = { ...this.session, ...updates, timestamp: Date.now() };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    } catch (error) {
      logger.error("Failed to save session:", { error: String(error) });
    }
  }

  loadSession(): SessionState {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SessionState>;
        this.session = { ...this.session, ...parsed };
      }
    } catch (error) {
      logger.error("Failed to load session:", { error: String(error) });
    }
    return this.session;
  }

  getSession(): SessionState {
    return { ...this.session };
  }

  clearSession(): void {
    this.session = {
      lastPlayedSongId: null,
      lastPlayedPlaylistId: null,
      lastPosition: 0,
      volume: 1,
      shuffle: false,
      repeat: "off",
      timestamp: Date.now(),
    };
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      logger.error("Failed to clear session:", { error: String(error) });
    }
  }

  saveLastPlayed(songId: string, playlistId?: string, position?: number): void {
    this.saveSession({
      lastPlayedSongId: songId,
      lastPlayedPlaylistId: playlistId || null,
      lastPosition: position || 0,
    });
  }

  getLastPlayed(): {
    songId: string | null;
    playlistId: string | null;
    position: number;
  } {
    return {
      songId: this.session.lastPlayedSongId,
      playlistId: this.session.lastPlayedPlaylistId,
      position: this.session.lastPosition,
    };
  }
}

export const sessionManager = new SessionManager();
