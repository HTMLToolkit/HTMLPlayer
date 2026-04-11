import { useTranslation } from "react-i18next";
import { useAlbumArt } from "../../../hooks/useAlbumArt";
import styles from "./Player.module.css";

interface PlayerAlbumArtProps {
  songId?: string;
  hasAlbumArt?: boolean;
  albumArt?: string;
  title: string;
}

export const PlayerAlbumArt = ({ songId, hasAlbumArt, albumArt, title }: PlayerAlbumArtProps) => {
  const { t } = useTranslation();
  const lazyAlbumArt = useAlbumArt(songId, !!hasAlbumArt || !!albumArt);
  const currentAlbumArt = albumArt || lazyAlbumArt;

  return (
    <div className={styles.albumArt}>
      {currentAlbumArt && (
        <img
          src={currentAlbumArt}
          alt={t("player.albumArtAlt", { title })}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
          }}
        />
      )}
    </div>
  );
};
