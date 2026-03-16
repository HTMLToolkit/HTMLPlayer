export interface SongScore {
  trackId: string;
  score: number;
  playCount: number;
  lastPlayed: number;
  skipCount: number;
  manualBoost: number;
}

export interface ScoringConfig {
  inversePlayCountWeight: number;
  freshnessWeight: number;
  similarityWeight: number;
  timeOfDayWeight: number;
  manualWeight: number;
  decayFactor: number;
}

export interface TimeOfDayScore {
  morning: number;
  afternoon: number;
  evening: number;
  night: number;
}

export interface SeasonScore {
  spring: number;
  summer: number;
  fall: number;
  winter: number;
}

const DEFAULT_CONFIG: ScoringConfig = {
  inversePlayCountWeight: 2.0,
  freshnessWeight: 1.5,
  similarityWeight: 1.0,
  timeOfDayWeight: 0.5,
  manualWeight: 3.0,
  decayFactor: 0.95,
};

export class PointPerSongEngine {
  private scores: Map<string, SongScore> = new Map();
  private config: ScoringConfig = DEFAULT_CONFIG;

  constructor(config?: Partial<ScoringConfig>) {
    if (config) {
      this.config = { ...DEFAULT_CONFIG, ...config };
    }
  }

  getScore(trackId: string): number {
    return this.scores.get(trackId)?.score ?? 0;
  }

  getAllScores(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [id, data] of this.scores) {
      result.set(id, data.score);
    }
    return result;
  }

  recordPlay(trackId: string): void {
    const existing = this.scores.get(trackId);
    if (existing) {
      existing.playCount += 1;
      existing.lastPlayed = Date.now();
      this.recalculate(trackId);
    } else {
      this.scores.set(trackId, {
        trackId,
        score: this.calculateInitialScore(),
        playCount: 1,
        lastPlayed: Date.now(),
        skipCount: 0,
        manualBoost: 0,
      });
    }
  }

  recordSkip(trackId: string): void {
    const existing = this.scores.get(trackId);
    if (existing) {
      existing.skipCount += 1;
      existing.score *= this.config.decayFactor;
    }
  }

  setManualBoost(trackId: string, boost: number): void {
    const existing = this.scores.get(trackId);
    if (existing) {
      existing.manualBoost = Math.max(-10, Math.min(10, boost));
      this.recalculate(trackId);
    }
  }

  getWeightedRandomTrack(trackIds: string[]): string | null {
    if (trackIds.length === 0) return null;
    if (trackIds.length === 1) return trackIds[0];

    const scores = trackIds.map((id) => this.scores.get(id)?.score ?? 0);
    const minScore = Math.min(...scores);
    const adjustedScores = scores.map((s) => s - minScore + 1);

    const total = adjustedScores.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;

    for (let i = 0; i < trackIds.length; i++) {
      random -= adjustedScores[i];
      if (random <= 0) {
        return trackIds[i];
      }
    }

    return trackIds[trackIds.length - 1];
  }

  private calculateInitialScore(): number {
    return 100;
  }

  private recalculate(trackId: string): void {
    const data = this.scores.get(trackId);
    if (!data) return;

    const inversePlayScore = Math.max(0, 10 - data.playCount);
    const freshnessScore = this.getFreshnessScore(data.lastPlayed);
    const timeScore = this.getTimeOfDayScore();
    const manualScore = data.manualBoost * 10;

    data.score =
      inversePlayScore * this.config.inversePlayCountWeight +
      freshnessScore * this.config.freshnessWeight +
      timeScore * this.config.timeOfDayWeight +
      manualScore * this.config.manualWeight;
  }

  private getFreshnessScore(lastPlayed: number): number {
    const now = Date.now();
    const daysSince = (now - lastPlayed) / (1000 * 60 * 60 * 24);
    return Math.max(0, 10 - daysSince);
  }

  private getTimeOfDayScore(): number {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 1;
    if (hour >= 12 && hour < 17) return 0.8;
    if (hour >= 17 && hour < 21) return 1;
    return 0.5;
  }

  getTopTracks(trackIds: string[], count = 10): string[] {
    const scored = trackIds
      .map((id) => ({
        id,
        score: this.scores.get(id)?.score ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count);

    return scored.map((s) => s.id);
  }

  getState(): Map<string, SongScore> {
    return new Map(this.scores);
  }

  setState(scores: Map<string, SongScore>): void {
    this.scores = new Map(scores);
  }

  clear(): void {
    this.scores.clear();
  }
}

export function createPointPerSongEngine(config?: Partial<ScoringConfig>): PointPerSongEngine {
  return new PointPerSongEngine(config);
}