import React, { useCallback, useEffect, useState } from "react";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
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
  const [isDragging, setIsDragging] = useState(false);
  const volumeRef = React.useRef<HTMLDivElement>(null);

  const updateVolume = useCallback(
    (clientX: number) => {
      if (!volumeRef.current) return;
      const rect = volumeRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, clickX / rect.width));
      onVolumeChange(percentage);
    },
    [onVolumeChange],
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return;
    updateVolume(e.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateVolume(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateVolume(e.touches[0].clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) updateVolume(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        updateVolume(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => setIsDragging(false);
    const handleTouchEnd = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, updateVolume]);

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
        ref={volumeRef}
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
