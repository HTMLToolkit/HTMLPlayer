import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
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
import { Slider } from "../primitives/Slider";
import { Input } from "../primitives/Input";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";
import styles from "./Visualizer.module.css";

gsap.registerPlugin(useGSAP);

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
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  useGSAP(
    () => {
      const panel = settingsPanelRef.current;
      if (!panel || prefersReducedMotion()) return;
      gsap.fromTo(
        panel,
        { opacity: 0, y: -10, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: "power2.out" },
      );
    },
    { dependencies: [showSettings], scope: settingsPanelRef },
  );

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

  const handleSettingChange = (key: string, value: number) => {
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
        <div ref={settingsPanelRef} className={styles.settingsPanel}>
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
                  <Slider
                    id={key}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={[Number(visualizerSettings[key] ?? config.default)]}
                    onValueChange={(value) =>
                      handleSettingChange(key, value[0] ?? 0)
                    }
                  />
                )}
                {config.type === "number" && (
                  <Input
                    type="number"
                    id={key}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={Number(visualizerSettings[key] ?? config.default)}
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
