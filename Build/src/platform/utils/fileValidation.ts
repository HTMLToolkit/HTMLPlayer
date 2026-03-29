import { createLogger } from "../../helpers/logger";

const logger = createLogger("fileValidation");

const ALLOWED_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "flac",
  "aif",
  "aiff",
  "ogg",
  "flo",
];

export interface AudioFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

export function processFiles(files: File[]): AudioFile[] {
  const valid: AudioFile[] = [];
  const audioTest = document.createElement("audio");

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (
      !file.type.startsWith("audio/") &&
      !(ext && ALLOWED_EXTENSIONS.includes(ext))
    ) {
      logger.warn(`Skipping non-audio file: ${file.name}`);
      continue;
    }
    if (ext !== "flo") {
      const canPlay = audioTest.canPlayType(file.type);
      if (canPlay !== "probably" && canPlay !== "maybe") {
        logger.warn(`Skipping unsupported format: ${file.name}`);
        continue;
      }
    }
    valid.push({ file, name: file.name, size: file.size, type: file.type });
  }
  return valid;
}
