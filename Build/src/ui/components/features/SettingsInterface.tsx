import { useTranslation } from "react-i18next";
import { Switch } from "../primitives/Switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/Select";
import { Button } from "../primitives/Button";
import { ThemeModeSwitch } from "../shared/ThemeModeSwitch";
import { Icon } from "../shared/Icon";
import { usePalette, useIconSet, useWallpaper } from "../../theming/hooks";
import { languageNames } from "../../../types/supportedLanguages";
import { clearAllCaches } from "../../../platform/storage";
import { toast } from "sonner";
import { useState } from "react";
import { ResetDialogsDialog } from "../primitives/ResetDialogsDialog";
import styles from "./Settings.module.css";
import type { SettingsManager } from "../../../platform/settings/settings";

interface SettingsInterfaceProps {
  settings: SettingsManager;
  settingsState: ReturnType<SettingsManager["getSettings"]>;
}

export function SettingsInterface({
  settings,
  settingsState,
}: SettingsInterfaceProps) {
  const { t, i18n } = useTranslation();
  const { palettes, currentPalette, setPalette } = usePalette();
  const { iconSets, currentIconSet, setIconSet } = useIconSet();
  const { wallpapers, setWallpaper } = useWallpaper();

  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  let languages: string[] = [];
  if (Array.isArray(i18n.options.supportedLngs)) {
    languages = i18n.options.supportedLngs.filter((l) => l !== "cimode");
  }

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    toast.success(
      t("settings.interface.languageSet", {
        language: languageNames[lang] || lang,
      }),
    );
  };

  const handleClearCache = async () => {
    try {
      await clearAllCaches();
      if (i18n.services.resourceStore) {
        Object.keys(i18n.services.resourceStore.data).forEach((lang) => {
          i18n.services.resourceStore.data[lang] = {};
        });
      }
      await i18n.reloadResources();
      toast.success(t("settings.cacheClearedSuccess"));
    } catch {
      toast.error(t("settings.cacheClearedError"));
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon
          name="palette"
          className={styles.sectionIcon}
          size="1.25rem"
          decorative
        />
        <h3 className={styles.sectionTitle}>{t("settings.interface.title")}</h3>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="color-theme">
            {t("settings.interface.colorTheme")}
          </label>
        </div>
        <Select
          value={currentPalette?.name || settingsState.colorTheme}
          onValueChange={async (val) => {
            try {
              await setPalette(val);
              settings.setColorTheme(val);
            } catch {
              toast.error(t("settings.themeError"));
            }
          }}
        >
          <SelectTrigger id="color-theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {palettes.map((palette) => (
              <SelectItem key={palette.name} value={palette.name}>
                {palette.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="icon-set">{t("settings.interface.iconSet")}</label>
          <p className={styles.settingDescription}>
            {t("settings.interface.iconSetDesc")}
          </p>
        </div>
        <Select
          value={currentIconSet?.id || "lucide"}
          onValueChange={(val) => {
            try {
              setIconSet(val);
              toast.success(t("settings.interface.iconSetChanged"));
            } catch {
              toast.error(t("settings.interface.iconSetError"));
            }
          }}
        >
          <SelectTrigger id="icon-set">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {iconSets.map((iconSet) => (
              <SelectItem key={iconSet.id} value={iconSet.id}>
                {iconSet.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="wallpaper">{t("settings.interface.wallpaper")}</label>
          <p className={styles.settingDescription}>
            {t("settings.interface.wallpaperDesc")}
          </p>
        </div>
        <Select
          value={settingsState.wallpaper || "None"}
          onValueChange={async (val) => {
            try {
              await setWallpaper(val);
              settings.setWallpaper(val === "None" ? "None" : val);
            } catch {
              toast.error(t("settings.interface.wallpaperError"));
            }
          }}
        >
          <SelectTrigger id="wallpaper">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">
              {t("settings.interface.wallpaperNone", "None")}
            </SelectItem>
            {wallpapers?.map((wallpaper) => (
              <SelectItem key={wallpaper.name} value={wallpaper.name}>
                {wallpaper.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label>{t("settings.interface.themeMode")}</label>
          <p className={styles.settingDescription}>
            {t("settings.interface.themeModeDesc")}
          </p>
        </div>
        <ThemeModeSwitch
          value={settingsState.themeMode}
          onChange={(val) => settings.setThemeMode(val as any)}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="compact-mode">
            {t("settings.interface.compact")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.interface.compactDesc")}
          </p>
        </div>
        <Switch
          id="compact-mode"
          checked={settingsState.compactMode}
          onCheckedChange={settings.setCompactMode}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="show-album-art">
            {t("settings.interface.albumArt")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.interface.albumArtDesc")}
          </p>
        </div>
        <Switch
          id="show-album-art"
          checked={settingsState.showAlbumArt}
          onCheckedChange={settings.setShowAlbumArt}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="show-lyrics">{t("settings.interface.lyrics")}</label>
          <p className={styles.settingDescription}>
            {t("settings.interface.lyricsDesc")}
          </p>
        </div>
        <Switch
          id="show-lyrics"
          checked={settingsState.showLyrics}
          onCheckedChange={settings.setShowLyrics}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingLabel}>
          <label htmlFor="language-selector">
            {t("settings.interface.language")}
          </label>
          <p className={styles.settingDescription}>
            {t("settings.interface.languageDescription")}
          </p>
        </div>
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
          <SelectTrigger id="language-selector">
            <SelectValue>
              {languageNames[i18n.language] || i18n.language.toUpperCase()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {languageNames[lang] || lang.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label>{t("settings.interface.clearCache")}</label>
          <p className={styles.settingDescription}>
            {t("settings.interface.clearCacheDesc")}
          </p>
        </div>
        <Button variant="outline" onClick={handleClearCache} size="sm">
          <Icon name="trash2" size={16} decorative />
          {t("settings.interface.clearCacheButton")}
        </Button>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label>{t("settings.resetDialogs")}</label>
          <p className={styles.settingDescription}>
            {t("settings.resetDialogsDescription")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetDialogOpen(true)}
        >
          <Icon name="rotateCcw" size={16} decorative />
          {t("settings.resetDialogsButton")}
        </Button>
        <ResetDialogsDialog
          open={resetDialogOpen}
          onOpenChange={setResetDialogOpen}
        />
      </div>
    </section>
  );
}
