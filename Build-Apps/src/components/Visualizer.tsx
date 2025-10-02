import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getVisualizer, getAvailableVisualizers, VisualizerType } from "../helpers/visualizerLoader";
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

interface VisualizerProps {
  analyserNode: AnalyserNode | null;
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
  const animationFrameId = useRef<number | null>(null);
  const [availableVisualizers, setAvailableVisualizers] = useState<string[]>([]);
  const [loadedVisualizerNames, setLoadedVisualizerNames] = useState<Map<string, string>>(new Map());
  const [selectedVisualizerKey, setSelectedVisualizerKey] = useState<string>("");
  const [selectedVisualizer, setSelectedVisualizer] = useState<VisualizerType | null>(null);
  const [visualizerSettings, setVisualizerSettings] = useState<Record<string, any>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingVisualizer, setIsLoadingVisualizer] = useState(false);

  // Initialize available visualizers and load their names
  useEffect(() => {
    const visualizers = getAvailableVisualizers();
    setAvailableVisualizers(visualizers);
    
    // Load all visualizer names for the dropdown
    Promise.all(
      visualizers.map(async (key) => {
        const visualizer = await getVisualizer(key);
        return { key, name: visualizer?.name || key };
      })
    ).then((results) => {
      const namesMap = new Map(results.map(({ key, name }) => [key, name]));
      setLoadedVisualizerNames(namesMap);
    });
    
    if (visualizers.length > 0 && !selectedVisualizerKey) {
      setSelectedVisualizerKey(visualizers[0]);
    }
  }, [selectedVisualizerKey]);

  // Load selected visualizer
  useEffect(() => {
    if (!selectedVisualizerKey) return;
    
    setIsLoadingVisualizer(true);
    getVisualizer(selectedVisualizerKey).then((visualizer) => {
      setSelectedVisualizer(visualizer);
      setIsLoadingVisualizer(false);
      
      // Initialize settings with defaults
      if (visualizer?.settingsConfig) {
        setVisualizerSettings(
          Object.entries(visualizer.settingsConfig).reduce(
            (acc, [key, config]) => {
              acc[key] = config.default;
              return acc;
            },
            {} as Record<string, any>
          )
        );
      }
    }).catch((error) => {
      console.error('Failed to load visualizer:', error);
      setIsLoadingVisualizer(false);
    });
  }, [selectedVisualizerKey]);

  const handleSettingChange = (key: string, value: any) => {
    setVisualizerSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const draw = useCallback(() => {
    if (!analyserNode || !canvasRef.current || !selectedVisualizer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    selectedVisualizer.draw(
      analyserNode,
      canvas,
      ctx,
      bufferLength,
      dataArray,
      selectedVisualizer.dataType,
      visualizerSettings
    );

    animationFrameId.current = requestAnimationFrame(draw);
  }, [analyserNode, selectedVisualizer, visualizerSettings]);

  useEffect(() => {
    if (isPlaying && analyserNode && selectedVisualizer) {
      animationFrameId.current = requestAnimationFrame(draw);
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isPlaying, analyserNode, selectedVisualizer, draw]);

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

  const handleVisualizerChange = async (newKey: string) => {
    setSelectedVisualizerKey(newKey);
  };

  return (
    <div className={`${styles.visualizerContainer} ${className ?? ""}`}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.controls}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={styles.dropdownTrigger} disabled={isLoadingVisualizer}>
              <SlidersHorizontal size={16} />
              <span>
                {isLoadingVisualizer 
                  ? t("common.loading") 
                  : selectedVisualizer?.name || t("visualizer.selectVisualizer")
                }
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
            <Settings size={16} />
          </Button>
        )}
      </div>
      {showSettings && selectedVisualizer?.settingsConfig && (
        <div className={styles.settingsPanel}>
          <h4>{selectedVisualizer.name} {t("settings.title")}</h4>
          {Object.entries(selectedVisualizer.settingsConfig).map(
            ([key, config]) => (
              <div key={key} className={styles.setting}>
                <label htmlFor={key}>{t(`visualizers.${selectedVisualizerKey}.settings.${key}`)}</label>
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
            )
          )}
        </div>
      )}
    </div>
  );
};
