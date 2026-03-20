import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/react/dashboard";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/components/primitives/Dialog";
import { ThemeProvider } from "../ui/theming";
import type { Track } from "../core/engine/types";

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

let isProcessing = false;

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (isProcessing) {
    event.preventDefault();
    event.returnValue = "";
  }
};

export function setProcessingState(processing: boolean) {
  isProcessing = processing;
  if (processing) {
    window.addEventListener("beforeunload", handleBeforeUnload);
  } else {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }
}

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
      toast.error(`Skipping non-audio file: ${file.name}`);
      continue;
    }
    if (ext !== "flo") {
      const canPlay = audioTest.canPlayType(file.type);
      if (canPlay !== "probably" && canPlay !== "maybe") {
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

      const [open, setOpen] = useState(true);
      const [theme, setTheme] = useState<"light" | "dark">(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );

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
              resolve([]);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("filePicker.selectAudioFiles")}</DialogTitle>
            </DialogHeader>
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

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    root.render(
      <ThemeProvider>
        <ReactUppyWrapper />
      </ThemeProvider>,
    );
  });
}

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
    return () => {};
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
        window.launchQueue.setConsumer(() => {});
      } catch (e) {
        console.warn("Could not clear file handler consumer:", e);
      }
    }
  };
}

export interface ShareTargetResult {
  files: File[];
  title?: string;
  text?: string;
  url?: string;
  type: "files" | "search" | "none";
}

const SHARE_HANDLED_KEY = "last-shared-files";

function getHandledShares(): Set<string> {
  try {
    return new Set(
      JSON.parse(sessionStorage.getItem(SHARE_HANDLED_KEY) || "[]"),
    );
  } catch {
    return new Set();
  }
}

function markHandled(files: File[]) {
  const handled = getHandledShares();
  files.forEach((f) => handled.add(`${f.name}:${f.size}`));
  sessionStorage.setItem(
    SHARE_HANDLED_KEY,
    JSON.stringify(Array.from(handled)),
  );
}

export function clearHandledShares() {
  sessionStorage.removeItem(SHARE_HANDLED_KEY);
}

export function handleShareTarget(): ShareTargetResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const title = urlParams.get("title") || undefined;
  const text = urlParams.get("text") || undefined;
  const url = urlParams.get("url") || undefined;

  if (title || text) {
    return {
      files: [],
      title,
      text,
      url,
      type: "search",
    };
  }

  return null;
}

export function useShareTarget(
  onShareReceived: (result: ShareTargetResult) => void,
) {
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;

    async function processShare() {
      const urlParams = new URLSearchParams(window.location.search);

      if (urlParams.get("share-received") === "true") {
        try {
          const cache = await caches.open("incoming-shares");
          const files: File[] = [];
          let i = 0,
            foundAny = false;
          while (true) {
            const key = i === 0 ? "/shared-file" : `/shared-file-${i}`;
            const response = await cache.match(key);
            if (!response) break;
            const blob = await response.blob();
            const filenameRaw = response.headers.get("x-file-name");
            const filename = filenameRaw
              ? decodeURIComponent(filenameRaw)
              : `shared-audio${i ? "-" + i : ""}.mp3`;
            files.push(new File([blob], filename, { type: blob.type }));
            await cache.delete(key);
            foundAny = true;
            i++;
          }

          if (foundAny) {
            const handled = getHandledShares();
            const newFiles = files.filter(
              (f) => !handled.has(`${f.name}:${f.size}`),
            );
            if (newFiles.length === 0) {
              return;
            }
            markHandled(newFiles);

            hasProcessedRef.current = true;
            onShareReceived({ files: newFiles, type: "files" });

            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("share-received");
            window.history.replaceState({}, "", cleanUrl.toString());
            return;
          }
        } catch (e) {
          console.error("Failed to retrieve shared file from cache", e);
        }
      }

      const shareResult = handleShareTarget();
      if (shareResult && shareResult.type !== "none") {
        hasProcessedRef.current = true;
        onShareReceived(shareResult);

        const url = new URL(window.location.href);
        ["title", "text", "url"].forEach((p) => url.searchParams.delete(p));
        window.history.replaceState({}, "", url.toString());
      }
    }

    processShare();
  }, [onShareReceived]);
}

export function useFileHandler(
  addSong: (song: Track) => Promise<void>,
  t: any,
  importFiles: (
    files: File[],
    addSong: (song: Track) => Promise<void>,
    t: any,
  ) => Promise<void>,
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
      if (hasProcessedFilesRef.current) return;

      if (result.files.length > 0) {
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
        await importFiles(result.files, addSong, t);
        processedFilesRef.current.clear();
      }
      if (result.errorCount > 0) {
        toast.error(
          t("fileHandler.filesSkipped", { count: result.errorCount }),
        );
      }
    });

    return cleanup;
  }, [addSong, t, importFiles, isInitialized]);

  useEffect(() => {
    if (isInitialized && pendingFilesRef.current.length > 0) {
      console.log("Library initialized, processing queued files");
      const filesToProcess = [...pendingFilesRef.current];
      pendingFilesRef.current = [];

      importFiles(filesToProcess, addSong, t)
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
  }, [isInitialized, addSong, t, importFiles]);

  return { isSupported };
}
