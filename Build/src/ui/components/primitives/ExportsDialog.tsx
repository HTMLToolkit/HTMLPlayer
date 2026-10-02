import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "./Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";
import { exportStorage, type SavedExport } from "../../../platform/storage";
import { createLogger } from "../../../helpers/logger";
import styles from "./ExportsDialog.module.css";

const logger = createLogger("exportsDialog");

const M3U_MIME = "audio/x-mpegurl";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ExportsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportsDialog({ open, onOpenChange }: ExportsDialogProps) {
  const { t, i18n } = useTranslation();
  const [exports, setExports] = useState<SavedExport[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setExports(await exportStorage.list());
    } catch (error) {
      logger.warn("Failed to list saved exports", { error: String(error) });
      toast.error(t("exports.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleDownload = useCallback(
    async (entry: SavedExport) => {
      try {
        const contents = await exportStorage.read(entry.name);
        if (contents === null) {
          toast.error(t("exports.notFound", { name: entry.name }));
          await refresh();
          return;
        }
        const url = URL.createObjectURL(
          new Blob([contents], { type: M3U_MIME }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = entry.name;
        anchor.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        logger.warn("Failed to read saved export", {
          name: entry.name,
          error: String(error),
        });
        toast.error(t("exports.loadFailed"));
      }
    },
    [refresh, t],
  );

  const handleDelete = useCallback(
    async (entry: SavedExport) => {
      try {
        await exportStorage.remove(entry.name);
        setExports((current) =>
          current.filter((item) => item.name !== entry.name),
        );
        toast.success(t("exports.deleted", { name: entry.name }));
      } catch (error) {
        logger.warn("Failed to delete saved export", {
          name: entry.name,
          error: String(error),
        });
        toast.error(t("exports.failed"));
      }
    },
    [t],
  );

  const handleClear = useCallback(async () => {
    try {
      await exportStorage.clear();
      setExports([]);
      toast.success(t("exports.cleared"));
    } catch (error) {
      logger.warn("Failed to clear saved exports", { error: String(error) });
      toast.error(t("exports.failed"));
    }
  }, [t]);

  const formatDate = useCallback(
    (timestamp: number) => {
      if (timestamp === 0) return "";
      return new Date(timestamp).toLocaleString(i18n.language);
    },
    [i18n.language],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("exports.title")}</DialogTitle>
          <DialogDescription>{t("exports.description")}</DialogDescription>
        </DialogHeader>

        {isLoading && exports.length === 0 ? (
          <p className={styles.empty}>{t("common.loading")}</p>
        ) : exports.length === 0 ? (
          <p className={styles.empty}>{t("exports.empty")}</p>
        ) : (
          <ul className={styles.list}>
            {exports.map((entry) => (
              <li key={entry.name} className={styles.row}>
                <span className={styles.name}>{entry.name}</span>
                <span className={styles.meta}>
                  {formatSize(entry.size)}
                  {entry.lastModified > 0 &&
                    ` · ${formatDate(entry.lastModified)}`}
                </span>
                <div className={styles.actions}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDownload(entry)}
                  >
                    {t("exports.download")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(entry)}
                  >
                    {t("exports.delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {exports.length > 0 && (
            <Button variant="destructive" onClick={() => void handleClear()}>
              {t("exports.clearAll")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
