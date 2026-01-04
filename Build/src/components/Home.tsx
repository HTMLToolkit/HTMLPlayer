import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Home.module.css";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { useAlbumArt } from "../hooks/useAlbumArt";

interface HomeProps {
  musicPlayerHook: ReturnType<
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
  onAddMusic: () => Promise<void>;
}

const isPlaylist = (item: Playlist | PlaylistFolder): item is Playlist => {
  return (item as Playlist).songs !== undefined;
};

const flattenPlaylists = (items: (Playlist | PlaylistFolder)[]): Playlist[] => {
  const result: Playlist[] = [];
  for (const item of items) {
    if (isPlaylist(item)) {
      result.push(item);
    } else if (item.children?.length) {
      result.push(...flattenPlaylists(item.children));
    }
  }
  return result;
};
// Song card component with lazy album art loading
const SongCardItem: React.FC<{ song: Song; onPlay: (song: Song) => void }> =
  React.memo(({ song, onPlay }) => {
    const lazyAlbumArt = useAlbumArt(
      song.id,
      song.hasAlbumArt || !!song.albumArt,
    );
    const albumArt = song.albumArt || lazyAlbumArt;

    return (
      <button className={styles.songCard} onClick={() => onPlay(song)}>
        <div className={styles.albumArtSmall}>
          {albumArt ? (
            <img src={albumArt} alt={song.title} loading="lazy" />
          ) : (
            <Icon name="music" size={16} decorative />
          )}
        </div>
        <div className={styles.songMeta}>
          <div className={styles.songTitle}>{song.title}</div>
          <div className={styles.songArtist}>{song.artist}</div>
        </div>
        <Icon name="play" size={14} decorative />
      </button>
    );
  });

// Playlist card component with lazy album art loading for first song
const PlaylistCardItem: React.FC<{
  playlist: Playlist;
  onPlay: (playlist: Playlist) => void;
  countLabel: string;
}> = React.memo(({ playlist, onPlay, countLabel }) => {
  const firstSong = playlist.songs[0];
  const lazyAlbumArt = useAlbumArt(
    firstSong?.id,
    firstSong?.hasAlbumArt || !!firstSong?.albumArt,
  );
  const albumArt = firstSong?.albumArt || lazyAlbumArt;

  return (
    <button
      className={styles.playlistCard}
      onClick={() => onPlay(playlist)}
      type="button"
    >
      <div className={styles.playlistArt}>
        {albumArt ? (
          <img
            src={albumArt}
            alt=""
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Icon name="list" size={20} decorative />
        )}
      </div>
      <div className={styles.playlistMeta}>
        <div className={styles.playlistName}>{playlist.name}</div>
        <div className={styles.playlistCount}>{countLabel}</div>
      </div>
      <Icon name="play" size={16} decorative />
    </button>
  );
});

export const Home: React.FC<HomeProps> = ({ musicPlayerHook, onAddMusic }) => {
  const { t } = useTranslation();
  const { playerState, library, playSong, getFavoriteSongs, navigateToSongs } =
    musicPlayerHook;

  const favoriteSongs = useMemo(
    () => getFavoriteSongs(),
    [library.songs, library.favorites, getFavoriteSongs],
  );

  const playlists = useMemo(
    () => flattenPlaylists(library.playlists),
    [library.playlists],
  );

  const spotlightPlaylists = useMemo(
    () => playlists.filter((p) => p.id !== "all-songs"),
    [playlists],
  );

  const allSongsPlaylist = useMemo(
    () => playlists.find((p) => p.id === "all-songs"),
    [playlists],
  );

  const recentlyAdded = useMemo(
    () => library.songs.slice(-6).reverse(),
    [library.songs],
  );

  const totalDurationHours = useMemo(() => {
    if (!library.songs.length) return 0;
    const seconds = library.songs.reduce(
      (total, song) => total + (song.duration || 0),
      0,
    );
    return seconds / 3600;
  }, [library.songs]);

  const formatHours = (value: number) =>
    value < 1 ? `${Math.round(value * 60)}m` : `${value.toFixed(1)}h`;

  const handlePlaySong = useCallback(
    (song: Song) => {
      const playlist = playerState.currentPlaylist || allSongsPlaylist;
      playSong(song, playlist || undefined);
    },
    [playSong, playerState.currentPlaylist, allSongsPlaylist],
  );

  const handleSmartStart = useCallback(() => {
    if (!library.songs.length) {
      onAddMusic();
      return;
    }

    const pool = favoriteSongs.length ? favoriteSongs : library.songs;
    const randomSong = pool[Math.floor(Math.random() * pool.length)];
    const playlist = favoriteSongs.length
      ? {
          id: "favorites-quickstart",
          name: t("favorites.favorites"),
          songs: favoriteSongs,
        }
      : allSongsPlaylist;

    playSong(randomSong, playlist || undefined);
  }, [library.songs, favoriteSongs, playSong, allSongsPlaylist, onAddMusic, t]);

  const handlePlayFavorites = useCallback(() => {
    if (!favoriteSongs.length) {
      navigateToSongs();
      return;
    }
    const favoritesPlaylist: Playlist = {
      id: "favorites-home",
      name: t("favorites.favorites"),
      songs: favoriteSongs,
    };
    playSong(favoriteSongs[0], favoritesPlaylist);
  }, [favoriteSongs, playSong, navigateToSongs, t]);

  const handlePlayPlaylist = useCallback(
    (playlist: Playlist) => {
      if (!playlist.songs.length) return;
      playSong(playlist.songs[0], playlist);
      navigateToSongs();
    },
    [playSong, navigateToSongs],
  );

  const heroSong = playerState.currentSong || recentlyAdded[0] || null;
  const hasLibraryContent = library.songs.length > 0;

  const stats = [
    {
      label: t("home.stats.songs"),
      value: library.songs.length.toString(),
    },
    {
      label: t("home.stats.playlists"),
      value: playlists.filter((p) => p.id !== "all-songs").length.toString(),
    },
    {
      label: t("home.stats.favorites"),
      value: favoriteSongs.length.toString(),
    },
    {
      label: t("home.stats.duration"),
      value: hasLibraryContent ? formatHours(totalDurationHours) : "0",
    },
  ];

  const quickActions = [
    {
      key: "smartStart",
      icon: "sparkles",
      label: t("home.smartStart"),
      description: t("home.smartStartDescription"),
      action: handleSmartStart,
    },
    {
      key: "library",
      icon: "list",
      label: t("home.browseLibrary"),
      description: t("home.libraryDescription"),
      action: navigateToSongs,
    },
    {
      key: "favorites",
      icon: "heart",
      label: t("home.favorites"),
      description: t("home.favoritesDescription"),
      action: handlePlayFavorites,
    },
    {
      key: "upload",
      icon: "upload",
      label: t("home.uploadMusic"),
      description: t("home.uploadDescription"),
      action: onAddMusic,
    },
  ];

  return (
    <div className={styles.home}>
      <section className={`${styles.panel} ${styles.hero}`}>
        <div className={styles.heroArt}>
          {heroSong?.albumArt ? (
            <img
              src={heroSong.albumArt}
              alt={t("player.albumArtAlt", { title: heroSong.title })}
            />
          ) : (
            <div className={styles.heroArtPlaceholder}>
              <Icon name="music" size={48} decorative />
            </div>
          )}
        </div>
        <div className={styles.heroContent}>
          <span className={styles.heroTag}>
            {heroSong ? t("home.heroNowPlaying") : t("home.heroEmpty")}
          </span>
          <h2 className={styles.heroTitle}>
            {heroSong ? heroSong.title : t("home.subtitle")}
          </h2>
          <p className={styles.heroSubtitle}>
            {heroSong ? heroSong.artist : t("home.heroEmptyDescription")}
          </p>
          <div className={styles.heroActions}>
            {heroSong && hasLibraryContent ? (
              <>
                <Button onClick={() => handlePlaySong(heroSong)}>
                  <Icon name="play" size={16} decorative />
                  {playerState.currentSong
                    ? t("home.resume")
                    : t("home.startListening")}
                </Button>
                <Button variant="outline" onClick={navigateToSongs}>
                  <Icon name="list" size={16} decorative />
                  {t("home.browseLibrary")}
                </Button>
              </>
            ) : (
              <Button onClick={onAddMusic}>
                <Icon name="upload" size={16} decorative />
                {t("home.uploadMusic")}
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>{t("home.quickActions")}</h3>
            <p className={styles.sectionSubtitle}>{t("home.subtitle")}</p>
          </div>
        </div>
        <div className={styles.quickActions}>
          {quickActions.map((action) => (
            <button
              key={action.key}
              className={styles.quickAction}
              onClick={action.action}
              type="button"
            >
              <div className={styles.quickActionIcon}>
                <Icon name={action.icon} size={18} decorative />
              </div>
              <div>
                <div className={styles.quickActionLabel}>{action.label}</div>
                <p className={styles.quickActionDescription}>
                  {action.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className={`${styles.panel} ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{t("home.recentlyAdded")}</h3>
          <Button variant="ghost" size="sm" onClick={navigateToSongs}>
            {t("home.viewAll")}
          </Button>
        </div>
        {recentlyAdded.length ? (
          <div className={styles.cardGrid}>
            {recentlyAdded.map((song) => (
              <SongCardItem key={song.id} song={song} onPlay={handlePlaySong} />
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>{t("home.emptyRecent")}</p>
        )}
      </section>

      <section className={`${styles.panel} ${styles.section}`}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{t("home.featuredPlaylists")}</h3>
        </div>
        {spotlightPlaylists.length ? (
          <div className={styles.cardGrid}>
            {spotlightPlaylists.map((playlist) => (
              <PlaylistCardItem
                key={playlist.id}
                playlist={playlist}
                onPlay={handlePlayPlaylist}
                countLabel={t("home.playlistCount", {
                  count: playlist.songs.length,
                })}
              />
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>{t("home.emptyPlaylists")}</p>
        )}
      </section>

      <section className={`${styles.panel} ${styles.section}`}>
        <h3 className={styles.sectionTitle}>{t("home.statsTitle")}</h3>
        <div className={styles.statsGrid}>
          {stats.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <span className={styles.statLabel}>{stat.label}</span>
              <strong className={styles.statValue}>{stat.value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
