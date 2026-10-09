import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../primitives/Dialog";
import type {
  M3uMatchMode,
  M3uUnresolvedEntry,
} from "../../../platform/storage/m3uImport";
import type { M3uImportOutcome } from "../../../hooks/useM3uImport";
import styles from "./M3uImportDialog.module.css";

const MATCH_MODES: M3uMatchMode[] = ["auto", "path", "filename"];

export interface M3uImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: File | null;
  isImporting: boolean;
  outcome: M3uImportOutcome | null;
  onImport: (mode: M3uMatchMode) => void;
  onRemap: (candidatePath: string) => Promise<boolean>;
  onDrop: () => void;
}

export function M3uImportDialog({
  open,
  onOpenChange,
  file,
  isImporting,
  outcome,
  onImport,
  onRemap,
  onDrop,
}: M3uImportDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<M3uMatchMode>("auto");
  const [remaining, setRemaining] = useState<M3uUnresolvedEntry[]>([]);

  useEffect(() => {
    setRemaining(outcome?.unresolved ?? []);
  }, [outcome]);

  const dismiss = useCallback((item: M3uUnresolvedEntry) => {
    setRemaining((current) => current.filter((entry) => entry !== item));
  }, []);

  const handleRemap = useCallback(
    async (item: M3uUnresolvedEntry, candidatePath: string) => {
      if (await onRemap(candidatePath)) dismiss(item);
    },
    [dismiss, onRemap],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {outcome ? t("playlist.m3u.reportTitle") : t("playlist.m3u.title")}
          </DialogTitle>
          <DialogDescription>
            {outcome
              ? t("playlist.m3u.reportSummary", {
                  added: outcome.added,
                  reused: outcome.reused,
                  remote: outcome.remote,
                })
              : t("playlist.m3u.description", { name: file?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {outcome ? (
          remaining.length === 0 ? (
            <p className={styles.reportEmpty}>
              {t("playlist.m3u.allResolved")}
            </p>
          ) : (
            <ul className={styles.reportList}>
              {remaining.map((item) => (
                <li
                  key={`${item.entry.raw}-${item.entry.path}`}
                  className={styles.reportRow}
                >
                  <span className={styles.reportName}>
                    {item.entry.title ?? item.entry.path}
                  </span>
                  <span className={styles.reportPath}>{item.entry.raw}</span>
                  <span className={styles.reportReason}>
                    {item.reason === "ambiguous"
                      ? t("playlist.m3u.ambiguous", {
                          count: item.candidates.length,
                        })
                      : t("playlist.m3u.missing")}
                  </span>
                  <div className={styles.reportActions}>
                    {item.candidates.map((candidate) => (
                      <Button
                        key={candidate}
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRemap(item, candidate)}
                      >
                        {t("playlist.m3u.use", { name: candidate })}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismiss(item)}
                    >
                      {t("playlist.m3u.drop")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          <fieldset className={styles.modeList}>
            <legend className={styles.modeDescription}>
              {t("playlist.m3u.matchMode")}
            </legend>
            {MATCH_MODES.map((value) => (
              <label key={value} className={styles.modeOption}>
                <span className={styles.modeHeader}>
                  <input
                    type="radio"
                    name="m3u-match-mode"
                    value={value}
                    className={styles.modeInput}
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />
                  <span className={styles.modeTitle}>
                    {t(`playlist.m3u.mode.${value}`)}
                  </span>
                </span>
                <span className={styles.modeDescription}>
                  {t(`playlist.m3u.modeDesc.${value}`)}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <DialogFooter>
          {outcome ? (
            <>
              <Button variant="outline" onClick={onDrop}>
                {t("playlist.m3u.dropAll")}
              </Button>
              <Button variant="primary" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="primary"
                disabled={!file || isImporting}
                onClick={() => onImport(mode)}
              >
                {isImporting
                  ? t("playlist.m3u.importing")
                  : t("playlist.m3u.start")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
