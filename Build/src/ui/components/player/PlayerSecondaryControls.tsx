import { useTranslation } from "react-i18next";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { isMiniplayerSupported, toggleMiniplayer } from "../../../platform/pip/index";
import { MiniplayerContent } from "./Miniplayer";
import styles from "./Player.module.css";

interface PlayerSecondaryControlsProps {
  currentSong: any;
  isPlaying: boolean;
  isFavorite: boolean;
  showVisualizer: boolean;
  showLyrics: boolean;
  isOnSafari: boolean;
  onFavorite: () => void;
  onVisualizerToggle: () => void;
  onLyricsToggle: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const PlayerSecondaryControls = ({
  currentSong,
  isPlaying,
  isFavorite,
  showVisualizer,
  showLyrics,
  isOnSafari,
  onFavorite,
  onVisualizerToggle,
  onLyricsToggle,
  onPlayPause,
  onNext,
  onPrevious,
}: PlayerSecondaryControlsProps) => {
  const { t } = useTranslation();

  return (
    <div className={styles.secondaryControls}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={`${styles.favoriteButton} ${isFavorite ? styles.favorited : ""}`}
        onClick={onFavorite}
        title={isFavorite ? t("player.removeFavorite") : t("player.addFavorite")}
      >
        <Icon name="heart" size={16} decorative />
      </Button>

      {!isOnSafari && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${styles.secondaryButton} ${showVisualizer ? styles.active : ""}`}
          onClick={onVisualizerToggle}
          title={t("player.visualizer")}
          data-tour="visualizer-button"
        >
          <Icon name="barChart3" size={16} decorative />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        className={`${styles.secondaryButton} ${showLyrics ? styles.active : ""}`}
        onClick={onLyricsToggle}
        title={t("player.lyrics")}
        data-tour="lyrics-button"
      >
        <Icon name="type" size={16} decorative />
      </Button>

      {isMiniplayerSupported() && (
        <Button
          variant="ghost"
          size="icon-sm"
          className={styles.secondaryButton}
          onClick={() => {
            toggleMiniplayer(
              {
                playerState: { currentSong, isPlaying },
                togglePlayPause: onPlayPause,
                next: onNext,
                previous: onPrevious,
              },
              MiniplayerContent,
            );
          }}
          title="Picture-in-Picture"
        >
          <Icon name="pictureInPicture2" size={16} decorative />
        </Button>
      )}
    </div>
  );
};
