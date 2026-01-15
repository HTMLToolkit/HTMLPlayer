import { toast } from "sonner";
import { parseBlob, selectCover } from "music-metadata";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/Dialog";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { IconRegistryProvider } from "./iconLoader";
import { importAudioFiles } from "./importAudioFiles";

// Extend Window interface for File Handling API
declare global {
  interface Window {
    launchQueue?: {
      setConsumer: (
        consumer: (launchParams: {
          files: FileSystemFileHandle[] | File[];
        }) => void,
      ) => void;
    };
  }
}

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

/**
 * Compress album art to reduce memory usage
 * Skips compression for animated images (WebP, GIF) to preserve animation
 */
async function compressAlbumArt(
  base64: string,
  maxSize = 200,
): Promise<string> {
  // Check if it's an animated format
  const isAnimatedFormat =
    base64.startsWith("data:image/webp") || base64.startsWith("data:image/gif");

  if (isAnimatedFormat) {
    console.log("Skipping compression for animated image");
    return base64; // Return original to preserve animation
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onerror = () => reject(new Error("Failed to load image"));

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Resize if too large (maintain aspect ratio)
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height / width) * maxSize);
          width = maxSize;
        } else {
          width = Math.round((width / height) * maxSize);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      // Compress to JPEG at 70% quality
      const compressed = canvas.toDataURL("image/jpeg", 0.7);

      console.log(
        `Album art compressed: ${(base64.length / 1024).toFixed(1)}KB → ${(compressed.length / 1024).toFixed(1)}KB`,
      );

      // Clean up the canvas to free memory
      canvas.width = 0;
      canvas.height = 0;

      resolve(compressed);
    };

    img.src = base64;
  });
}

function buildEncodingDetails(format: any): EncodingDetails | undefined {
  if (!format) return undefined;

  const details: EncodingDetails = {
    bitrate: typeof format.bitrate === "number" ? format.bitrate : undefined,
    codec: typeof format.codec === "string" ? format.codec : undefined,
    sampleRate:
      typeof format.sampleRate === "number" ? format.sampleRate : undefined,
    channels:
      typeof format.numberOfChannels === "number"
        ? format.numberOfChannels
        : undefined,
    bitsPerSample:
      typeof format.bitsPerSample === "number"
        ? format.bitsPerSample
        : undefined,
    container:
      typeof format.container === "string" ? format.container : undefined,
    lossless:
      typeof format.lossless === "boolean" ? format.lossless : undefined,
    profile:
      typeof format.codecProfile === "string" ? format.codecProfile : undefined,
  };

  return Object.values(details).some((value) => value !== undefined)
    ? details
    : undefined;
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

  const encoderDelay =
    typeof format.encoderDelay === "number" ? format.encoderDelay : undefined;
  if (
    typeof encoderDelay === "number" &&
    Number.isFinite(encoderDelay) &&
    encoderDelay > 0
  ) {
    gapless = { ...(gapless ?? {}), encoderDelay };
  }

  const encoderPadding =
    typeof format.encoderPadding === "number"
      ? format.encoderPadding
      : undefined;
  if (
    typeof encoderPadding === "number" &&
    Number.isFinite(encoderPadding) &&
    encoderPadding > 0
  ) {
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

      if (
        id === "MP4:----:COM.APPLE.ITUNES:ITUNSMPB" ||
        id === "----:COM.APPLE.ITUNES:ITUNSMPB"
      ) {
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
  lines?: Array<{
    // for synchronized lyrics
    text: string;
    timestamp: number;
  }>;
}

// Track processing state for beforeunload prompt
let isProcessing = false;

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (isProcessing) {
    event.preventDefault();
    event.returnValue = "";
  }
};

// Function to set processing state and manage beforeunload listener
export function setProcessingState(processing: boolean) {
  isProcessing = processing;
  if (processing) {
    window.addEventListener("beforeunload", handleBeforeUnload);
  } else {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }
}

// Utility for promise with timeout and retries
async function withTimeoutAndRetry<T>(
  promise: Promise<T>,
  timeoutMs: number,
  retries: number,
  errorMessage: string,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Timeout: ${errorMessage}`)),
          timeoutMs,
        );
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
      const [uppy] = useState(
        () =>
          new Uppy({
            autoProceed: false,
            restrictions: {
              maxNumberOfFiles: null,
              allowedFileTypes: [
                ".mp3",
                ".wav",
                ".m4a",
                ".flac",
                ".aif",
                ".aiff",
                ".ogg",
                ".flo",
                "audio/*",
              ],
            },
          }),
      );

      const [open, setOpen] = useState(true); // modal open state
      const [theme, setTheme] = useState<"light" | "dark">(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );

      // Watch for theme changes
      useEffect(() => {
        const observer = new MutationObserver(() => {
          const mode = document.documentElement.classList.contains("dark")
            ? "dark"
            : "light";
          setTheme(mode);
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

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
        <IconRegistryProvider defaultSetId="lucide">
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
        </IconRegistryProvider>
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
  const allowedExtensions = [
    "mp3",
    "wav",
    "m4a",
    "flac",
    "aif",
    "aiff",
    "ogg",
    "flo",
  ];

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (
      !file.type.startsWith("audio/") &&
      !(ext && allowedExtensions.includes(ext))
    ) {
      // TODO: i18n-ize
      toast.error(`Skipping non-audio file: ${file.name}`);
      continue;
    }
    // For .flo files, skip browser canPlayType check (handled by custom decoder)
    if (ext !== "flo") {
      const canPlay = audioTest.canPlayType(file.type);
      if (canPlay !== "probably" && canPlay !== "maybe") {
        // TODO: i18n-ize
        toast.error(
          `Skipping unsupported audio format by browser: ${file.name} (${file.type})`,
        );
        continue;
      }
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

  const ext = file.name.split(".").pop()?.toLowerCase();

  // Use flo-specific extraction for .flo files
  if (ext === "flo") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const {
        getFloMetadata,
        getFloCoverArt,
        getFloSyncedLyrics,
        getFloInfo
      } = await import("./floProcessor");

      // Get all flo data in parallel
      const [meta, cover, lyrics, info] = await Promise.all([
        getFloMetadata(arrayBuffer),
        getFloCoverArt(arrayBuffer),
        getFloSyncedLyrics(arrayBuffer),
        getFloInfo(arrayBuffer),
      ]);

      // Process album art if available
      let albumArt: string | undefined = undefined;
      if (cover && cover.data && cover.data.length > 0) {
        const blob = new Blob([cover.data], { type: cover.mime_type });
        albumArt = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read album art"));
          reader.readAsDataURL(blob);
        });
      }

      // Convert synced lyrics to EmbeddedLyrics format
      let embeddedLyrics: EmbeddedLyrics[] | undefined = undefined;
      if (Array.isArray(lyrics) && lyrics.length > 0) {
        embeddedLyrics = [
          {
            synced: true,
            lines: lyrics.map((l) => ({
              text: l.text,
              timestamp: l.timestamp_ms / 1000, // Convert ms to seconds
            })),
          },
        ];
      }

      // Build encoding details from info
      const encoding: EncodingDetails = {
        bitrate: undefined, // flo doesn't provide bitrate directly
        codec: "flo",
        sampleRate: info?.sample_rate,
        channels: info?.channels,
        bitsPerSample: info?.bit_depth,
        container: "flo",
        lossless: !info?.is_lossy,
        profile: info?.is_lossy ? "lossy" : "lossless",
      };

      return {
        title: meta?.title || file.name.replace(/\.[^/.]+$/, ""),
        artist: meta?.artist || i18n.t("common.unknownArtist"),
        album: meta?.album || i18n.t("common.unknownAlbum"),
        duration: info?.duration_secs || 0,
        albumArt,
        embeddedLyrics,
        encoding,
        gapless: undefined, // flo doesn't expose gapless info currently
        metadataWarnings: undefined,
      };
    } catch (error) {
      console.error("Failed to extract flo metadata:", error);
      // Fallback to basic file info
      return {
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: i18n.t("common.unknownArtist"),
        album: i18n.t("common.unknownAlbum"),
        duration: 0,
        albumArt: undefined,
        embeddedLyrics: undefined,
        encoding: {
          codec: "flo",
          container: "flo",
        },
        gapless: undefined,
      };
    } finally {
      setProcessingState(false);
    }
  }
  // Fallback to original (music-metadata) for all other formats
  let MetadataWorkerType: typeof Worker;
  if ((typeof __IS_SINGLE_FILE__ !== "undefined") && __IS_SINGLE_FILE__) {
    MetadataWorkerType = (await import("../workers/metadataWorker.ts?worker&inline")).default;
  } else {
    MetadataWorkerType = (await import("../workers/metadataWorker.ts?worker")).default;
  }
  const worker = new MetadataWorkerType();

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
              artist:
                metadata.artist === "__UNKNOWN_ARTIST__"
                  ? i18n.t("common.unknownArtist")
                  : metadata.artist,
              album:
                metadata.album === "__UNKNOWN_ALBUM__"
                  ? i18n.t("common.unknownAlbum")
                  : metadata.album,
              albumArt,
              metadataWarnings: Array.isArray(warnings) ? warnings : undefined,
            };
            if (Array.isArray(warnings) && warnings.length > 0) {
              for (const warning of warnings) {
                // Suppress repetitive ID3v2.3 warnings that spam the console
                if (
                  warning.includes("Invalid ID3v2.3 frame-header-ID") ||
                  warning.includes("id3v2.3 header has empty tag type")
                ) {
                  continue;
                }
                console.warn(`Metadata warning for ${file.name}:`, warning);
              }
            }
            resolve(translatedMetadata);
          }
        };
        worker.onerror = (error) =>
          reject(new Error("Worker error: " + error.message));
        worker.postMessage({ file, fileName: file.name });
      }),
      15000,
      3,
      `Metadata extraction for ${file.name}`,
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
        `Fallback metadata parsing for ${file.name}`,
      );

      if (metadata.common) {
        if (typeof metadata.common.artist === "string")
          artist = metadata.common.artist;
        if (typeof metadata.common.title === "string")
          title = metadata.common.title;
        if (typeof metadata.common.album === "string")
          album = metadata.common.album;
        duration = metadata.format.duration ?? 0;
        encoding = buildEncodingDetails(metadata.format);
        gapless = buildGaplessInfo(metadata);

        // Find this section in extractAudioMetadata (around line 420)
        const cover = selectCover(metadata.common.picture);
        if (cover && cover.data.length > 0) {
          const blob = new Blob([new Uint8Array(cover.data)], {
            type: cover.format,
          });
          albumArt = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const base64 = reader.result as string;
                // Compress album art to save memory
                const compressed = await compressAlbumArt(base64);
                resolve(compressed);
              } catch (error) {
                console.warn("Failed to compress album art:", error);
                // Fallback to original if compression fails
                resolve(reader.result as string);
              }
            };
            reader.onerror = () =>
              reject(new Error("Failed to read album art"));
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

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ---------------------
// File Handling API support for PWAs
// ---------------------
export interface FileHandlerResult {
  files: File[];
  successCount: number;
  errorCount: number;
}

export function setupFileHandler(
  onFilesReceived: (result: FileHandlerResult) => void,
): () => void {
  if (
    !("launchQueue" in window) ||
    !window.launchQueue ||
    typeof window.launchQueue.setConsumer !== "function"
  ) {
    console.warn("File Handling API not supported in this browser");
    return () => { }; // Return empty cleanup function
  }

  const consumer = async (launchParams: any) => {
    if (!launchParams.files || launchParams.files.length === 0) {
      console.log("No files provided by File Handling or Share Target API");
      return;
    }

    const files: File[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const fileHandle of launchParams.files) {
      try {
        let file: File;
        if (fileHandle.getFile) {
          file = await fileHandle.getFile();
        } else {
          file = fileHandle;
        }

        const fileId = `${file.name}-${file.size}-${file.lastModified}`;

        // Check sessionStorage for processed files
        const processedFiles = JSON.parse(
          sessionStorage.getItem("processedFiles") || "[]",
        );
        if (processedFiles.includes(fileId)) {
          console.log("Skipping duplicate file:", file.name);
          continue;
        }

        const processed = processFiles([file]);
        if (processed.length > 0) {
          files.push(file);
          processedFiles.push(fileId);
          sessionStorage.setItem(
            "processedFiles",
            JSON.stringify(processedFiles),
          );
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error("Error processing file handle:", error);
        errorCount++;
      }
    }

    if (files.length > 0) {
      onFilesReceived({ files, successCount, errorCount });
    }
  };

  window.launchQueue.setConsumer(consumer);

  return () => {
    if (
      "launchQueue" in window &&
      window.launchQueue &&
      typeof window.launchQueue.setConsumer === "function"
    ) {
      try {
        window.launchQueue.setConsumer(() => { });
      } catch (e) {
        console.warn("Could not clear file handler consumer:", e);
      }
    }
  };
}

// ---------------------
// Share Target API support for PWAs
// ---------------------
export interface ShareTargetResult {
  files: File[];
  title?: string;
  text?: string;
  url?: string;
  type: "files" | "search" | "none";
}

export function handleShareTarget(): ShareTargetResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const title = urlParams.get("title") || undefined;
  const text = urlParams.get("text") || undefined;
  const url = urlParams.get("url") || undefined;

  if (title || text || url) {
    // Handle text sharing
    return {
      files: [],
      title,
      text,
      url,
      type: "search",
    };
  }

  // Handle files shared via Cache API
  return null; // Will be handled in useShareTarget
}

export function useShareTarget(
  onShareReceived: (result: ShareTargetResult) => void
) {
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;

    async function processShare() {
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.get("share-received") === "true") {
        try {
          const cache = await caches.open("incoming-shares");
          const keys = await cache.keys();

          const files: File[] = [];
          for (const key of keys) {
            if (key.url.includes("/shared-file-")) {
              const response = await cache.match(key);
              const blob = await response?.blob();
              const fileName =
                response?.headers.get("x-file-name") || "unknown-file";
              files.push(new File([blob!], fileName, { type: blob?.type }));
            }
          }

          if (files.length > 0) {
            hasProcessedRef.current = true;
            onShareReceived({ files, type: "files" });

            // Cleanup the cache after processing
            for (const key of keys) {
              await cache.delete(key);
            }

            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("share-received");
            window.history.replaceState({}, "", cleanUrl.toString());
            return;
          }
        } catch (error) {
          console.error("Failed to retrieve shared files:", error);
        }
      }

      // Fallback to text sharing (e.g., query parameters)
      const shareResult = handleShareTarget();
      if (shareResult) {
        hasProcessedRef.current = true;
        onShareReceived(shareResult);
      }
    }

    processShare();
  }, [onShareReceived]);
}

export function useFileHandler(
  addSong: (song: Song) => Promise<void>,
  t: any,
  isInitialized?: boolean,
) {
  const [isSupported, setIsSupported] = useState(false);
  const processedFilesRef = useRef(new Set<string>());
  const hasProcessedFilesRef = useRef(false);
  const pendingFilesRef = useRef<File[]>([]);

  useEffect(() => {
    const supported =
      "launchQueue" in window &&
      typeof window.launchQueue?.setConsumer === "function";
    setIsSupported(supported);

    if (!supported) return;

    const cleanup = setupFileHandler(async (result) => {
      // Prevent processing if we've already handled files on this page load
      if (hasProcessedFilesRef.current) return;

      if (result.files.length > 0) {
        // If library is not initialized yet, queue the files
        if (isInitialized === false) {
          console.log(
            "Library not initialized, queuing files for later processing",
          );
          pendingFilesRef.current.push(...result.files);
          return;
        }

        hasProcessedFilesRef.current = true;
        toast.success(
          t("fileHandler.filesReceived", { count: result.successCount }),
        );
        await importAudioFiles(result.files, addSong, t);
        // Clear processed files after successful import to allow re-importing the same files
        processedFilesRef.current.clear();
      }
      if (result.errorCount > 0) {
        toast.error(
          t("fileHandler.filesSkipped", { count: result.errorCount }),
        );
      }
    });

    return cleanup;
  }, [addSong, t, isInitialized]);

  // Process queued files when library becomes initialized
  useEffect(() => {
    if (isInitialized && pendingFilesRef.current.length > 0) {
      console.log("Library initialized, processing queued files");
      const filesToProcess = [...pendingFilesRef.current];
      pendingFilesRef.current = [];

      // Process the queued files
      importAudioFiles(filesToProcess, addSong, t)
        .then(() => {
          hasProcessedFilesRef.current = true;
          processedFilesRef.current.clear();
          toast.success(
            t("fileHandler.filesReceived", { count: filesToProcess.length }),
          );
        })
        .catch((error) => {
          console.error("Failed to process queued files:", error);
          toast.error(
            t("filePicker.failedImport", { count: filesToProcess.length }),
          );
        });
    }
  }, [isInitialized, addSong, t]);

  return { isSupported };
}
