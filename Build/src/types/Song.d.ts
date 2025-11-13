interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  fileData?: ArrayBuffer;
  mimeType?: string;
  hasStoredAudio?: boolean;
  albumArt?: string;
  embeddedLyrics?: EmbeddedLyrics[];
  encoding?: EncodingDetails;
  gapless?: GaplessInfo;
}

interface EmbeddedLyrics {
  synced: boolean;
  language?: string;
  description?: string;
  text?: string; // for unsynchronized lyrics
  lines?: Array<{
    // for synchronized lyrics
    text: string;
    timestamp: number;
  }>;
}

interface EncodingDetails {
  bitrate?: number;
  codec?: string;
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  container?: string;
  lossless?: boolean;
  profile?: string;
}

interface GaplessInfo {
  encoderDelay?: number;
  encoderPadding?: number;
}
