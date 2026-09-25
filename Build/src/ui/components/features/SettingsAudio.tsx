import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Slider } from "../primitives/Slider";
import { Switch } from "../primitives/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/Select";
import { Icon } from "../shared/Icon";
import { isSafari } from "../../../platform/utils/safari";
import type { Equalizer } from "../../../platform/audio/equalizer";
import styles from "./Settings.module.css";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

interface SettingsAudioProps {
  komorebi: UseKomorebiReturn;
}

interface EqualizerControlsProps {
  equalizer: Equalizer;
  onSetEnabled: (enabled: boolean) => void;
}

function EqualizerControls({
  equalizer,
  onSetEnabled,
}: EqualizerControlsProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(equalizer.isEnabled());
  const [gains, setGains] = useState<number[]>(() => equalizer.getGains());
  const [activePreset, setActivePreset] = useState<string>("Flat");

  const frequencies = useMemo(() => equalizer.getFrequencies(), [equalizer]);
  const presets = useMemo(() => equalizer.getPresets(), [equalizer]);

  const handleToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked);
      onSetEnabled(checked);
    },
    [onSetEnabled],
  );

  const handlePreset = useCallback(
    (name: string) => {
      setActivePreset(name);
      const preset = presets.find((candidate) => candidate.name === name);
      if (preset) {
        equalizer.setPreset(preset);
        setGains(equalizer.getGains());
      }
    },
    [presets, equalizer],
  );

  const handleBandGain = useCallback(
    (index: number) => (value: number[]) => {
      equalizer.setGain(index, value[0] ?? 0);
      setGains(equalizer.getGains());
    },
    [equalizer],
  );

  return (
    <div className={styles.equalizerControls}>
      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="equalizer-enabled">
            {t("settings.audio.enableEqualizer")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.audio.enableEqualizerDesc")}
          </p>
        </div>
        <Switch
          id="equalizer-enabled"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && (
        <>
          <div className={styles.settingItem}>
            <div className={styles.settingLabel}>
              <label htmlFor="equalizer-preset">
                {t("settings.audio.preset")}
              </label>
            </div>
            <Select value={activePreset} onValueChange={handlePreset}>
              <SelectTrigger id="equalizer-preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={styles.equalizerBands}>
            {frequencies.map((frequency, index) => (
              <div
                key={`${frequency}-${index}`}
                className={styles.equalizerBand}
              >
                <span className={styles.equalizerFrequency}>
                  {frequency >= 1000 ? `${frequency / 1000}k` : frequency} Hz
                </span>
                <Slider
                  aria-label={t("settings.audio.band", { frequency })}
                  value={[gains[index] ?? 0]}
                  onValueChange={handleBandGain(index)}
                  min={-12}
                  max={12}
                  step={1}
                  className={styles.equalizerSlider}
                />
                <span className={styles.settingValue}>
                  {gains[index] && gains[index]! > 0
                    ? `+${gains[index]}`
                    : (gains[index] ?? 0)}
                  dB
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function SettingsAudio({ komorebi }: SettingsAudioProps) {
  const { t } = useTranslation();
  const isOnSafari = isSafari();

  const equalizer = komorebi.getEqualizer();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon
          name="volume2"
          className={styles.sectionIcon}
          size="1.25rem"
          decorative
        />
        <h3 className={styles.sectionTitle}>{t("settings.audio.title")}</h3>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="tempo-slider">{t("settings.playback.tempo")}</label>
          <span className={styles.settingValue}>
            {Math.round(komorebi.tempo * 100)}%
          </span>
        </div>
        <Slider
          id="tempo-slider"
          value={[komorebi.tempo * 100]}
          onValueChange={(val) => {
            let newVal = val[0] ?? 100;
            if (Math.abs(newVal - 100) <= 3) newVal = 100;
            komorebi.setPlaybackRate(newVal / 100);
          }}
          min={50}
          max={150}
          step={1}
          className={styles.slider}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="pitch-slider">{t("settings.playback.pitch")}</label>
          <span className={styles.settingValue}>
            {komorebi.pitch === 0
              ? "0"
              : komorebi.pitch > 0
                ? `+${komorebi.pitch}`
                : komorebi.pitch}
          </span>
        </div>
        <Slider
          id="pitch-slider"
          value={[komorebi.pitch]}
          onValueChange={(val) => {
            let newVal = val[0] ?? 0;
            if (Math.abs(newVal) <= 0.5) newVal = 0;
            komorebi.setPitch(newVal);
          }}
          min={-48}
          max={48}
          step={1}
          className={styles.slider}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="volume-slider">{t("player.volume")}</label>
          <span className={styles.settingValue}>
            {Math.round(komorebi.volume * 100)}%
          </span>
        </div>
        <Slider
          id="volume-slider"
          value={[Math.round(komorebi.volume * 100)]}
          onValueChange={(val) => komorebi.setVolume((val[0] ?? 0) / 100)}
          max={100}
          step={1}
          className={styles.slider}
        />
      </div>

      {equalizer && (
        <EqualizerControls
          equalizer={equalizer}
          onSetEnabled={komorebi.setEqualizerEnabled}
        />
      )}

      {!isOnSafari && (
        <>
          <div className={styles.settingItem}>
            <div className={styles.settingLabel}>
              <label htmlFor="crossfade-slider">
                {t("settings.audio.crossfade")}
                {komorebi.gapless && (
                  <span className={styles.settingDescription}>
                    {" "}
                    ({t("settings.audio.crossfadeDisabled")})
                  </span>
                )}
              </label>
              <span className={styles.settingValue}>
                {komorebi.gapless ? "0s" : `${komorebi.crossfade}s`}
              </span>
            </div>
            <Slider
              id="crossfade-slider"
              value={komorebi.gapless ? [0] : [komorebi.crossfade]}
              onValueChange={(val) => {
                if (!komorebi.gapless) {
                  komorebi.setCrossfade(val[0] ?? 0);
                }
              }}
              max={10}
              step={1}
              className={styles.slider}
              disabled={komorebi.gapless}
            />
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="gapless-playback">
                {t("settings.playback.gapless")}
              </label>
              <p className={styles.settingDescription}>
                {t("settings.playback.gaplessDesc")}
              </p>
            </div>
            <Switch
              id="gapless-playback"
              checked={komorebi.gapless}
              onCheckedChange={(val) => {
                if (val) {
                  komorebi.setGapless(true);
                  komorebi.setCrossfade(0);
                } else {
                  komorebi.setGapless(false);
                  komorebi.setCrossfade(3);
                }
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
