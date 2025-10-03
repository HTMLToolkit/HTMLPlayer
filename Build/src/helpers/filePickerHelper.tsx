import { toast } from "sonner";
import { parseBlob, selectCover } from "music-metadata";
import Uppy from "@uppy/core";
import { Dashboard } from "@uppy/react";
import '@uppy/core/css/style.min.css';
import '@uppy/dashboard/css/style.min.css';
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/Dialog";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import i18n from "i18next";

export interface AudioFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface AudioMetadata {
  title: string;
  artist: string;
  album: string;
  duration: number;
  albumArt?: string;
  embeddedLyrics?: EmbeddedLyrics[];
  encoding?: EncodingDetails;
  gapless?: GaplessInfo;
  metadataWarnings?: string[];
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

function buildEncodingDetails(format: any): EncodingDetails | undefined {
  if (!format) return undefined;

  const details: EncodingDetails = {
    bitrate: typeof format.bitrate === "number" ? format.bitrate : undefined,
    codec: typeof format.codec === "string" ? format.codec : undefined,
    sampleRate: typeof format.sampleRate === "number" ? format.sampleRate : undefined,
    channels: typeof format.numberOfChannels === "number" ? format.numberOfChannels : undefined,
    bitsPerSample: typeof format.bitsPerSample === "number" ? format.bitsPerSample : undefined,
    container: typeof format.container === "string" ? format.container : undefined,
    lossless: typeof format.lossless === "boolean" ? format.lossless : undefined,
    profile: typeof format.codecProfile === "string" ? format.codecProfile : undefined,
  };

  return Object.values(details).some((value) => value !== undefined) ? details : undefined;
}

function normaliseTagValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(value);
    } catch {
      return null;
    }
  }
  if (Array.isArray(value) && value.length > 0) {
    return normaliseTagValue(value[0]);
  }
  return null;
}

function parseItunesGapless(value: unknown): GaplessInfo | null {
  const raw = normaliseTagValue(value);
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const hexMatches = cleaned.match(/[0-9A-Fa-f]{8}/g);
  if (!hexMatches || hexMatches.length < 3) return null;

  const delayHex = hexMatches[1];
  const paddingHex = hexMatches[2];

  const encoderDelay = Number.parseInt(delayHex, 16);
  const encoderPadding = Number.parseInt(paddingHex, 16);

  const result: GaplessInfo = {};
  if (Number.isFinite(encoderDelay) && encoderDelay > 0) {
    result.encoderDelay = encoderDelay;
  }
  if (Number.isFinite(encoderPadding) && encoderPadding > 0) {
    result.encoderPadding = encoderPadding;
  }

  return Object.keys(result).length > 0 ? result : null;
}

function buildGaplessInfo(metadata: any): GaplessInfo | undefined {
  if (!metadata) return undefined;

  let gapless: GaplessInfo | undefined;
  const format = metadata.format ?? {};

  const encoderDelay = typeof format.encoderDelay === "number" ? format.encoderDelay : undefined;
  if (typeof encoderDelay === "number" && Number.isFinite(encoderDelay) && encoderDelay > 0) {
    gapless = { ...(gapless ?? {}), encoderDelay };
  }

  const encoderPadding = typeof format.encoderPadding === "number" ? format.encoderPadding : undefined;
  if (typeof encoderPadding === "number" && Number.isFinite(encoderPadding) && encoderPadding > 0) {
    gapless = { ...(gapless ?? {}), encoderPadding };
  }

  for (const tagList of Object.values(metadata?.native ?? {})) {
    if (!Array.isArray(tagList)) continue;
    for (const tag of tagList) {
      const id = typeof tag?.id === "string" ? tag.id.toUpperCase() : "";
      if (!id) continue;

      if (id === "ITUNSMPB" || id.endsWith(":ITUNSMPB")) {
        const parsed = parseItunesGapless(tag?.value);
        if (parsed) gapless = { ...(gapless ?? {}), ...parsed };
        continue;
      }

      if (id === "MP4:----:COM.APPLE.ITUNES:ITUNSMPB" || id === "----:COM.APPLE.ITUNES:ITUNSMPB") {
        const parsed = parseItunesGapless(tag?.value);
        if (parsed) gapless = { ...(gapless ?? {}), ...parsed };
      }
    }
  }

  return gapless;
}

export interface EmbeddedLyrics {
  synced: boolean;
  language?: string;
  description?: string;
  text?: string; // for unsynchronized lyrics
  lines?: Array<{ // for synchronized lyrics
    text: string;
    timestamp: number;
  }>;
}

// Track processing state for beforeunload prompt
let isProcessing = false;

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (isProcessing) {
    event.preventDefault();
    event.returnValue = '';
  }
};

// Function to set processing state and manage beforeunload listener
export function setProcessingState(processing: boolean) {
  isProcessing = processing;
  if (processing) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  } else {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }
}

// Utility for promise with timeout and retries
async function withTimeoutAndRetry<T>(
  promise: Promise<T>,
  timeoutMs: number,
  retries: number,
  errorMessage: string
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout: ${errorMessage}`)), timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`Attempt ${attempt} failed: ${lastError.message}`);
      if (attempt === retries) throw lastError;
    }
  }
  throw lastError || new Error("Unknown error after retries");
}

// ---------------------
// pickAudioFiles (React Uppy version)
// ---------------------
export function pickAudioFiles(): Promise<AudioFile[]> {
  return new Promise((resolve) => {
    const ReactUppyWrapper = () => {
      const { t } = useTranslation();
      const [uppy] = useState(() =>
        new Uppy({
          autoProceed: false,
          restrictions: {
            maxNumberOfFiles: null,
            allowedFileTypes: [
              ".mp3", ".wav", ".m4a", ".flac", ".aif", ".aiff", ".ogg", "audio/*",
            ],
          },
        })
      );

      const [open, setOpen] = useState(true); // modal open state
      const [theme, setTheme] = useState<"light" | "dark">(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );

      // Watch for theme changes
      useEffect(() => {
        const observer = new MutationObserver(() => {
          const mode = document.documentElement.classList.contains("dark") ? "dark" : "light";
          setTheme(mode);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

        return () => observer.disconnect();
      }, []);

      useEffect(() => {
        const audioFiles: AudioFile[] = [];

        const onFileAdded = (file: any) => {
          const processed = processFiles([file.data as File]);
          if (processed.length === 0) {
            uppy.removeFile(file.id);
          } else {
            audioFiles.push(...processed);
          }
        };

        const onComplete = () => {
          // resolve the outer promise
          resolve(audioFiles);
          setOpen(false);
        };

        uppy.on("file-added", onFileAdded);
        uppy.on("complete", onComplete);

        return () => {
          uppy.off("file-added", onFileAdded);
          uppy.off("complete", onComplete);
          uppy.cancelAll();
        };
      }, [uppy]);

      return (
        <Dialog
          open={open}
          onOpenChange={(newOpen) => {
            setOpen(newOpen);
            if (!newOpen) {
              uppy.cancelAll();
              resolve([]); // resolves with [] if nothing selected
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("filePicker.selectAudioFiles")}</DialogTitle>
            </DialogHeader>

            {/* Force remount on theme change */}
            <div key={theme} data-uppy-theme={theme}>
              <Dashboard
                uppy={uppy}
                proudlyDisplayPoweredByUppy={true}
                hideUploadButton={false}
                hideCancelButton={true}
                hideProgressDetails={false}
                note={t("filePicker.onlyAudioFiles")}
              />
            </div>
          </DialogContent>
        </Dialog>
      );
    };

    // Create a container div
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    root.render(<ReactUppyWrapper />);
  });
}



// ---------------------
// Helper to filter valid audio files
// ---------------------
function processFiles(files: File[]): AudioFile[] {
  const valid: AudioFile[] = [];
  const audioTest = document.createElement("audio");
  const allowedExtensions = ["mp3", "wav", "m4a", "flac", "aif", "aiff", "ogg"];

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!file.type.startsWith("audio/") && !(ext && allowedExtensions.includes(ext))) {
      toast.error(`Skipping non-audio file: ${file.name}`);
      continue;
    }
    const canPlay = audioTest.canPlayType(file.type);
    if (canPlay !== "probably" && canPlay !== "maybe") {
      toast.error(`Skipping unsupported audio format by browser: ${file.name} (${file.type})`);
      continue;
    }
    valid.push({ file, name: file.name, size: file.size, type: file.type });
  }
  return valid;
}

// ---------------------
// Existing metadata extraction
// ---------------------
export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
  setProcessingState(true);
  const worker = new Worker(new URL('../workers/metadataWorker.ts', import.meta.url), { type: 'module' });

  try {
    const result = await withTimeoutAndRetry(
      new Promise<AudioMetadata>((resolve, reject) => {
        worker.onmessage = (event) => {
          const { metadata, albumArt, warnings, error } = event.data;
          if (error) reject(new Error(error));
          else {
            // Translate placeholder values from worker
            const translatedMetadata = {
              ...metadata,
              artist: metadata.artist === "__UNKNOWN_ARTIST__" ? i18n.t("common.unknownArtist") : metadata.artist,
              album: metadata.album === "__UNKNOWN_ALBUM__" ? i18n.t("common.unknownAlbum") : metadata.album,
              albumArt,
              metadataWarnings: Array.isArray(warnings) ? warnings : undefined
            };

            if (Array.isArray(warnings) && warnings.length > 0) {
              for (const warning of warnings) {
                console.warn(`Metadata warning for ${file.name}:`, warning);
              }
            }
            resolve(translatedMetadata);
          }
        };
        worker.onerror = (error) => reject(new Error('Worker error: ' + error.message));
        worker.postMessage({ file, fileName: file.name });
      }),
      15000,
      3,
      `Metadata extraction for ${file.name}`
    );
    return result;
  } catch (e) {
    console.warn(`Failed to read metadata for ${file.name}:`, e);
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    let title = fileName,
      artist = i18n.t("common.unknownArtist"),
      album = i18n.t("common.unknownAlbum"),
      duration = 0,
      albumArt: string | undefined,
      encoding: EncodingDetails | undefined,
      gapless: GaplessInfo | undefined;

    try {
      const metadata = await withTimeoutAndRetry(
        parseBlob(file, { skipCovers: false, duration: true }),
        15000,
        3,
        `Fallback metadata parsing for ${file.name}`
      );

      if (metadata.common) {
        if (typeof metadata.common.artist === "string") artist = metadata.common.artist;
        if (typeof metadata.common.title === "string") title = metadata.common.title;
        if (typeof metadata.common.album === "string") album = metadata.common.album;
        duration = metadata.format.duration ?? 0;
        encoding = buildEncodingDetails(metadata.format);
        gapless = buildGaplessInfo(metadata);

        const cover = selectCover(metadata.common.picture);
        if (cover && cover.data.length > 0) {
          const blob = new Blob([new Uint8Array(cover.data)], { type: cover.format });
          albumArt = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read album art'));
            reader.readAsDataURL(blob);
          });
        }
      }
    } catch {
      if (fileName.includes(" - ")) {
        const parts = fileName.split(" - ");
        if (parts.length >= 2) {
          artist = parts[0].trim();
          title = parts[1].trim();
        }
      }
    }

    return { title, artist, album, duration, albumArt, encoding, gapless };
  } finally {
    worker.terminate();
    setProcessingState(false);
  }
}

// ---------------------
// URL + ID helpers
// ---------------------
export function createAudioUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
