import { useTranslation } from "react-i18next";
import { ScrollText } from "../shared/ScrollText";
import styles from "./Player.module.css";

interface PlayerTrackInfoProps {
  title?: string;
  artist?: string;
}

export const PlayerTrackInfo = ({ title, artist }: PlayerTrackInfoProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.songInfo}>
      <div className={styles.songTitleWrapper}>
        <ScrollText
          text={title || t("common.loading")}
          textClassName={styles.songTitle}
          textStyle={{ opacity: title ? 1 : 0 }}
          allowHTML
          pauseOnHover
        />
      </div>
      <div className={styles.artistName}>{artist}</div>
    </div>
  );
};
