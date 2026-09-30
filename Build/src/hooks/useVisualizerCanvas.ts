import { useRef, useEffect, useState, useCallback, RefObject } from "react";
import { logger } from "../helpers/logger";
import {
  getVisualizer,
  getAvailableVisualizers,
  VisualizerType,
  VisualizerSettings,
  clearVisualizerState,
} from "../platform/visualizers";

interface UseVisualizerCanvasProps {
  analyserNode?: AnalyserNode | null;
  isPlaying: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export const useVisualizerCanvas = ({
  analyserNode,
  isPlaying,
  canvasRef,
}: UseVisualizerCanvasProps) => {
  const DEFAULT_VISUALIZER_KEY = "oceanwaves";
  const animationFrameId = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const [availableVisualizers, setAvailableVisualizers] = useState<string[]>(
    [],
  );
  const [loadedVisualizerNames, setLoadedVisualizerNames] = useState<
    Map<string, string>
  >(new Map());
  const [selectedVisualizerKey, setSelectedVisualizerKey] =
    useState<string>("");
  const [selectedVisualizer, setSelectedVisualizer] =
    useState<VisualizerType | null>(null);
  const [visualizerSettings, setVisualizerSettings] =
    useState<VisualizerSettings>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const visualizers = getAvailableVisualizers();
    setAvailableVisualizers(visualizers);

    let cancelled = false;
    Promise.all(
      visualizers.map(async (key) => {
        const visualizer = await getVisualizer(key);
        return { key, name: visualizer?.name || key };
      }),
    ).then((results) => {
      if (cancelled) return;
      setLoadedVisualizerNames(
        new Map(results.map(({ key, name }) => [key, name])),
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedVisualizerKey || availableVisualizers.length === 0) return;

    setSelectedVisualizerKey(
      availableVisualizers.includes(DEFAULT_VISUALIZER_KEY)
        ? DEFAULT_VISUALIZER_KEY
        : (availableVisualizers[0] ?? ""),
    );
  }, [availableVisualizers, selectedVisualizerKey]);

  useEffect(() => {
    if (!selectedVisualizerKey) return;

    setIsLoading(true);
    getVisualizer(selectedVisualizerKey)
      .then((visualizer) => {
        setSelectedVisualizer(visualizer);
        setIsLoading(false);

        if (visualizer?.settingsConfig) {
          setVisualizerSettings(
            Object.entries(visualizer.settingsConfig).reduce(
              (acc, [key, config]) => {
                if (config === undefined) return acc;
                acc[key] = config.default;
                return acc;
              },
              {} as VisualizerSettings,
            ),
          );
        }
      })
      .catch((error) => {
        logger.error("Failed to load visualizer", {
          error: error instanceof Error ? error.message : "",
        });
        setIsLoading(false);
      });
  }, [selectedVisualizerKey]);

  const draw = useCallback(() => {
    if (!analyserNode || !canvasRef.current || !selectedVisualizer) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    selectedVisualizer.draw(
      analyserNode,
      canvas,
      ctx,
      bufferLength,
      dataArrayRef.current,
      selectedVisualizer.dataType,
      visualizerSettings,
    );

    animationFrameId.current = requestAnimationFrame(draw);
  }, [analyserNode, selectedVisualizer, visualizerSettings, canvasRef]);

  useEffect(() => {
    if (isPlaying && analyserNode && selectedVisualizer) {
      animationFrameId.current = requestAnimationFrame(draw);
    } else {
      if (animationFrameId.current)
        cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current)
        cancelAnimationFrame(animationFrameId.current);
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
  }, [canvasRef]);

  useEffect(() => () => clearVisualizerState(), []);

  return {
    availableVisualizers,
    loadedVisualizerNames,
    selectedVisualizerKey,
    selectedVisualizer,
    setSelectedVisualizerKey,
    visualizerSettings,
    setVisualizerSettings,
    isLoading,
  };
};
