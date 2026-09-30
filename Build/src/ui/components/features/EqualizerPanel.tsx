import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CompositeCurve,
  FilterGradient,
  FilterPoint,
  FrequencyResponseGraph,
  type FilterChangeEvent,
  type GraphThemeFilterColors,
} from "dsssp";
import { Switch } from "../primitives/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/Select";
import { useElementSize } from "../../../hooks/useElementSize";
import { useKomorebiStore } from "../../../store";
import {
  BAND_COUNT,
  EQUALIZER_PRESETS,
  findPreset,
  MAX_FREQUENCY_HZ,
  MAX_GAIN_DB,
  MIN_FREQUENCY_HZ,
  MIN_GAIN_DB,
} from "../../../platform/audio/equalizer";
import {
  bandToGraphFilter,
  bandsToGraphFilters,
  graphFilterToBandPatch,
} from "./equalizerAdapters";
import { EqualizerGraphGrid } from "./EqualizerGraphGrid";
import styles from "./Settings.module.css";

const GRAPH_HEIGHT = 280;
const CURVE_GRADIENT_ID = "equalizer-composite-gradient";
const BAND_COLORS: GraphThemeFilterColors[] = [
  {
    point: "#38bdf8",
    background: "#38bdf8",
    drag: "#0ea5e9",
    active: "#7dd3fc",
  },
  {
    point: "#22d3ee",
    background: "#22d3ee",
    drag: "#06b6d4",
    active: "#67e8f9",
  },
  {
    point: "#34d399",
    background: "#34d399",
    drag: "#10b981",
    active: "#6ee7b7",
  },
  {
    point: "#a3e635",
    background: "#a3e635",
    drag: "#84cc16",
    active: "#bef264",
  },
  {
    point: "#facc15",
    background: "#facc15",
    drag: "#eab308",
    active: "#fde047",
  },
  {
    point: "#fbbf24",
    background: "#fbbf24",
    drag: "#f59e0b",
    active: "#fcd34d",
  },
  {
    point: "#fb923c",
    background: "#fb923c",
    drag: "#f97316",
    active: "#fdba74",
  },
  {
    point: "#f87171",
    background: "#f87171",
    drag: "#ef4444",
    active: "#fca5a5",
  },
  {
    point: "#f472b6",
    background: "#f472b6",
    drag: "#ec4899",
    active: "#f9a8d4",
  },
  {
    point: "#c084fc",
    background: "#c084fc",
    drag: "#a855f7",
    active: "#d8b4fe",
  },
];
const GRAPH_THEME = {
  background: {
    grid: {
      dotted: false,
      lineColor: "var(--border)",
      lineWidth: { minor: 0.5, major: 1, center: 1.5, border: 1 },
    },
    gradient: {
      start: "var(--card)",
      stop: "var(--card)",
      direction: "VERTICAL" as const,
    },
    label: {
      fontSize: 10,
      fontFamily: "var(--font-family-base)",
      color: "var(--muted-foreground)" as const,
    },
    tracker: {
      lineWidth: 1,
      lineColor: "var(--muted-foreground)",
      labelColor: "var(--muted-foreground)",
      backgroundColor: "var(--popover)",
    },
  },
  curve: {
    width: 0,
    color: "var(--themecolor)",
    opacity: 0,
  },
  filters: {
    curve: {
      width: { normal: 0, active: 0 },
      opacity: { normal: 0, active: 0 },
    },
    point: {
      radius: 9,
      lineWidth: 2,
      backgroundOpacity: { drag: 0.35, active: 0.3, normal: 0.18 },
      label: {
        fontSize: 9,
        fontFamily: "var(--font-family-base)",
        color: "var(--muted-foreground)" as const,
      },
    },
    zeroPoint: {
      color: "var(--muted-foreground)",
      background: "var(--muted-foreground)",
    },
    fill: true,
    gradientOpacity: 0.18,
    defaultColor: "var(--themecolor)",
    colors: BAND_COLORS,
  },
};

function formatFrequency(frequency: number): string {
  if (frequency >= 1000) {
    const kHz = frequency / 1000;
    return `${Number.isInteger(kHz) ? kHz : kHz.toFixed(2)} kHz`;
  }
  return `${Math.round(frequency)} Hz`;
}

function formatGain(gainDb: number): string {
  const rounded = Math.round(gainDb * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} dB`;
}

export const EqualizerPanel: React.FC = () => {
  const { t } = useTranslation();
  const equalizer = useKomorebiStore((state) => state.equalizer);
  const setEnabled = useKomorebiStore((state) => state.setEqualizerEnabled);
  const patchBand = useKomorebiStore((state) => state.patchEqualizerBand);
  const applyPreset = useKomorebiStore((state) => state.applyEqualizerPreset);
  const { ref: containerRef, size } = useElementSize<HTMLDivElement>();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const filters = useMemo(
    () => bandsToGraphFilters(equalizer.bands),
    [equalizer.bands],
  );

  const handleToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked);
    },
    [setEnabled],
  );

  const handlePreset = useCallback(
    (name: string) => {
      const preset = findPreset(name);
      if (!preset) return;
      applyPreset(preset);
    },
    [applyPreset],
  );

  const handleBandChange = useCallback(
    (index: number) => (changed: FilterChangeEvent) => {
      patchBand(index, graphFilterToBandPatch(changed));
    },
    [patchBand],
  );

  const activeBand =
    activeIndex === null ? null : (equalizer.bands[activeIndex] ?? null);

  const presetValue = equalizer.presetName ?? "";

  return (
    <div className={styles.equalizerCard}>
      <div className={styles.equalizerHeader}>
        <div className={styles.equalizerHeaderText}>
          <span className={styles.equalizerTitle}>
            {t("settings.audio.enableEqualizer")}
          </span>
          <span className={styles.equalizerSubtitle}>
            {equalizer.presetName
              ? t("settings.audio.presetActive", {
                  name: equalizer.presetName,
                })
              : t("settings.audio.presetCustom")}
          </span>
        </div>
        <Switch
          id="equalizer-enabled"
          checked={equalizer.enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {equalizer.enabled && (
        <>
          <div className={styles.equalizerPresetRow}>
            <label
              className={styles.equalizerPresetLabel}
              htmlFor="equalizer-preset"
            >
              {t("settings.audio.preset")}
            </label>
            <Select
              value={presetValue || undefined}
              onValueChange={handlePreset}
            >
              <SelectTrigger id="equalizer-preset">
                <SelectValue placeholder={t("settings.audio.presetCustom")} />
              </SelectTrigger>
              <SelectContent>
                {EQUALIZER_PRESETS.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.equalizerGraphFrame} ref={containerRef}>
            {size.width > 0 && (
              <FrequencyResponseGraph
                width={size.width}
                height={GRAPH_HEIGHT}
                scale={{
                  minFreq: MIN_FREQUENCY_HZ,
                  maxFreq: MAX_FREQUENCY_HZ,
                  minGain: MIN_GAIN_DB,
                  maxGain: MAX_GAIN_DB,
                  octaveTicks: 0,
                  octaveLabels: [],
                }}
                theme={GRAPH_THEME}
                ariaLabel={t("settings.audio.equalizerGraphLabel")}
                className={styles.equalizerGraph}
              >
                <EqualizerGraphGrid
                  minFreq={MIN_FREQUENCY_HZ}
                  maxFreq={MAX_FREQUENCY_HZ}
                />
                <FilterGradient
                  id={CURVE_GRADIENT_ID}
                  color="var(--themecolor)"
                />
                <CompositeCurve
                  filters={filters}
                  gradientId={CURVE_GRADIENT_ID}
                  color="var(--themecolor)"
                />
                {equalizer.bands.map((band, index) => (
                  <FilterPoint
                    key={`${band.type}-${index}`}
                    filter={bandToGraphFilter(band)}
                    index={index}
                    label={formatFrequency(band.frequency)}
                    onChange={handleBandChange(index)}
                    onEnter={() => setActiveIndex(index)}
                    onLeave={() => setActiveIndex(null)}
                    onDrag={(dragging) => {
                      if (dragging) setActiveIndex(index);
                    }}
                  />
                ))}
              </FrequencyResponseGraph>
            )}
          </div>

          <p className={styles.equalizerReadout} aria-live="polite">
            {activeBand ? (
              <>
                <span className={styles.equalizerReadoutLabel}>
                  {formatFrequency(activeBand.frequency)}
                </span>
                <span className={styles.equalizerReadoutValue}>
                  {formatGain(activeBand.gainDb)}
                </span>
                <span className={styles.equalizerReadoutMeta}>
                  {t("settings.audio.bandQ", { q: activeBand.q.toFixed(1) })}
                </span>
              </>
            ) : (
              <span className={styles.equalizerReadoutMeta}>
                {t("settings.audio.bandSummary", { count: BAND_COUNT })}
              </span>
            )}
          </p>

          <p className={styles.equalizerHint}>
            {t("settings.audio.equalizerHint")}
          </p>
        </>
      )}
    </div>
  );
};
