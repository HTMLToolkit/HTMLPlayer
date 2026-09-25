import { useTranslation } from "react-i18next";
import { ScrollText } from "../shared/ScrollText";
import styles from "./Player.module.css";

interface PlayerTrackInfoProps {
  title?: string;
  artist?: string;
  album?: string;
  onAlbumClick?: () => void;
  onArtistClick?: () => void;
}

export const PlayerTrackInfo = ({
  title,
  artist,
  album,
  onAlbumClick,
  onArtistClick,
}: PlayerTrackInfoProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.songInfo}>
      <div className={styles.songTitleWrapper}>
        <ScrollText
          text={title || t("common.loading")}
          textClassName={`${styles.songTitle} ${onAlbumClick ? styles.navigableTitle : ""}`}
          textStyle={{ opacity: title ? 1 : 0 }}
          allowHTML
          pauseOnHover
          onClick={onAlbumClick}
        />
      </div>
      <button
        type="button"
        className={styles.artistButton}
        onClick={onArtistClick}
        title={artist}
        disabled={!onArtistClick}
      >
        {artist}
      </button>
      {album && <div className={styles.albumName}>{album}</div>}
    </div>
  );
};
