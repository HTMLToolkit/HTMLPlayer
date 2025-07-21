import React, { useEffect, useState, useCallback, useRef } from "react";
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

type LyricsState = {
  lyrics: string;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: LyricsState = {
  lyrics: "",
  loading: false,
  error: null,
};

// Artist name cleaning patterns
const ARTIST_CLEANUP_PATTERNS = [
  // Remove common suffixes
  / - Topic$/i,
  / Topic$/i,
  / - Official$/i,
  / Official$/i,
  / - VEVO$/i,
  / VEVO$/i,
  / - Records$/i,
  / Records$/i,
  / - Music$/i,
  / Music$/i,
  / - Channel$/i,
  / Channel$/i,
  / - Artist$/i,
  / Artist$/i,
  / - Band$/i,
  / Band$/i,
  / - Entertainment$/i,
  / Entertainment$/i,
  / - Label$/i,
  / Label$/i,
  / - Recordings$/i,
  / Recordings$/i,
  / - Videos$/i,
  / Videos$/i,
  / - TV$/i,
  / TV$/i,
  / - HD$/i,
  / HD$/i,
  / - 4K$/i,
  / 4K$/i,
  / - YouTube$/i,
  / YouTube$/i,
  / - Spotify$/i,
  / Spotify$/i,
  / - Apple Music$/i,
  / Apple Music$/i,
  / - Tidal$/i,
  / Tidal$/i,
  / - Streaming$/i,
  / Streaming$/i,
  / - Exclusive$/i,
  / Exclusive$/i,
  / - Live$/i,
  / Live$/i,
  / - Studio$/i,
  / Studio$/i,
  / - Remastered$/i,
  / Remastered$/i,
  / - Remix$/i,
  / Remix$/i,
  / - Cover$/i,
  / Cover$/i,
  / - Acoustic$/i,
  / Acoustic$/i,
  / - Instrumental$/i,
  / Instrumental$/i,
  / - Karaoke$/i,
  / Karaoke$/i,
  / - Lyric Video$/i,
  / Lyric Video$/i,
  / - Lyrics$/i,
  / Lyrics$/i,
  / - Lyric$/i,
  / Lyric$/i,
  / - Audio$/i,
  / Audio$/i,
  / - Video$/i,
  / Video$/i,
  / - Visualizer$/i,
  / Visualizer$/i,
  / - Explicit$/i,
  / Explicit$/i,
  / - Clean$/i,
  / Clean$/i,
  / - Radio Edit$/i,
  / Radio Edit$/i,
  / - Extended$/i,
  / Extended$/i,
  / - Full Version$/i,
  / Full Version$/i,
  / - Complete$/i,
  / Complete$/i,
  / - HQ$/i,
  / HQ$/i,
  / - High Quality$/i,
  / High Quality$/i,
  / - MP3$/i,
  / MP3$/i,
  / - WAV$/i,
  / WAV$/i,
  / - FLAC$/i,
  / FLAC$/i,
];

// Title cleaning patterns
const TITLE_CLEANUP_PATTERNS = [
  // Remove common suffixes and prefixes
  / - Official Video$/i,
  / Official Video$/i,
  / - Official Music Video$/i,
  / Official Music Video$/i,
  / - Music Video$/i,
  / Music Video$/i,
  / - Official Audio$/i,
  / Official Audio$/i,
  / - Audio$/i,
  / Audio$/i,
  / - Lyric Video$/i,
  / Lyric Video$/i,
  / - Lyrics Video$/i,
  / Lyrics Video$/i,
  / - Video$/i,
  / Video$/i,
  / - HD$/i,
  / HD$/i,
  / - 4K$/i,
  / 4K$/i,
  / - HQ$/i,
  / HQ$/i,
  / - High Quality$/i,
  / High Quality$/i,
  / - Explicit$/i,
  / Explicit$/i,
  / - Clean$/i,
  / Clean$/i,
  / - Radio Edit$/i,
  / Radio Edit$/i,
  / - Extended Version$/i,
  / Extended Version$/i,
  / - Extended$/i,
  / Extended$/i,
  / - Full Version$/i,
  / Full Version$/i,
  / - Complete$/i,
  / Complete$/i,
  / - Remastered$/i,
  / Remastered$/i,
  / - Remix$/i,
  / Remix$/i,
  / - Cover$/i,
  / Cover$/i,
  / - Acoustic$/i,
  / Acoustic$/i,
  / - Instrumental$/i,
  / Instrumental$/i,
  / - Karaoke$/i,
  / Karaoke$/i,
  / - Live$/i,
  / Live$/i,
  / - Studio$/i,
  / Studio$/i,
  / - Visualizer$/i,
  / Visualizer$/i,
  / - Lyric$/i,
  / Lyric$/i,
  / - Lyrics$/i,
  / Lyrics$/i,
  / - MP3$/i,
  / MP3$/i,
  / - WAV$/i,
  / WAV$/i,
  / - FLAC$/i,
  / FLAC$/i,
  / - YouTube$/i,
  / YouTube$/i,
  / - Spotify$/i,
  / Spotify$/i,
  / - Apple Music$/i,
  / Apple Music$/i,
  / - Tidal$/i,
  / Tidal$/i,
  / - Streaming$/i,
  / Streaming$/i,
  / - Exclusive$/i,
  / Exclusive$/i,
  
  // Remove parenthetical content that's likely not part of the song title
  / \(Official Video\)$/i,
  / \(Official Music Video\)$/i,
  / \(Music Video\)$/i,
  / \(Official Audio\)$/i,
  / \(Audio\)$/i,
  / \(Lyric Video\)$/i,
  / \(Lyrics Video\)$/i,
  / \(Video\)$/i,
  / \(HD\)$/i,
  / \(4K\)$/i,
  / \(HQ\)$/i,
  / \(High Quality\)$/i,
  / \(Explicit\)$/i,
  / \(Clean\)$/i,
  / \(Radio Edit\)$/i,
  / \(Extended Version\)$/i,
  / \(Extended\)$/i,
  / \(Full Version\)$/i,
  / \(Complete\)$/i,
  / \(Remastered\)$/i,
  / \(Remix\)$/i,
  / \(Cover\)$/i,
  / \(Acoustic\)$/i,
  / \(Instrumental\)$/i,
  / \(Karaoke\)$/i,
  / \(Live\)$/i,
  / \(Studio\)$/i,
  / \(Visualizer\)$/i,
  / \(Lyric\)$/i,
  / \(Lyrics\)$/i,
  / \(MP3\)$/i,
  / \(WAV\)$/i,
  / \(FLAC\)$/i,
  / \(YouTube\)$/i,
  / \(Spotify\)$/i,
  / \(Apple Music\)$/i,
  / \(Tidal\)$/i,
  / \(Streaming\)$/i,
  / \(Exclusive\)$/i,
];

const cleanArtistName = (artist: string): string => {
  let cleaned = artist.trim();
  
  // Apply all artist cleanup patterns
  for (const pattern of ARTIST_CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove extra whitespace and normalize
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  
  return cleaned;
};

const cleanTitle = (title: string, artist?: string): string => {
  let cleaned = title.trim();
  
  // If artist is provided and not "Unknown Artist", remove it from the beginning of the title
  if (artist && artist.trim().toLowerCase() !== 'unknown artist') {
    const artistClean = artist.trim();
    
    // Remove "Artist - Title" pattern
    const dashPattern = new RegExp(`^${escapeRegExp(artistClean)}\\s*-\\s*`, 'i');
    cleaned = cleaned.replace(dashPattern, '');
    
    // Remove "Artist: Title" pattern
    const colonPattern = new RegExp(`^${escapeRegExp(artistClean)}\\s*:\\s*`, 'i');
    cleaned = cleaned.replace(colonPattern, '');
    
    // Remove "Artist | Title" pattern
    const pipePattern = new RegExp(`^${escapeRegExp(artistClean)}\\s*\\|\\s*`, 'i');
    cleaned = cleaned.replace(pipePattern, '');
  }
  
  // Apply all title cleanup patterns
  for (const pattern of TITLE_CLEANUP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove extra whitespace and normalize
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  
  return cleaned;
};


// Helper function to escape special regex characters
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '');
};

export const Lyrics = ({ artist, title, visible, onClose }: LyricsProps) => {
  const [state, setState] = useState<LyricsState>(INITIAL_STATE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLyrics = useCallback(async (artist: string, title: string) => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState(prev => ({ ...prev, loading: true, error: null }));

    // Skip API call if artist is "Unknown Artist" - lyrics.ovh won't have results
    if (artist.trim().toLowerCase() === 'unknown artist') {
      setState(prev => ({ 
        ...prev, 
        error: "Cannot search for lyrics without a known artist", 
        loading: false 
      }));
      return;
    }

    // Clean up artist and title names
    const cleanedArtist = cleanArtistName(artist);
    const cleanedTitle = cleanTitle(title, cleanedArtist);

    // Try different combinations if cleaning changed the values
    const searchCombinations = [
      { artist: cleanedArtist, title: cleanedTitle },
      // Fallback to original if cleaning changed them
      ...(cleanedArtist !== artist || cleanedTitle !== title ? [{ artist, title }] : []),
      // Additional fallbacks with partial cleaning
      ...(cleanedArtist !== artist ? [{ artist: cleanedArtist, title }] : []),
      ...(cleanedTitle !== title ? [{ artist, title: cleanedTitle }] : []),
      // Try with original artist but title cleaned with original artist name
      ...(cleanTitle(title, artist) !== title ? [{ artist, title: cleanTitle(title, artist) }] : []),
    ];

    let lastError: Error | null = null;

    for (const { artist: searchArtist, title: searchTitle } of searchCombinations) {
      try {
        const response = await fetch(
          `https://api.lyrics.ovh/v1/${encodeURIComponent(searchArtist)}/${encodeURIComponent(searchTitle)}`,
          { signal: controller.signal }
        );

        if (response.ok) {
          const data: LyricsResponse = await response.json();
          
          if (data.lyrics && data.lyrics.trim() !== "") {
            setState(prev => ({ 
              ...prev, 
              lyrics: data.lyrics.trim(), 
              loading: false 
            }));
            return; // Success - exit the loop
          }
        }
        
        // Store the error for potential use later
        lastError = new Error(
          response.status === 404 
            ? "Lyrics not found for this song" 
            : `Failed to fetch lyrics (${response.status})`
        );
        
      } catch (error) {
        // Don't update state if request was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        
        lastError = error instanceof Error ? error : new Error("Failed to load lyrics");
      }
    }

    // If we get here, all combinations failed
    setState(prev => ({ 
      ...prev, 
      error: lastError?.message || "Failed to load lyrics", 
      loading: false 
    }));
  }, []);

  useEffect(() => {
    if (!visible || !artist || !title) {
      setState(INITIAL_STATE);
      return;
    }

    fetchLyrics(artist, title);

    // Cleanup function to abort request on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [artist, title, visible, fetchLyrics]);

  // Handle escape key to close
  useEffect(() => {
    if (!visible || !onClose) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [visible, onClose]);

  const handleRetry = useCallback(() => {
    if (artist && title) {
      fetchLyrics(artist, title);
    }
  }, [artist, title, fetchLyrics]);

  const handleOverlayClick = useCallback((event: React.MouseEvent) => {
    // Close on backdrop click
    if (event.target === event.currentTarget && onClose) {
      onClose();
    }
  }, [onClose]);

  if (!visible) return null;

  const { lyrics, loading, error } = state;

  return (
    <div
      className={styles.lyricsOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lyrics-title"
      aria-describedby="lyrics-content"
      onClick={handleOverlayClick}
    >
      <div className={styles.lyricsContainer}>
        <header className={styles.lyricsHeader}>
          <h3 id="lyrics-title" className={styles.lyricsTitle}>
            {title} - {artist}
          </h3>
          {onClose && (
            <button
              className={styles.lyricsCloseButton}
              onClick={onClose}
              aria-label="Close lyrics dialog"
              title="Close lyrics (Esc)"
            >
              ×
            </button>
          )}
        </header>

        <div 
          id="lyrics-content" 
          className={styles.lyricsContent}
          role="main"
        >
          {loading && (
            <div className={styles.loading} role="status" aria-live="polite">
              <span>Loading lyrics...</span>
            </div>
          )}
          
          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
              <button 
                onClick={handleRetry}
                className={styles.retryButton}
                aria-label="Retry loading lyrics"
              >
                Try Again
              </button>
            </div>
          )}
          
          {!loading && !error && lyrics && (
            <div className={styles.lyricsText}>
              <pre aria-label="Song lyrics">{lyrics}</pre>
            </div>
          )}
          
          {!loading && !error && !lyrics && (
            <div className={styles.error} role="alert">
              No lyrics available for this song.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};