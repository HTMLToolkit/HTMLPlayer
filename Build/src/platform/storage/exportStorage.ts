import { deleteFile, listFiles, readFile, saveFile } from "./opfs";

const EXPORTS_DIR = "exports";

export interface SavedExport {
  name: string;
  size: number;
  lastModified: number;
}

function exportPath(name: string): string {
  return `${EXPORTS_DIR}/${name}`;
}

export const exportStorage = {
  async save(name: string, contents: string): Promise<SavedExport> {
    const blob = new Blob([contents], { type: "audio/x-mpegurl" });
    await saveFile(exportPath(name), blob);
    return { name, size: blob.size, lastModified: Date.now() };
  },

  async list(): Promise<SavedExport[]> {
    return listFiles(EXPORTS_DIR);
  },

  async read(name: string): Promise<string | null> {
    const blob = await readFile(exportPath(name));
    return blob ? blob.text() : null;
  },

  async remove(name: string): Promise<boolean> {
    return deleteFile(exportPath(name));
  },

  async clear(): Promise<void> {
    for (const entry of await exportStorage.list()) {
      await exportStorage.remove(entry.name);
    }
  },
};
