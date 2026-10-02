import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { useTranslation } from "react-i18next";
import styles from "./Player.module.css";

interface PlayerControlsProps {
  isPlaying: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  onTogglePlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

export function PlayerControls({
  isPlaying,
  shuffle,
  repeat,
  onTogglePlayPause,
  onNext,
  onPrevious,
  onToggleShuffle,
  onToggleRepeat,
}: PlayerControlsProps) {
  const { t } = useTranslation();

  const getRepeatTitle = () => {
    switch (repeat) {
      case "one":
        return t("player.repeatTrack");
      case "all":
        return t("player.repeatAll");
      default:
        return t("player.repeatOff");
    }
  };

  return (
    <div className={styles.playbackButtons}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={`${styles.controlButton} ${shuffle ? styles.active : ""}`}
        onClick={onToggleShuffle}
        title={shuffle ? t("player.shuffleOn") : t("player.shuffleOff")}
      >
        <Icon name="shuffle" size={16} decorative />
      </Button>
      <Button
        variant="ghost"
        size="icon-md"
        className={styles.controlButton}
        onClick={onPrevious}
        title={t("player.previous")}
      >
        <Icon name="skipBack" size={18} decorative />
      </Button>
      <Button
        variant="primary"
        size="icon-lg"
        className={styles.playButton}
        onClick={onTogglePlayPause}
        title={isPlaying ? t("player.pause") : t("player.play")}
      >
        {isPlaying ? (
          <Icon name="pause" size={20} decorative />
        ) : (
          <Icon name="play" size={20} decorative />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-md"
        className={styles.controlButton}
        onClick={onNext}
        title={t("player.next")}
      >
        <Icon name="skipForward" size={18} decorative />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className={`${styles.controlButton} ${repeat !== "off" ? styles.active : ""} ${repeat === "one" ? styles.repeatOne : ""}`}
        onClick={onToggleRepeat}
        title={getRepeatTitle()}
      >
        <Icon name="repeat" size={16} decorative />
      </Button>
    </div>
  );
}
