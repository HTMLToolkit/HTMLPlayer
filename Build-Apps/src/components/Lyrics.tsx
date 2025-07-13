import React, { useEffect, useState } from "react";
import styles from "./Lyrics.module.css";

type LyricsProps = {
  artist: string;
  title: string;
  visible: boolean;
  onClose?: () => void;
};

type LyricsResponse = {
  lyrics: string;
};

export const Lyrics = ({ artist, title, visible, onClose }: LyricsProps) => {
  const [lyrics, setLyrics] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setLyrics("");
    setLoading(true);
    setError(null);

    fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Lyrics not found");
        }
        const data: LyricsResponse = await res.json();
        setLyrics(data.lyrics);
      })
      .catch(() => {
        setError("Lyrics not found.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [artist, title, visible]);

  if (!visible) return null;

  return (
    <div
      className={styles.lyricsOverlay}
      role="region"
      aria-live="polite"
      aria-label={`Lyrics for ${title} by ${artist}`}
    >
      <div className={styles.lyricsHeader}>
        <span>Lyrics</span>
        {onClose && (
          <button
            className={styles.lyricsCloseButton}
            onClick={onClose}
            aria-label="Close lyrics"
            title="Close lyrics"
          >
            ×
          </button>
        )}
      </div>
      <div className={styles.lyricsContent}>
        {loading && <div className={styles.loading}>Loading lyrics...</div>}
        {error && <div className={styles.error}>{error}</div>}
        {!loading && !error && lyrics && <pre>{lyrics}</pre>}
        {!loading && !error && !lyrics && (
          <div className={styles.error}>No lyrics available.</div>
        )}
      </div>
    </div>
  );
};
