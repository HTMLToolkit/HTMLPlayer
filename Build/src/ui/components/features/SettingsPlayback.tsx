import { useTranslation } from "react-i18next";
import { Switch } from "../primitives/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/Select";
import { Icon } from "../shared/Icon";
import styles from "./Settings.module.css";
import type { RepeatMode } from "../../../core/engine/types";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

interface SettingsPlaybackProps {
  komorebi: UseKomorebiReturn;
}

export function SettingsPlayback({ komorebi }: SettingsPlaybackProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon
          name="music"
          className={styles.sectionIcon}
          size="1.25rem"
          decorative
        />
        <h3 className={styles.sectionTitle}>{t("settings.playback.title")}</h3>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="default-shuffle">
            {t("settings.playback.shuffle")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.playback.shuffleDesc")}
          </p>
        </div>
        <Switch
          id="default-shuffle"
          checked={komorebi.shuffle}
          onCheckedChange={(val) => komorebi.setShuffle(val)}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="smart-shuffle">
            {t("settings.playback.smartShuffle")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.playback.smartShuffleDesc")}
          </p>
        </div>
        <Switch
          id="smart-shuffle"
          checked={komorebi.smartShuffle}
          onCheckedChange={(val) =>
            komorebi.setShuffleMode(val ? "smart" : "random")
          }
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="default-repeat">
            {t("settings.playback.repeat")}
          </label>
        </div>
        <Select
          value={komorebi.repeat}
          onValueChange={(val) => komorebi.setRepeat(val as RepeatMode)}
        >
          <SelectTrigger id="default-repeat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">{t("player.repeatOff")}</SelectItem>
            <SelectItem value="one">{t("player.repeatTrack")}</SelectItem>
            <SelectItem value="all">{t("player.repeatAll")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="auto-play-next">
            {t("settings.playback.autoPlay")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.playback.autoPlayDesc")}
          </p>
        </div>
        <Switch
          id="auto-play-next"
          checked={komorebi.autoPlayNext}
          onCheckedChange={(val) => komorebi.setAutoPlayNext(val)}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="session-restore">
            {t("settings.playback.sessionRestore")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.playback.sessionRestoreDesc")}
          </p>
        </div>
        <Switch
          id="session-restore"
          checked={komorebi.settings.getSettings().sessionRestore}
          onCheckedChange={(val) => komorebi.settings.setSessionRestore(val)}
        />
      </div>
    </section>
  );
}
