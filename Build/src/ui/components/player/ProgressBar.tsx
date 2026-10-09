import { useCallback } from "react";
import { useDragControl } from "../../../ui/hooks";
import { useKomorebiStore } from "../../../store";
import { selectCurrentTime } from "../../../store";
import styles from "./Player.module.css";

interface ProgressBarProps {
  duration: number;
  onSeek: (time: number) => void;
}

export function ProgressBar({ duration, onSeek }: ProgressBarProps) {
  const currentTime = useKomorebiStore(selectCurrentTime);
  const onMove = useCallback(
    (fraction: number) => {
      if (duration) onSeek(fraction * duration);
    },
    [duration, onSeek],
  );

  const { ref, isDragging, handleMouseDown, handleTouchStart } =
    useDragControl(onMove);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.round(seconds);
    const shouldShowHours = duration >= 3600;

    if (shouldShowHours) {
      const hours = Math.floor(totalSeconds / 3600);
      const mins = Math.floor((totalSeconds % 3600) / 60);
      const secs = totalSeconds % 60;
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    } else {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.progressSection}>
      <span className={styles.timeDisplay}>{formatTime(currentTime)}</span>
      <div
        className={`${styles.progressBar} ${isDragging ? styles.dragging : ""}`}
        ref={ref}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <span className={styles.timeDisplay}>{formatTime(duration)}</span>
    </div>
  );
}
