import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { LibraryManager } from "../platform/library";
import { pickDirectory } from "../platform/storage/directoryHandle";
import type { M3uMatchMode } from "../platform/storage/m3uImport";
import {
  remapM3uEntry,
  runM3uImport,
  type M3uImportDeps,
  type M3uImportOutcome,
} from "../platform/storage/m3uSession";

export type { M3uImportOutcome } from "../platform/storage/m3uSession";

function depsFor(
  library: LibraryManager,
  t: M3uImportDeps["t"],
): M3uImportDeps {
  return {
    getTracks: () => library.getState().songs,
    addTrack: (track) => library.addSong(track),
    addPlaylist: (playlist) => library.addPlaylist(playlist),
    addToPlaylist: (playlistId, track) =>
      library.addToPlaylist(playlistId, track),
    pickBaseDirectory: pickDirectory,
    t,
  };
}

export function useM3uImport(library: LibraryManager) {
  const { t } = useTranslation();
  const [isImporting, setIsImporting] = useState(false);

  const importPlaylist = useCallback(
    async (
      file: File,
      mode: M3uMatchMode,
    ): Promise<M3uImportOutcome | null> => {
      setIsImporting(true);
      try {
        const result = await runM3uImport(file, mode, depsFor(library, t));
        if (result.status === "imported") {
          toast.success(
            t("playlist.m3u.imported", { name: result.outcome.name }),
          );
          return result.outcome;
        }
        if (result.status === "failed") {
          if (result.reason === "empty") {
            toast.error(t("playlist.m3u.empty"));
          } else if (result.reason === "permission") {
            toast.error(
              t("folder.permissionDenied", {
                name: result.directoryName ?? "",
              }),
            );
          } else {
            toast.error(t("playlist.importFailed"), {
              description:
                result.reason === "error" ? result.message : undefined,
            });
          }
        }
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [library, t],
  );

  const remapUnresolved = useCallback(
    async (
      outcome: M3uImportOutcome,
      candidatePath: string,
    ): Promise<boolean> => {
      const ok = await remapM3uEntry(
        outcome,
        candidatePath,
        depsFor(library, t),
      );
      if (ok)
        toast.success(t("playlist.m3u.remapped", { name: candidatePath }));
      return ok;
    },
    [library, t],
  );

  return { importPlaylist, remapUnresolved, isImporting };
}
