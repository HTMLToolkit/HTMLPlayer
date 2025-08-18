import React, { useRef, useEffect, useState, useCallback } from "react";
import { spectrogramTypes, VisualizerType } from "../helpers/visualizerLoader";
import { Settings, SlidersHorizontal } from "lucide-react";
import { Button } from "./Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "./DropdownMenu";
import styles from "./Visualizer.module.css";

type VisualizerProps = {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
};

export const Visualizer = ({
  analyserNode,
  isPlaying,
  className,
}: VisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const [selectedVisualizerKey, setSelectedVisualizerKey] = useState(
    Object.keys(spectrogramTypes)[0]
  );
  const [visualizerSettings, setVisualizerSettings] = useState<
    Record<string, any>
  >({});
  const [showSettings, setShowSettings] = useState(false);

  const selectedVisualizer = spectrogramTypes[selectedVisualizerKey];

  const handleSettingChange = (key: string, value: any) => {
    setVisualizerSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const draw = useCallback(() => {
    if (!analyserNode || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const visualizer = spectrogramTypes[selectedVisualizerKey];
    if (!visualizer) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    visualizer.draw(
      analyserNode,
      canvas,
      ctx,
      bufferLength,
      dataArray,
      visualizer.dataType,
      visualizerSettings
    );

    animationFrameId.current = requestAnimationFrame(draw);
  }, [analyserNode, selectedVisualizerKey, visualizerSettings]);

  useEffect(() => {
    if (isPlaying && analyserNode) {
      animationFrameId.current = requestAnimationFrame(draw);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, analyserNode, draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
    });

    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    // Reset settings when visualizer changes
    setVisualizerSettings(
      Object.entries(selectedVisualizer.settingsConfig || {}).reduce(
        (acc, [key, config]) => {
          acc[key] = config.default;
          return acc;
        },
        {} as Record<string, any>
      )
    );
  }, [selectedVisualizerKey, selectedVisualizer.settingsConfig]);

  return (
    <div className={`${styles.visualizerContainer} ${className ?? ""}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.controls}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={styles.dropdownTrigger}>
              <SlidersHorizontal size={16} />
              <span>{selectedVisualizer.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={styles.dropdownContent}>
            <DropdownMenuRadioGroup
              value={selectedVisualizerKey}
              onValueChange={setSelectedVisualizerKey}
            >
              {Object.entries(spectrogramTypes).map(([key, vis]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {vis.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {selectedVisualizer.settingsConfig && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings size={16} />
          </Button>
        )}
      </div>
      {showSettings && selectedVisualizer.settingsConfig && (
        <div className={styles.settingsPanel}>
          <h4>{selectedVisualizer.name} Settings</h4>
          {Object.entries(selectedVisualizer.settingsConfig).map(
            ([key, config]) => (
              <div key={key} className={styles.setting}>
                <label htmlFor={key}>{key}</label>
                {config.type === "range" && (
                  <input
                    type="range"
                    id={key}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={visualizerSettings[key] ?? config.default}
                    onChange={(e) =>
                      handleSettingChange(key, parseFloat(e.target.value))
                    }
                  />
                )}
                {config.type === "number" && (
                  <input
                    type="number"
                    id={key}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={visualizerSettings[key] ?? config.default}
                    onChange={(e) =>
                      handleSettingChange(key, parseFloat(e.target.value))
                    }
                  />
                )}
                {/* Add other setting types here if needed */}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
