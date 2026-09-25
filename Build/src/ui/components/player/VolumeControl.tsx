import { useCallback } from "react";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { useDragControl } from "../../../ui/hooks";
import styles from "./Player.module.css";

interface VolumeControlProps {
  volume: number;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({
  volume,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const onMove = useCallback(
    (fraction: number) => onVolumeChange(fraction),
    [onVolumeChange],
  );

  const { ref, isDragging, handleClick, handleMouseDown, handleTouchStart } =
    useDragControl(onMove);

  const getVolumeIcon = () => {
    if (volume === 0) return <Icon name="volumeOff" size={16} decorative />;
    if (volume < 0.3) return <Icon name="volumeX" size={16} decorative />;
    if (volume < 0.7) return <Icon name="volume1" size={16} decorative />;
    return <Icon name="volume2" size={16} decorative />;
  };

  const volumePercentage = volume * 100;

  return (
    <div className={styles.volumeControls}>
      <Button
        variant="ghost"
        size="icon-sm"
        className={styles.volumeButton}
        onClick={onToggleMute}
      >
        {getVolumeIcon()}
      </Button>
      <div
        className={`${styles.volumeBar} ${isDragging ? styles.dragging : ""}`}
        ref={ref}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div
          className={styles.volumeFill}
          style={{ width: `${volumePercentage}%` }}
        />
      </div>
    </div>
  );
}
