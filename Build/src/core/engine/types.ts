export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  mimeType?: string;
  hasStoredAudio?: boolean;
  albumArt?: string;
  hasAlbumArt?: boolean;
  embeddedLyrics?: EmbeddedLyrics[];
  encoding?: EncodingDetails;
  gapless?: GaplessInfo;
  replayGain?: ReplayGainInfo;
}

export interface EmbeddedLyrics {
  synced: boolean;
  language?: string;
  description?: string;
  text?: string;
  lines?: LyricLine[];
}

export interface LyricLine {
  text: string;
  timestamp: number;
}

export interface EncodingDetails {
  bitrate?: number;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  container?: string;
  lossless?: boolean;
  profile?: string;
}

export interface GaplessInfo {
  encoderDelay?: number;
  encoderPadding?: number;
}

export interface ReplayGainInfo {
  trackGain?: number;
  trackPeak?: number;
  albumGain?: number;
  albumPeak?: number;
  referenceLoudness?: number;
}

export interface Playlist {
  id: string;
  name: string;
  songs: Track[];
}

export interface PlaylistFolder {
  id: string;
  name: string;
  children: (Playlist | PlaylistFolder)[];
}

export type PlaylistItem = Playlist | PlaylistFolder;

export type QueueCursor =
  | { kind: "empty" }
  | { kind: "active"; index: number };

export function isQueueCursorEmpty(
  cursor: QueueCursor,
): cursor is { kind: "empty" } {
  return cursor.kind === "empty";
}

export function isQueueCursorActive(
  cursor: QueueCursor,
): cursor is { kind: "active"; index: number } {
  return cursor.kind === "active";
}

export interface QueueState {
  tracks: Track[];
  cursor: QueueCursor;
  shuffled: boolean;
  shuffleOrder: number[];
}

/**
 * Type guard for play history entries.
 */
export function isPlayHistory(value: unknown): value is PlayHistory {
  if (typeof value !== "object" || value === null) return false;
  return (
    "trackId" in value &&
    "lastPlayed" in value &&
    "playCount" in value &&
    typeof value.trackId === "string" &&
    typeof value.lastPlayed === "number" &&
    typeof value.playCount === "number"
  );
}

export interface PlayHistory {
  trackId: string;
  lastPlayed: number;
  playCount: number;
}

export interface EngineSettings {
  volume: number;
  crossfade: number;
  crossfadeBeforeGapless: number;
  autoPlayNext: boolean;
  tempo: number;
  pitch: number;
  gaplessPlayback: boolean;
  smartShuffle: boolean;
  repeat: RepeatMode;
  defaultShuffle: boolean;
  defaultRepeat: RepeatMode;
}

export type RepeatMode = "off" | "one" | "all";

export type PlayerState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "transitioning"
  | "error";

export interface EngineState {
  state: PlayerState;
  currentTrack: Track | null;
  currentPlaylist: Playlist | null;
  queue: QueueState;
  settings: EngineSettings;
  currentTime: number;
  duration: number;
  volume: number;
  playHistory: Map<string, PlayHistory>;
  error: EngineError | null;
}

export interface EngineError {
  code: string;
  message: string;
  track?: Track;
}

export type EngineEvent =
  | "statechange"
  | "trackchange"
  | "timeupdate"
  | "durationchange"
  | "volumechange"
  | "queuechange"
  | "settingschange"
  | "ended"
  | "loading"
  | "ready"
  | "error";

export interface EngineEventMap {
  statechange: { oldState: PlayerState; newState: PlayerState };
  trackchange: { from: Track | null; to: Track | null };
  timeupdate: { currentTime: number; duration: number };
  durationchange: { duration: number };
  volumechange: { volume: number };
  queuechange: { queue: QueueState };
  settingschange: { settings: Partial<EngineSettings> };
  ended: { track: Track };
  loading: { track: Track };
  ready: { track: Track };
  error: { error: EngineError };
}

export interface CrossfadeConfig {
  enabled: boolean;
  duration: number;
  shape: CrossfadeShape;
}

export type CrossfadeShape = "none" | "linear" | "equalpower";

export interface GaplessConfig {
  enabled: boolean;
  startOffset: number;
  endOffset: number;
}
