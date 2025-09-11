import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./Sheet";
import { Button } from "./Button";
import { Switch } from "./Switch";
import { Slider } from "./Slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import { Volume2, Music, Palette, RotateCcw } from "lucide-react";
import styles from "./Settings.module.css";
import { useThemeLoader } from "../helpers/themeLoader";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { languageNames } from "../../public/locales/supportedLanguages";

export type PlayerSettings = {
  volume: number;
  crossfade: number;
  defaultShuffle: boolean;
  defaultRepeat: "off" | "one" | "all";
  themeMode: "light" | "dark" | "auto";
  colorTheme: string;
  autoPlayNext: boolean;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
  lastPlayedSongId?: string;
  lastPlayedPlaylistId?: string;
  language: string;
  tempo: number;
};

export interface SettingsProps {
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
}

export const Settings = ({
  className,
  open,
  onOpenChange,
  settings,
  onSettingsChange,
}: SettingsProps) => {
  const { t, i18n } = useTranslation();

  const volume = [Math.round(settings.volume * 100)];
  const crossfade = [settings.crossfade];
  const defaultShuffle = settings.defaultShuffle;
  const defaultRepeat = settings.defaultRepeat;
  const autoPlayNext = settings.autoPlayNext;
  const compactMode = settings.compactMode;
  const showAlbumArt = settings.showAlbumArt;
  const showLyrics = settings.showLyrics;

  const { themes, currentTheme, setTheme } = useThemeLoader();

  const handleResetSettings = async () => {
    const defaultThemeName = "Blue";
    try {
      await setTheme(defaultThemeName);
      onSettingsChange({
        volume: 0.75,
        crossfade: 3,
        defaultShuffle: false,
        defaultRepeat: "off",
        autoPlayNext: true,
        compactMode: false,
        showAlbumArt: true,
        showLyrics: false,
        colorTheme: defaultThemeName,
        language: "English",
        tempo: 1
      });
    } catch {
      toast.error(t("settings.resetError"));
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    onSettingsChange({ volume: newVolume[0] / 100 });
  };

  const handleCrossfadeChange = (newCrossfade: number[]) => {
    onSettingsChange({ crossfade: newCrossfade[0] });
  };

  // Get supported languages dynamically from i18next config
  let languages: string[] = [];

  // Only use filter if supportedLngs is an array
  if (Array.isArray(i18n.options.supportedLngs)) {
    languages = i18n.options.supportedLngs.filter(l => l !== 'cimode');
  }

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    toast.success(`Language set to ${languageNames[lang] || lang}`);
  };


  return (
    <div className={`${styles.container} ${className || ""}`}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className={styles.sheetContent}>
          <SheetHeader>
            <SheetTitle>{t("settings.title")}</SheetTitle>
            <SheetDescription>{t("settings.description")}</SheetDescription>
          </SheetHeader>

          <div className={styles.settingsContent}>
            {/* Audio Settings */}
            <section className={styles.section}>

              <div className={styles.sectionHeader}>
                <Volume2 className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>{t("settings.audio.title")}</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="tempo-slider">{t("settings.playback.tempo")}</label>
                  <span className={styles.settingValue}>{Math.round(settings.tempo * 100)}%</span>
                </div>
                <Slider
                  id="tempo-slider"
                  value={[settings.tempo * 100]}
                  onValueChange={(val) => {
                    let newVal = val[0];

                    // Snap to 100 if within ±3%
                    if (Math.abs(newVal - 100) <= 3) {
                      newVal = 100;
                    }

                    onSettingsChange({ tempo: newVal / 100 });
                  }}
                  min={50}
                  max={150}
                  step={1}
                  className={styles.slider}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="volume-slider">{t("player.volume")}</label>
                  <span className={styles.settingValue}>{volume[0]}%</span>
                </div>
                <Slider
                  id="volume-slider"
                  value={volume}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className={styles.slider}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="crossfade-slider">{t("settings.audio.crossfade")}</label>
                  <span className={styles.settingValue}>{crossfade[0]}s</span>
                </div>
                <Slider
                  id="crossfade-slider"
                  value={crossfade}
                  onValueChange={handleCrossfadeChange}
                  max={10}
                  step={1}
                  className={styles.slider}
                />
              </div>
            </section>

            {/* Playback Settings */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Music className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>{t("settings.playback.title")}</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="default-shuffle">{t("settings.playback.shuffle")}</label>
                  <p className={styles.settingDescription}>
                    {t("settings.playback.shuffleDesc")}
                  </p>
                </div>
                <Switch
                  id="default-shuffle"
                  checked={defaultShuffle}
                  onCheckedChange={(val) => onSettingsChange({ defaultShuffle: val })}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="default-repeat">{t("settings.playback.repeat")}</label>
                </div>
                <Select
                  value={defaultRepeat}
                  onValueChange={(val) =>
                    onSettingsChange({ defaultRepeat: val as PlayerSettings["defaultRepeat"] })
                  }
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
                  <label htmlFor="auto-play-next">{t("settings.playback.autoPlay")}</label>
                  <p className={styles.settingDescription}>
                    {t("settings.playback.autoPlayDesc")}
                  </p>
                </div>
                <Switch
                  id="auto-play-next"
                  checked={autoPlayNext}
                  onCheckedChange={(val) => onSettingsChange({ autoPlayNext: val })}
                />
              </div>
            </section>

            {/* Interface Settings */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Palette className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>{t("settings.interface.title")}</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="color-theme">{t("settings.interface.colorTheme")}</label>
                </div>
                <Select
                  value={currentTheme?.name || settings.colorTheme}
                  onValueChange={async (val) => {
                    try {
                      await setTheme(val);
                      onSettingsChange({ colorTheme: val });
                    } catch {
                      toast.error(t("settings.themeError"));
                    }
                  }}
                >
                  <SelectTrigger id="color-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((theme) => (
                      <SelectItem key={theme.name} value={theme.name}>
                        {theme.name}
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
                  value={settings.themeMode}
                  onChange={(val) =>
                    onSettingsChange({ themeMode: val as PlayerSettings["themeMode"] })
                  }
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="compact-mode">{t("settings.interface.compact")}</label>
                  <p className={styles.settingDescription}>
                    {t("settings.interface.compactDesc")}
                  </p>
                </div>
                <Switch
                  id="compact-mode"
                  checked={compactMode}
                  onCheckedChange={(val) => onSettingsChange({ compactMode: val })}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="show-album-art">{t("settings.interface.albumArt")}</label>
                  <p className={styles.settingDescription}>
                    {t("settings.interface.albumArtDesc")}
                  </p>
                </div>
                <Switch
                  id="show-album-art"
                  checked={showAlbumArt}
                  onCheckedChange={(val) => onSettingsChange({ showAlbumArt: val })}
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
                  checked={showLyrics}
                  onCheckedChange={(val) => onSettingsChange({ showLyrics: val })}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="language-selector">{t("settings.interface.language")}</label>
                  <p className={styles.settingDescription}>
                    {t("settings.interface.languageDescription")}
                  </p>
                </div>
                <Select
                  value={i18n.language}
                  onValueChange={handleLanguageChange}
                >
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
            </section>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={handleResetSettings}
              className={styles.resetButton}
            >
              <RotateCcw size={16} />
              {t("settings.reset")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
