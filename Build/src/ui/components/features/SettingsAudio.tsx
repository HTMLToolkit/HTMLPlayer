import { useTranslation } from "react-i18next";
import { Slider } from "../primitives/Slider";
import { Switch } from "../primitives/Switch";
import { Icon } from "../shared/Icon";
import { isSafari } from "../../../platform/utils/safari";
import styles from "./Settings.module.css";
import type { SettingsManager } from "../../../platform/settings/settings";

interface SettingsAudioProps {
  settings: SettingsManager;
  settingsState: ReturnType<SettingsManager["getSettings"]>;
}

export function SettingsAudio({ settings, settingsState }: SettingsAudioProps) {
  const { t } = useTranslation();
  const isOnSafari = isSafari();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon name="volume2" className={styles.sectionIcon} size="1.25rem" decorative />
        <h3 className={styles.sectionTitle}>{t("settings.audio.title")}</h3>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="tempo-slider">{t("settings.playback.tempo")}</label>
          <span className={styles.settingValue}>
            {Math.round(settingsState.tempo * 100)}%
          </span>
        </div>
        <Slider
          id="tempo-slider"
          value={[settingsState.tempo * 100]}
          onValueChange={(val) => {
            let newVal = val[0];
            if (Math.abs(newVal - 100) <= 3) newVal = 100;
            settings.setTempo(newVal / 100);
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
            {settingsState.pitch === 0
              ? "0"
              : settingsState.pitch > 0
                ? `+${settingsState.pitch}`
                : settingsState.pitch}
          </span>
        </div>
        <Slider
          id="pitch-slider"
          value={[settingsState.pitch ?? 0]}
          onValueChange={(val) => {
            let newVal = val[0];
            if (Math.abs(newVal) <= 0.5) newVal = 0;
            settings.setPitch(newVal);
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
            {Math.round(settingsState.volume * 100)}%
          </span>
        </div>
        <Slider
          id="volume-slider"
          value={[Math.round(settingsState.volume * 100)]}
          onValueChange={(val) => settings.setVolume(val[0] / 100)}
          max={100}
          step={1}
          className={styles.slider}
        />
      </div>

      {!isOnSafari && (
        <>
          <div className={styles.settingItem}>
            <div className={styles.settingLabel}>
              <label htmlFor="crossfade-slider">
                {t("settings.audio.crossfade")}
                {settingsState.gaplessPlayback && (
                  <span className={styles.settingDescription}>
                    {" "}({t("settings.audio.crossfadeDisabled")})
                  </span>
                )}
              </label>
              <span className={styles.settingValue}>
                {settingsState.gaplessPlayback ? "0s" : `${settingsState.crossfade}s`}
              </span>
            </div>
            <Slider
              id="crossfade-slider"
              value={settingsState.gaplessPlayback ? [0] : [settingsState.crossfade]}
              onValueChange={(val) => {
                if (!settingsState.gaplessPlayback) {
                  settings.setCrossfade(val[0]);
                }
              }}
              max={10}
              step={1}
              className={styles.slider}
              disabled={settingsState.gaplessPlayback}
            />
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label htmlFor="gapless-playback">{t("settings.playback.gapless")}</label>
              <p className={styles.settingDescription}>{t("settings.playback.gaplessDesc")}</p>
            </div>
            <Switch
              id="gapless-playback"
              checked={settingsState.gaplessPlayback}
              onCheckedChange={(val) => {
                if (val) {
                  settings.setGaplessPlayback(true);
                  settings.setCrossfade(0);
                } else {
                  settings.setGaplessPlayback(false);
                  settings.setCrossfade(3);
                }
              }}
            />
          </div>
        </>
      )}
    </section>
  );
}
