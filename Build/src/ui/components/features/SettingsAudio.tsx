import { useTranslation } from "react-i18next";
import { Slider } from "../primitives/Slider";
import { Switch } from "../primitives/Switch";
import { Icon } from "../shared/Icon";
import { EqualizerPanel } from "./EqualizerPanel";
import { isSafari } from "../../../platform/utils/safari";
import styles from "./Settings.module.css";
import { MAX_CROSSFADE_SECONDS } from "../../../platform/audio/clamp";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

interface SettingsAudioProps {
  komorebi: UseKomorebiReturn;
}

export function SettingsAudio({ komorebi }: SettingsAudioProps) {
  const { t } = useTranslation();
  const isOnSafari = isSafari();

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

      <EqualizerPanel />

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
              max={MAX_CROSSFADE_SECONDS}
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
