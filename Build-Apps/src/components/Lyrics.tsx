import React, { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Lyrics.module.css";
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
}

interface LyricsResponse { lyrics: string }
interface LyricsState { lyrics: string; loading: boolean; error: string | null }

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
      })
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

export const Lyrics = ({ artist, title, visible, onClose }: LyricsProps) => {
  const { t } = useTranslation();
  const [state, setState] = useState<LyricsState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLyrics = useCallback(async (artist: string, title: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    if (artist.trim().toLowerCase() === "unknown artist") {
      setState((prev) => ({
        ...prev,
        error: t("lyrics.cannotSearchWithoutArtist"),
        loading: false,
      }));
      return;
    }

    const { artist: cleanedArtist, title: cleanedTitle } = cleanMetadata(
      artist,
      title
    );

    const searchCombinations = [
      { artist: cleanedArtist, title: cleanedTitle },
      { artist, title },
      { artist: cleanedArtist, title },
      { artist, title: cleanedTitle },
    ];

    let lastError: Error | null = null;

    for (const { artist: searchArtist, title: searchTitle } of searchCombinations) {
      try {
        const response = await fetch(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(
            searchArtist
          )}/${encodeURIComponent(searchTitle)}`,
          { signal: controller.signal }
        );

        if (response.ok) {
          const data: LyricsResponse = await response.json();
          if (data.lyrics?.trim()) {
            setState({ lyrics: data.lyrics.trim(), loading: false, error: null });
            return;
          }
        }

        lastError = new Error(
          response.status === 404
            ? t("lyrics.notFound")
            : t("lyrics.failedToFetch", { status: response.status })
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        lastError = error instanceof Error ? error : new Error(t("lyrics.failedToLoad"));
      }
    }

    setState({ lyrics: "", loading: false, error: lastError?.message || t("lyrics.failedToLoad") });
  }, []);

  useEffect(() => {
    if (!visible || !artist || !title) return setState(INITIAL_STATE);
    fetchLyrics(artist, title);
    return () => abortControllerRef.current?.abort();
  }, [artist, title, visible, fetchLyrics]);

  useEffect(() => {
    if (!visible || !onClose) return;
    const handleEscapeKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [visible, onClose]);

  const handleRetry = useCallback(() => { if (artist && title) fetchLyrics(artist, title); }, [artist, title, fetchLyrics]);
  const handleOverlayClick = useCallback((e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose?.(); }, [onClose]);

  if (!visible) return null;

  const { lyrics, loading, error } = state;

  return (
    <div className={styles.lyricsOverlay} onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className={styles.lyricsContainer}>
        <header className={styles.lyricsHeader}>
          <h3 className={styles.lyricsTitle}>{title} - {artist}</h3>
          {onClose && <button className={styles.lyricsCloseButton} onClick={onClose}>×</button>}
        </header>

        <div className={styles.lyricsContent}>
          {loading && <div className={styles.loading}>{t("lyrics.loading")}</div>}
          {error && (
            <div className={styles.error}>
              <p>{error}</p>
              <button onClick={handleRetry} className={styles.retryButton}>{t("lyrics.tryAgain")}</button>
            </div>
          )}
          {!loading && !error && lyrics && <pre className={styles.lyricsText}>{lyrics}</pre>}
          {!loading && !error && !lyrics && <div className={styles.error}>{t("lyrics.noLyricsAvailable")}</div>}
        </div>
      </div>
    </div>
  );
};
