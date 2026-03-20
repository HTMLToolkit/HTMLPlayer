import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Home.module.css";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { useAlbumArt } from "../../../hooks/useAlbumArt";
import { useNavigation } from "../../navigation";
import type { Track, Playlist } from "../../../core/engine/types";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";
import { flattenPlaylists } from "../../../platform/library";

interface HomeProps {
  komorebi: UseKomorebiReturn;
  onAddMusic: () => Promise<void>;
}

const SongCardItem = React.memo<{ song: Track; onPlay: (song: Track) => void }>(
  ({ song, onPlay }) => {
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
  },
);

const PlaylistCardItem = React.memo<{
  playlist: Playlist;
  onPlay: (playlist: Playlist) => void;
  countLabel: string;
}>(({ playlist, onPlay, countLabel }) => {
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
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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

export const Home: React.FC<HomeProps> = ({ komorebi, onAddMusic }) => {
  const { t } = useTranslation();
  const { currentTrack, library, playSong, getFavorites } = komorebi;
  const { goToSongs } = useNavigation();

  const libraryState = library.getState();
  const songs = libraryState.songs;
  const playlists = libraryState.playlists;
  const favorites = libraryState.favorites;

  const favoriteSongs = useMemo(
    () => getFavorites(),
    [getFavorites, favorites],
  );
  const flatPlaylists = useMemo(() => flattenPlaylists(playlists), [playlists]);
  const spotlightPlaylists = useMemo(
    () => flatPlaylists.filter((p) => p.id !== "all-songs"),
    [flatPlaylists],
  );
  const recentlyAdded = useMemo(() => songs.slice(-6).reverse(), [songs]);

  const totalHours = useMemo(() => {
    if (!songs.length) return 0;
    const seconds = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
    return seconds / 3600;
  }, [songs]);

  const formatHours = (v: number) =>
    v < 1 ? `${Math.round(v * 60)}m` : `${v.toFixed(1)}h`;

  const handlePlaySong = useCallback(
    (song: Track) => playSong(song),
    [playSong],
  );

  const handleSmartStart = useCallback(() => {
    if (!songs.length) {
      onAddMusic();
      return;
    }
    const pool = favoriteSongs.length ? favoriteSongs : songs;
    const randomSong = pool[Math.floor(Math.random() * pool.length)];
    const playlist = favoriteSongs.length
      ? {
          id: "favorites-quickstart",
          name: t("favorites.favorites"),
          songs: favoriteSongs,
        }
      : null;
    playSong(randomSong, playlist || undefined);
  }, [songs, favoriteSongs, playSong, onAddMusic, t]);

  const handlePlayFavorites = useCallback(() => {
    if (favoriteSongs.length) {
      playSong(favoriteSongs[0], {
        id: "favorites-home",
        name: t("favorites.favorites"),
        songs: favoriteSongs,
      });
    } else {
      goToSongs();
    }
  }, [favoriteSongs, playSong, goToSongs, t]);

  const handlePlayPlaylist = useCallback(
    (playlist: Playlist) => {
      if (playlist.songs.length) {
        playSong(playlist.songs[0], playlist);
        goToSongs();
      }
    },
    [playSong, goToSongs],
  );

  const heroSong = currentTrack || recentlyAdded[0] || null;
  const lazyHeroArt = useAlbumArt(
    heroSong?.id,
    heroSong?.hasAlbumArt || !!heroSong?.albumArt,
  );
  const heroArt = heroSong?.albumArt || lazyHeroArt;
  const hasContent = songs.length > 0;

  const stats = [
    { label: t("home.stats.songs"), value: songs.length.toString() },
    {
      label: t("home.stats.playlists"),
      value: flatPlaylists
        .filter((p) => p.id !== "all-songs")
        .length.toString(),
    },
    {
      label: t("home.stats.favorites"),
      value: favoriteSongs.length.toString(),
    },
    {
      label: t("home.stats.duration"),
      value: hasContent ? formatHours(totalHours) : "0",
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
      action: goToSongs,
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
          {heroArt ? (
            <img
              src={heroArt}
              alt={t("player.albumArtAlt", { title: heroSong?.title || "" })}
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
            {heroSong && hasContent ? (
              <>
                <Button onClick={() => handlePlaySong(heroSong)}>
                  <Icon name="play" size={16} decorative />
                  {currentTrack ? t("home.resume") : t("home.startListening")}
                </Button>
                <Button variant="outline" onClick={goToSongs}>
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
          <Button variant="ghost" size="sm" onClick={goToSongs}>
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
