import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  setupFileHandler,
  type FileHandlerResult,
} from "../platform/storage/fileHandler";
import type { Track } from "../core/engine/types";
import { createLogger } from "../helpers/logger";

const logger = createLogger("useFileHandler");

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
  const [isSupported] = useState(
    () =>
      "launchQueue" in window &&
      typeof window.launchQueue?.setConsumer === "function",
  );
  const pendingFilesRef = useRef<File[]>([]);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (!isSupported) return;

    const cleanup = setupFileHandler(async (result: FileHandlerResult) => {
      if (hasProcessedRef.current) return;

      if (result.files.length > 0) {
        if (isInitialized === false) {
          pendingFilesRef.current.push(...result.files);
          return;
        }

        hasProcessedRef.current = true;
        toast.success(
          t("fileHandler.filesReceived", { count: result.successCount }),
        );
        await importFiles(result.files, addSong, t);
      }
      if (result.errorCount > 0) {
        toast.error(
          t("fileHandler.filesSkipped", { count: result.errorCount }),
        );
      }
    });

    return cleanup;
  }, [addSong, t, importFiles, isInitialized, isSupported]);

  useEffect(() => {
    if (isInitialized && pendingFilesRef.current.length > 0) {
      const filesToProcess = [...pendingFilesRef.current];
      pendingFilesRef.current = [];

      importFiles(filesToProcess, addSong, t)
        .then(() => {
          hasProcessedRef.current = true;
          toast.success(
            t("fileHandler.filesReceived", { count: filesToProcess.length }),
          );
        })
        .catch((error) => {
          logger.error("Failed to process queued files:", { error: String(error) });
          toast.error(
            t("filePicker.failedImport", { count: filesToProcess.length }),
          );
        });
    }
  }, [isInitialized, addSong, t, importFiles]);

  return { isSupported };
}
