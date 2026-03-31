import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVisualizerCanvas } from "../../../hooks/useVisualizerCanvas";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../primitives/DropdownMenu";
import styles from "./Visualizer.module.css";

interface VisualizerProps {
  analyserNode?: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
}

export const Visualizer = ({
  analyserNode,
  isPlaying,
  className,
}: VisualizerProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const {
    availableVisualizers,
    loadedVisualizerNames,
    selectedVisualizerKey,
    selectedVisualizer,
    setSelectedVisualizerKey,
    visualizerSettings,
    setVisualizerSettings,
    isLoading,
  } = useVisualizerCanvas({ analyserNode, isPlaying, canvasRef });

  const handleSettingChange = (key: string, value: any) => {
    setVisualizerSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleVisualizerChange = (newKey: string) => {
    setSelectedVisualizerKey(newKey);
  };

  return (
    <div className={`${styles.visualizerContainer} ${className ?? ""}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.controls}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={styles.dropdownTrigger}
              disabled={isLoading}
            >
              <Icon name="visualizerControls" size={16} decorative inline />
              <span>
                {isLoading
                  ? t("common.loading")
                  : selectedVisualizer?.name ||
                    t("visualizer.selectVisualizer")}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={styles.dropdownContent}>
            <DropdownMenuRadioGroup
              value={selectedVisualizerKey}
              onValueChange={handleVisualizerChange}
            >
              {availableVisualizers.map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {loadedVisualizerNames.get(key) || key}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {selectedVisualizer?.settingsConfig && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Icon name="settings" size={16} decorative inline />
          </Button>
        )}
      </div>
      {showSettings && selectedVisualizer?.settingsConfig && (
        <div className={styles.settingsPanel}>
          <h4>
            {selectedVisualizer.name} {t("settings.title")}
          </h4>
          {Object.entries(selectedVisualizer.settingsConfig).map(
            ([key, config]) => (
              <div key={key} className={styles.setting}>
                <label htmlFor={key}>
                  {t(`visualizers.${selectedVisualizerKey}.settings.${key}`)}
                </label>
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
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
};
