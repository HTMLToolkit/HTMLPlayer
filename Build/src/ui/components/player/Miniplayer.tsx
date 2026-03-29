import { useTranslation } from "react-i18next";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import styles from "./Miniplayer.module.css";

export interface MiniplayerControls {
  togglePlayPause: () => void;
  next: () => void;
  previous: () => void;
  playerState: {
    currentSong: any;
    isPlaying: boolean;
  };
}

interface MiniplayerProps {
  controls: MiniplayerControls;
}

export const MiniplayerContent: React.FC<MiniplayerProps> = ({ controls }) => {
  const { t } = useTranslation();
  const { playerState, togglePlayPause, next, previous } = controls;
  const { currentSong, isPlaying } = playerState;

  if (!currentSong) {
    return <div>{t("player.noSongPlaying")}</div>;
  }

  return (
    <div className={styles.miniplayer}>
      {currentSong.albumArt && (
        <img
          src={currentSong.albumArt}
          alt={t("player.albumArt")}
          className={styles.albumArt}
        />
      )}
      <div className={styles.songInfo}>
        <div className={styles.songTitle}>{currentSong.title}</div>
        <div className={styles.artist}>{currentSong.artist}</div>
      </div>
      <div className={styles.controls}>
        <Button
          id="prevBtn"
          title={t("player.previousTrack")}
          onClick={previous}
        >
          <Icon name="skipBack" size={18} decorative />
        </Button>
        <Button
          id="playBtn"
          className={styles.playBtn}
          title={isPlaying ? "Pause" : "Play"}
          onClick={togglePlayPause}
        >
          {isPlaying ? (
            <Icon name="pause" size={20} decorative />
          ) : (
            <Icon name="play" size={20} decorative />
          )}
        </Button>
        <Button id="nextBtn" title={t("player.nextTrack")} onClick={next}>
          <Icon name="skipForward" size={18} decorative />
        </Button>
      </div>
    </div>
  );
};

export const Miniplayer = ({ controls }: MiniplayerProps) => {
  const { t } = useTranslation();
  const { playerState, togglePlayPause, next, previous } = controls;
  const { currentSong, isPlaying } = playerState;

  if (!currentSong) {
    return <div className={styles.miniplayer}>{t("player.noSongPlaying")}</div>;
  }

  return (
    <div className={styles.miniplayer}>
      <img
        src={currentSong.albumArt || ""}
        alt={t("player.albumArt")}
        className={styles.albumArt}
      />
      <div className={styles.songInfo}>
        <div className={styles.songTitle}>{currentSong.title}</div>
        <div className={styles.artist}>{currentSong.artist}</div>
      </div>
      <div className={styles.controls}>
        <Button onClick={previous}>{t("player.previousTrack")}</Button>
        <Button onClick={togglePlayPause}>
          {isPlaying ? t("player.pause") : t("player.play")}
        </Button>
        <Button onClick={next}>{t("player.nextTrack")}</Button>
      </div>
    </div>
  );
};
