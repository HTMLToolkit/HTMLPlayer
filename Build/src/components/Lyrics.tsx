import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import styles from "./Lyrics.module.css";
import { Button } from "./Button";
import { Icon } from "./Icon";
import {
  MetadataFilter,
  createYouTubeFilter,
  createSpotifyFilter,
  createAmazonFilter,
  createTidalFilter,
  createRemasteredFilter,
} from "@web-scrobbler/metadata-filter";

interface LyricsProps {
  artist: string;
  title: string;
  visible: boolean;
  onClose?: () => void;
  embeddedLyrics?: EmbeddedLyrics[];
  currentTime?: number;
}

interface EmbeddedLyrics {
  synced: boolean;
  language?: string;
  description?: string;
  text?: string; // for unsynchronized lyrics
  lyrics?: string; // sometimes stored as `lyrics`
  content?: string; // fallback name
  lines?: Array<{
    // for synchronized lyrics
    text: string;
    timestamp: number; // expected ms, but may be seconds in some storage — normalize below
  }>;
}

interface LyricsResponse {
  lyrics: string;
}
interface LyricsState {
  lyrics: string;
  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: LyricsState = { lyrics: "", loading: false, error: null };

// Custom filter to remove "- Topic" and "[...]" suffixes
const removeExtraSuffixes = (text: string) =>
  text
    .replace(/ - Topic$/i, "")
    .replace(/\s*\[.*?\]$/i, "") // removes any bracketed content at the end
    .trim();

// Factory filter to remove the artist name from the start of the title
const removeArtistFromTitle = (artistName: string) => (text: string) => {
  if (!artistName) return text;
  const escapedArtist = artistName.replace(/[.*+?^${}()|[\]\\]/g, "");
  const regex = new RegExp(`^${escapedArtist}\\s*[-:|]?\\s*`, "i");
  return text.replace(regex, "").trim();
};

// Function to create master filter for a specific artist
const createMasterFilter = (artistName: string) =>
  new MetadataFilter({})
    .extend(createYouTubeFilter())
    .extend(createSpotifyFilter())
    .extend(createAmazonFilter())
    .extend(createTidalFilter())
    .extend(createRemasteredFilter())
    .extend(
      new MetadataFilter({
        artist: removeExtraSuffixes,
        track: [removeExtraSuffixes, removeArtistFromTitle(artistName)],
      }),
    );

// Function to clean artist/title using master filter
const cleanMetadata = (artist: string, title: string) => {
  const masterFilter = createMasterFilter(artist);

  const cleanedArtist = masterFilter.canFilterField("artist")
    ? masterFilter.filterField("artist", artist)
    : artist;

  const cleanedTitle = masterFilter.canFilterField("track")
    ? masterFilter.filterField("track", title)
    : title;

  return { artist: cleanedArtist, title: cleanedTitle };
};

export const Lyrics = ({
  artist,
  title,
  visible,
  onClose,
  embeddedLyrics,
  currentTime = 0,
}: LyricsProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<LyricsState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Use selectedIndex to avoid object-reference equality problems when arrays are rehydrated
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  // Track which source the user prefers: "online" or "embedded"
  const [preferredSource, setPreferredSource] = useState<"online" | "embedded">(
    "online",
  );

  const fetchLyrics = useCallback(
    async (artist: string, title: string) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
          const response = await fetch(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(
              searchArtist,
            )}/${encodeURIComponent(searchTitle)}`,
            { signal: controller.signal },
          );

          if (response.ok) {
            const data: LyricsResponse = await response.json();
            if (data.lyrics?.trim()) {
              setState({
                lyrics: data.lyrics.trim(),
                loading: false,
                error: null,
              });
              return;
            }
          }

          lastError = new Error(
            response.status === 404
              ? t("lyrics.notFound")
              : t("lyrics.failedToFetch", { status: response.status }),
          );
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
          lastError =
            error instanceof Error
              ? error
              : new Error(t("lyrics.failedToLoad"));
        }
      }

      setState({
        lyrics: "",
        loading: false,
        error: lastError?.message || t("lyrics.failedToLoad"),
      });
    },
    [t],
  );

  const showEmbeddedLyrics = !!embeddedLyrics?.length;

  // Auto-fetch online lyrics when the panel becomes visible
  useEffect(() => {
    if (!visible) return;
    // Always try to fetch online lyrics when lyrics panel opens
    if (artist && title) {
      fetchLyrics(artist, title);
    }
  }, [visible, artist, title, fetchLyrics]);

  // Normalize helper: accept different shapes and ensure timestamps are ms
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
      // Map timestamps; determine if timestamps are seconds (small numbers) or ms
      const mapped = entry.lines.map((l) => ({
        text: l.text ?? "",
        timestamp:
          typeof l.timestamp === "number"
            ? l.timestamp
            : Number(l.timestamp) || 0,
      }));
      const maxTs = Math.max(...mapped.map((m) => m.timestamp), 0);
      // Heuristic: if max timestamp < 10000 treat values as seconds -> convert to ms
      const needsMultiply = maxTs > 0 && maxTs < 10000;
      normalized.lines = mapped.map((m) => ({
        text: m.text,
        timestamp: needsMultiply ? m.timestamp * 1000 : m.timestamp,
      }));
      // sort just in case
      normalized.lines.sort((a, b) => a.timestamp - b.timestamp);
    }

    // If no text field but lines exist, keep lines only. If no lines but text exists, keep text.
    return normalized;
  }, []);

  // Memoized normalized array for safer usage
  const normalizedEmbedded = useMemo(() => {
    if (!embeddedLyrics?.length) return [];
    return embeddedLyrics.map((e) => normalizeEntry(e) as EmbeddedLyrics);
  }, [embeddedLyrics, normalizeEntry]);

  // Manage selection index when embedded lyrics change or visibility changes
  useEffect(() => {
    if (!visible || !showEmbeddedLyrics) {
      setSelectedIndex(-1);
      setCurrentLineIndex(-1);
      return;
    }

    // Prefer to keep current index if still valid, otherwise pick 0
    setSelectedIndex((prevIndex) => {
      if (normalizedEmbedded.length === 0) return -1;
      if (prevIndex >= 0 && prevIndex < normalizedEmbedded.length)
        return prevIndex;
      return 0;
    });
    setCurrentLineIndex(-1);
    // Debug log arrival
    console.debug("[Lyrics] embedded lyrics arrived", {
      length: normalizedEmbedded.length,
      normalizedEmbedded,
    });
  }, [normalizedEmbedded, showEmbeddedLyrics, visible]);

  // Derive selectedLyrics from index and normalized array
  const selectedLyrics = useMemo(() => {
    if (!normalizedEmbedded?.length) return null;
    if (selectedIndex < 0 || selectedIndex >= normalizedEmbedded.length)
      return null;
    return normalizedEmbedded[selectedIndex] ?? null;
  }, [normalizedEmbedded, selectedIndex]);

  // Update current line index based on currentTime when using synced lyrics
  useEffect(() => {
    if (!visible) return;
    if (
      !selectedLyrics ||
      !selectedLyrics.synced ||
      !selectedLyrics.lines?.length
    ) {
      if (currentLineIndex !== -1) setCurrentLineIndex(-1);
      return;
    }

    const currentTimeMs = currentTime * 1000;
    const index = selectedLyrics.lines.findIndex((line, lineIndex) => {
      const nextLine = selectedLyrics.lines?.[lineIndex + 1];
      return (
        line.timestamp <= currentTimeMs &&
        (!nextLine || nextLine.timestamp > currentTimeMs)
      );
    });

    if (index !== currentLineIndex) setCurrentLineIndex(index);
  }, [currentLineIndex, currentTime, selectedLyrics, visible]);

  // Scroll into view for current line
  useEffect(() => {
    if (!visible) return;
    if (currentLineIndex < 0) return;
    const parent = lyricsRef.current;
    if (!parent) return;
    const lineElement = parent.children.item(
      currentLineIndex,
    ) as HTMLElement | null;
    lineElement?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentLineIndex, visible]);

  useEffect(() => {
    if (!visible || !onClose) return;
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [visible, onClose]);

  const handleRetry = useCallback(() => {
    if (artist && title) fetchLyrics(artist, title);
  }, [artist, title, fetchLyrics]);
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose],
  );

  if (!visible) return null;

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

  const { lyrics, loading, error } = state;
  const shownIndexForSelect = selectedIndex >= 0 ? selectedIndex : 0;

  // Debug selected item shape if needed
  useEffect(() => {
    console.debug("[Lyrics] selectedLyrics changed", {
      selectedIndex,
      selectedLyrics,
      currentLineIndex,
    });
  }, [selectedIndex, selectedLyrics, currentLineIndex]);

  return (
    <div
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
            {/* Online Lyrics Button */}
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
            {/* Embedded Lyrics Button */}
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
              <button className={styles.lyricsCloseButton} onClick={onClose}>
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
            {!loading && !error && lyrics && (
              <pre className={styles.lyricsText}>{lyrics}</pre>
            )}
            {!loading && !error && !lyrics && (
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
