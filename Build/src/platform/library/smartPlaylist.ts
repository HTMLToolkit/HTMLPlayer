import type { Track } from "../../core/engine/types";
import { PointPerSongEngine } from "./scoring";

export interface SmartPlaylistRule {
  type:
    | "genre"
    | "artist"
    | "album"
    | "year"
    | "rating"
    | "playcount"
    | "recent"
    | "random";
  operator?: "equals" | "contains" | "greaterThan" | "lessThan";
  value?: string | number;
}

export interface SmartPlaylistConfig {
  name: string;
  rules: SmartPlaylistRule[];
  limit?: number;
  sortBy?: "shuffle" | "score" | "recent" | "playcount";
}

export class SmartPlaylistEngine {
  private scoringEngine: PointPerSongEngine;

  constructor(scoringEngine: PointPerSongEngine) {
    this.scoringEngine = scoringEngine;
  }

  generatePlaylist(tracks: Track[], config: SmartPlaylistConfig): Track[] {
    let filtered = [...tracks];

    for (const rule of config.rules) {
      filtered = this.applyRule(filtered, rule);
    }

    filtered = this.sortTracks(filtered, config.sortBy || "shuffle");

    if (config.limit && filtered.length > config.limit) {
      filtered = filtered.slice(0, config.limit);
    }

    return filtered;
  }

  private applyRule(tracks: Track[], rule: SmartPlaylistRule): Track[] {
    switch (rule.type) {
      case "artist":
        return this.filterByArtist(tracks, rule);
      case "album":
        return this.filterByAlbum(tracks, rule);
      case "genre":
        return this.filterByGenre(tracks, rule);
      case "year":
        return this.filterByYear(tracks, rule);
      case "rating":
        return this.filterByRating(tracks, rule);
      case "playcount":
        return this.filterByPlayCount(tracks, rule);
      case "recent":
        return this.filterByRecent(tracks, rule);
      case "random":
        return this.shuffleArray(tracks);
      default:
        return tracks;
    }
  }

  private filterByArtist(tracks: Track[], rule: SmartPlaylistRule): Track[] {
    const value = rule.value?.toString().toLowerCase() || "";
    return tracks.filter((track) => {
      if (rule.operator === "equals") {
        return track.artist.toLowerCase() === value;
      }
      return track.artist.toLowerCase().includes(value);
    });
  }

  private filterByAlbum(tracks: Track[], rule: SmartPlaylistRule): Track[] {
    const value = rule.value?.toString().toLowerCase() || "";
    return tracks.filter((track) => {
      if (rule.operator === "equals") {
        return track.album.toLowerCase() === value;
      }
      return track.album.toLowerCase().includes(value);
    });
  }

  private filterByGenre(tracks: Track[], _rule: SmartPlaylistRule): Track[] {
    return tracks;
  }

  private filterByYear(tracks: Track[], _rule: SmartPlaylistRule): Track[] {
    return tracks;
  }

  private filterByRating(tracks: Track[], _rule: SmartPlaylistRule): Track[] {
    return tracks;
  }

  private filterByPlayCount(tracks: Track[], rule: SmartPlaylistRule): Track[] {
    const threshold = (rule.value as number) || 0;

    return tracks.filter((track) => {
      const history = this.scoringEngine.getState();
      const playCount = history.get(track.id)?.playCount || 0;

      if (rule.operator === "greaterThan") {
        return playCount > threshold;
      }
      if (rule.operator === "lessThan") {
        return playCount < threshold;
      }
      return playCount === threshold;
    });
  }

  private filterByRecent(tracks: Track[], rule: SmartPlaylistRule): Track[] {
    const days = (rule.value as number) || 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return tracks.filter((track) => {
      const history = this.scoringEngine.getState();
      const lastPlayed = history.get(track.id)?.lastPlayed || 0;
      return lastPlayed > cutoff;
    });
  }

  private sortTracks(
    tracks: Track[],
    sortBy: "shuffle" | "score" | "recent" | "playcount",
  ): Track[] {
    switch (sortBy) {
      case "shuffle":
        return this.shuffleArray(tracks);
      case "score":
        return tracks.sort((a, b) => {
          const scoreA = this.scoringEngine.getScore(a.id);
          const scoreB = this.scoringEngine.getScore(b.id);
          return scoreB - scoreA;
        });
      case "recent":
        return tracks.sort((a, b) => {
          const history = this.scoringEngine.getState();
          const historyA = history.get(a.id)?.lastPlayed || 0;
          const historyB = history.get(b.id)?.lastPlayed || 0;
          return historyB - historyA;
        });
      case "playcount":
        return tracks.sort((a, b) => {
          const history = this.scoringEngine.getState();
          const countA = history.get(a.id)?.playCount || 0;
          const countB = history.get(b.id)?.playCount || 0;
          return countB - countA;
        });
      default:
        return tracks;
    }
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getDefaultPlaylists(): SmartPlaylistConfig[] {
    return [
      {
        name: "Recently Played",
        rules: [{ type: "recent", value: 7 }],
        limit: 50,
        sortBy: "recent",
      },
      {
        name: "Least Played",
        rules: [{ type: "playcount", operator: "lessThan", value: 3 }],
        limit: 50,
        sortBy: "shuffle",
      },
      {
        name: "Top Rated",
        rules: [{ type: "rating" }],
        limit: 50,
        sortBy: "score",
      },
      {
        name: "Discover",
        rules: [],
        limit: 25,
        sortBy: "shuffle",
      },
    ];
  }
}

export function createSmartPlaylistEngine(
  scoringEngine: PointPerSongEngine,
): SmartPlaylistEngine {
  return new SmartPlaylistEngine(scoringEngine);
}
