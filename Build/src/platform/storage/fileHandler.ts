import { processFiles } from "../utils/fileValidation";
import { createLogger } from "../../helpers/logger";

const logger = createLogger("fileHandler");

declare global {
  interface Window {
    launchQueue?: {
      setConsumer: (
        consumer: (params: { files: FileSystemFileHandle[] | File[] }) => void,
      ) => void;
    };
  }
}

export interface FileHandlerResult {
  files: File[];
  successCount: number;
  errorCount: number;
}

const PROCESSED_FILES_KEY = "processedFiles";

function getProcessedFiles(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(PROCESSED_FILES_KEY) || "[]");
  } catch {
    return [];
  }
}

function markProcessed(file: File) {
  const processed = getProcessedFiles();
  processed.push(`${file.name}-${file.size}-${file.lastModified}`);
  sessionStorage.setItem(PROCESSED_FILES_KEY, JSON.stringify(processed));
}

export function setupFileHandler(
  onFilesReceived: (result: FileHandlerResult) => void,
): () => void {
  if (!("launchQueue" in window) || !window.launchQueue) {
    logger.warn("File Handling API not supported");
    return () => {};
  }

  const consumer = async (launchParams: {
    files: FileSystemFileHandle[] | File[];
  }) => {
    if (!launchParams.files?.length) return;

    const files: File[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const item of launchParams.files) {
      try {
        const file: File =
          "getFile" in item && typeof (item as any).getFile === "function"
            ? await (item as FileSystemFileHandle).getFile()
            : (item as File);
        const processed = getProcessedFiles();
        const fileId = `${file.name}-${file.size}-${file.lastModified}`;

        if (processed.includes(fileId)) {
          logger.debug("Skipping duplicate:", { fileName: file.name });
          continue;
        }

        const valid = processFiles([file]);
        if (valid.length > 0) {
          files.push(file);
          markProcessed(file);
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        logger.error("Error processing file handle:", { error: String(error) });
        errorCount++;
      }
    }

    if (files.length > 0) {
      onFilesReceived({ files, successCount, errorCount });
    }
  };

  window.launchQueue.setConsumer(consumer as any);

  return () => {
    try {
      window.launchQueue?.setConsumer(() => {});
    } catch (e) {
      logger.warn("Could not clear file handler:", { error: String(e) });
    }
  };
}
