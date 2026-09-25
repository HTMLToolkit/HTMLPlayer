import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import styles from "./Lyrics.module.css";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { cleanMetadata } from "../../../platform/lyrics";
import {
  LyricsManager,
  LyricsOvhProvider,
  LRCLyricsProvider,
  type Lyrics as ProviderLyrics,
} from "../../../platform/providers";
import { logger } from "../../../helpers/logger";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";

gsap.registerPlugin(useGSAP);

interface LyricsProps {
  artist: string;
  title: string;
  visible: boolean;
  onClose?: () => void;
  onCloseComplete?: () => void;
  embeddedLyrics?: EmbeddedLyrics[];
  currentTime?: number;
  isClosing?: boolean;
}

interface EmbeddedLyrics {
  synced: boolean;
  language?: string;
  description?: string;
  text?: string;
  lyrics?: string;
  content?: string;
  lines?: Array<{
    text: string;
    timestamp: number;
  }>;
}

interface OnlineLyricsState {
  lyrics: ProviderLyrics | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: OnlineLyricsState = {
  lyrics: null,
  loading: false,
  error: null,
};

const lyricsManager = new LyricsManager();
lyricsManager.addProvider(new LyricsOvhProvider());
const lrcParser = new LRCLyricsProvider();

const LRC_TIME_REGEX = /\[\d{2}:\d{2}(?:[.:]\d+)?\]/;

export const Lyrics = ({
  artist,
  title,
  visible,
  onClose,
  onCloseComplete,
  embeddedLyrics,
  currentTime = 0,
  isClosing: isClosingProp = false,
}: LyricsProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<OnlineLyricsState>(INITIAL_STATE);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [preferredSource, setPreferredSource] = useState<"online" | "embedded">(
    "online",
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const fetchLyrics = useCallback(
    async (artist: string, title: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      if (
        artist.trim().toLowerCase() === t("common.unknownArtist").toLowerCase()
      ) {
        setState((prev) => ({
          ...prev,
          error: t("lyrics.cannotSearchWithoutArtist"),
          loading: false,
        }));
        return;
      }

      const { artist: cleanedArtist, title: cleanedTitle } = cleanMetadata(
        artist,
        title,
      );

      const searchCombinations = [
        { artist: cleanedArtist, title: cleanedTitle },
        { artist, title },
        { artist: cleanedArtist, title },
        { artist, title: cleanedTitle },
      ];

      let lastError: Error | null = null;

      for (const {
        artist: searchArtist,
        title: searchTitle,
      } of searchCombinations) {
        try {
          const lyrics = await lyricsManager.fetchLyrics({
            artist: searchArtist,
            title: searchTitle,
          });

          if (lyrics && (lyrics.plain.length > 0 || lyrics.synced.length > 0)) {
            setState({
              lyrics,
              loading: false,
              error: null,
            });
            return;
          }

          lastError = new Error(t("lyrics.notFound"));
        } catch (error) {
          lastError =
            error instanceof Error
              ? error
              : new Error(t("lyrics.failedToLoad"));
        }
      }

      setState({
        lyrics: null,
        loading: false,
        error: lastError?.message || t("lyrics.failedToLoad"),
      });
    },
    [t],
  );

  const showEmbeddedLyrics = !!embeddedLyrics?.length;

  useEffect(() => {
    if (!visible) return;
    if (artist && title) {
      fetchLyrics(artist, title);
    }
  }, [visible, artist, title, fetchLyrics]);

  const normalizeEntry = useCallback((entry?: EmbeddedLyrics) => {
    if (!entry) return null;
    const normalized: EmbeddedLyrics = {
      synced: !!entry.synced,
      language: entry.language,
      description: entry.description,
      text: entry.text ?? entry.lyrics ?? entry.content ?? undefined,
      lines: undefined,
    };

    if (entry.lines?.length) {
      const mapped = entry.lines.map((l) => ({
        text: l.text ?? "",
        timestamp:
          typeof l.timestamp === "number"
            ? l.timestamp
            : Number(l.timestamp) || 0,
      }));
      const maxTs = Math.max(...mapped.map((m) => m.timestamp), 0);
      const needsMultiply = maxTs > 0 && maxTs < 10000;
      normalized.lines = mapped.map((m) => ({
        text: m.text,
        timestamp: needsMultiply ? m.timestamp * 1000 : m.timestamp,
      }));
      normalized.lines.sort((a, b) => a.timestamp - b.timestamp);
    } else if (normalized.text && LRC_TIME_REGEX.test(normalized.text)) {
      const parsed = lrcParser.parseLRC(normalized.text);
      if (parsed.synced.length > 0) {
        normalized.synced = true;
        normalized.lines = parsed.synced.map((line) => ({
          text: line.text,
          timestamp: line.time * 1000,
        }));
      }
    }

    return normalized;
  }, []);

  const normalizedEmbedded = useMemo(() => {
    if (!embeddedLyrics?.length) return [];
    return embeddedLyrics
      .map((e) => normalizeEntry(e) as EmbeddedLyrics)
      .sort((a, b) => (b.synced ? 1 : 0) - (a.synced ? 1 : 0));
  }, [embeddedLyrics, normalizeEntry]);

  useEffect(() => {
    if (!visible || !showEmbeddedLyrics) {
      setSelectedIndex(-1);
      setCurrentLineIndex(-1);
      return;
    }

    setSelectedIndex((prevIndex) => {
      if (normalizedEmbedded.length === 0) return -1;
      if (prevIndex >= 0 && prevIndex < normalizedEmbedded.length)
        return prevIndex;
      return 0;
    });
    setCurrentLineIndex(-1);
    logger.debug("[Lyrics] embedded lyrics arrived", {
      length: normalizedEmbedded.length,
      normalizedEmbedded,
    });
  }, [normalizedEmbedded, showEmbeddedLyrics, visible]);

  const selectedLyrics = useMemo(() => {
    if (!normalizedEmbedded?.length) return null;
    if (selectedIndex < 0 || selectedIndex >= normalizedEmbedded.length)
      return null;
    return normalizedEmbedded[selectedIndex] ?? null;
  }, [normalizedEmbedded, selectedIndex]);

  const onlineLyrics = preferredSource === "online" ? state.lyrics : null;
  const onlineSyncedLines = useMemo(() => {
    const synced = onlineLyrics?.synced;
    if (!synced || synced.length === 0) return null;
    return synced.map((line) => ({
      text: line.text,
      timestamp: line.time * 1000,
    }));
  }, [onlineLyrics]);

  const embeddedSyncedLines = useMemo(() => {
    if (preferredSource !== "embedded" || !selectedLyrics?.synced) return null;
    return selectedLyrics.lines && selectedLyrics.lines.length > 0
      ? selectedLyrics.lines
      : null;
  }, [selectedLyrics, preferredSource]);

  const activeSyncedLines = embeddedSyncedLines ?? onlineSyncedLines;

  useEffect(() => {
    if (!visible) return;
    if (!activeSyncedLines) {
      if (currentLineIndex !== -1) setCurrentLineIndex(-1);
      return;
    }

    const currentTimeMs = currentTime * 1000;
    const index = activeSyncedLines.findIndex((line, lineIndex) => {
      const nextLine = activeSyncedLines[lineIndex + 1];
      return (
        line.timestamp <= currentTimeMs &&
        (!nextLine || nextLine.timestamp > currentTimeMs)
      );
    });

    if (index !== currentLineIndex) setCurrentLineIndex(index);
  }, [currentLineIndex, currentTime, activeSyncedLines, visible]);

  useEffect(() => {
    if (!visible) return;
    if (currentLineIndex < 0) return;
    const parent = lyricsRef.current;
    if (!parent) return;
    const lineElement = parent.children.item(
      currentLineIndex,
    ) as HTMLElement | null;
    lineElement?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
  }, [currentLineIndex, visible]);

  useGSAP(
    () => {
      const parent = lyricsRef.current;
      if (!parent || !visible || currentLineIndex < 0) return;
      const lineElement = parent.children.item(
        currentLineIndex,
      ) as HTMLElement | null;
      if (!lineElement || prefersReducedMotion()) return;
      gsap.fromTo(
        lineElement,
        { y: 3, opacity: 0.85 },
        { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
      );
    },
    { dependencies: [currentLineIndex, visible], scope: lyricsRef },
  );

  useGSAP(
    () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      if (isClosingProp) {
        if (prefersReducedMotion()) {
          onCloseComplete?.();
          return;
        }
        gsap.to(overlay, {
          yPercent: 100,
          opacity: 0,
          duration: 0.25,
          ease: "power3.in",
          onComplete: () => onCloseComplete?.(),
        });
      } else if (visible && !prefersReducedMotion()) {
        gsap.fromTo(
          overlay,
          { yPercent: 100, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.25, ease: "power3.out" },
        );
      }
    },
    { dependencies: [isClosingProp, visible], scope: overlayRef },
  );

  const handleRetry = useCallback(() => {
    if (artist && title) fetchLyrics(artist, title);
  }, [artist, title, fetchLyrics]);
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose],
  );

  useEffect(() => {
    logger.debug("[Lyrics] selectedLyrics changed", {
      selectedIndex,
      selectedLyrics,
      currentLineIndex,
    });
  }, [selectedIndex, selectedLyrics, currentLineIndex]);

  const handleEmbeddedSelectChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    if (!normalizedEmbedded?.length) return;
    const index = parseInt(event.target.value, 10);
    if (!Number.isFinite(index)) return;
    setSelectedIndex(index);
    setCurrentLineIndex(-1);
  };

  const formatTimestamp = (timestamp: number) => {
    const minutes = Math.floor(timestamp / 60000);
    const seconds = Math.floor((timestamp % 60000) / 1000);
    const centiseconds = Math.floor((timestamp % 1000) / 10);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  };

  const { lyrics: onlineLyricsResult, loading, error } = state;
  const shownIndexForSelect = selectedIndex >= 0 ? selectedIndex : 0;

  return (
    <div
      ref={overlayRef}
      className={styles.lyricsOverlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      data-tour="lyrics"
    >
      <div className={styles.lyricsContainer}>
        <header className={styles.lyricsHeader}>
          <div className={styles.lyricsHeaderTitle}>
            <h3 className={styles.lyricsTitle}>
              {title} - {artist}
            </h3>
            {showEmbeddedLyrics && preferredSource === "embedded" && (
              <p className={styles.lyricsSubtitle}>
                {t("lyrics.embeddedLyrics")}
              </p>
            )}
          </div>
          <div className={styles.lyricsHeaderControls}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setPreferredSource("online")}
              title={t("lyrics.fetchOnline")}
              className={
                preferredSource === "online" ? styles.activeButton : ""
              }
            >
              <Icon name="download" size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={!showEmbeddedLyrics}
              onClick={() => setPreferredSource("embedded")}
              title={t("lyrics.useEmbedded")}
              className={
                preferredSource === "embedded" && showEmbeddedLyrics
                  ? styles.activeButton
                  : ""
              }
            >
              <Icon name="disc" size={18} />
            </Button>
            {onClose && (
              <button
                className={styles.lyricsCloseButton}
                onClick={handleClose}
              >
                ×
              </button>
            )}
          </div>
        </header>

        {showEmbeddedLyrics && preferredSource === "embedded" ? (
          <div className={styles.embeddedContent}>
            {normalizedEmbedded && normalizedEmbedded.length > 1 && (
              <div className={styles.lyricsSelector}>
                <select
                  value={shownIndexForSelect}
                  onChange={handleEmbeddedSelectChange}
                  className={styles.selector}
                >
                  {normalizedEmbedded.map((lyricsOption, index) => (
                    <option
                      key={`${lyricsOption?.synced ? "synced" : "unsynced"}-${index}`}
                      value={index}
                    >
                      {lyricsOption?.synced
                        ? t("lyrics.synchronized")
                        : t("lyrics.unsynchronized")}
                      {lyricsOption?.language && ` (${lyricsOption.language})`}
                      {lyricsOption?.description &&
                        ` - ${lyricsOption.description}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.embeddedBody}>
              {selectedLyrics ? (
                selectedLyrics.synced && selectedLyrics.lines?.length ? (
                  <div ref={lyricsRef} className={styles.syncedLyrics}>
                    {selectedLyrics.lines.map((line, index) => (
                      <div
                        key={`${line.timestamp}-${index}`}
                        className={`${styles.lyricsLine}${index === currentLineIndex ? ` ${styles.currentLine}` : ""}`}
                      >
                        <span className={styles.timestamp}>
                          {formatTimestamp(line.timestamp)}
                        </span>
                        <span className={styles.lineText}>
                          {line.text || "\u00a0"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : selectedLyrics.text ? (
                  <pre className={styles.unsyncedLyrics}>
                    {selectedLyrics.text}
                  </pre>
                ) : (
                  <div className={styles.noLyrics}>
                    {t("lyrics.noEmbeddedLyrics")}
                  </div>
                )
              ) : (
                <div className={styles.noLyrics}>
                  {t("lyrics.noEmbeddedLyrics")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.lyricsContent}>
            {loading && (
              <div className={styles.loading}>{t("lyrics.loading")}</div>
            )}
            {error && (
              <div className={styles.error}>
                <p>{error}</p>
                <button onClick={handleRetry} className={styles.retryButton}>
                  {t("lyrics.tryAgain")}
                </button>
              </div>
            )}
            {!loading &&
              !error &&
              onlineLyricsResult &&
              (onlineLyricsResult.synced.length > 0 ? (
                <div ref={lyricsRef} className={styles.syncedLyrics}>
                  {onlineLyricsResult.synced.map((line, index) => (
                    <div
                      key={`online-${line.time}-${index}`}
                      className={`${styles.lyricsLine}${index === currentLineIndex ? ` ${styles.currentLine}` : ""}`}
                    >
                      <span className={styles.timestamp}>
                        {formatTimestamp(line.time * 1000)}
                      </span>
                      <span className={styles.lineText}>
                        {line.text || "\u00a0"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className={styles.lyricsText}>
                  {onlineLyricsResult.plain.join("\n")}
                </pre>
              ))}
            {!loading && !error && !onlineLyricsResult && (
              <div className={styles.error}>
                {t("lyrics.noLyricsAvailable")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
