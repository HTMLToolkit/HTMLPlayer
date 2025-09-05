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
  // Convert volume to percentage for display
  const volume = [Math.round(settings.volume * 100)];
  const crossfade = [settings.crossfade];
  const defaultShuffle = settings.defaultShuffle;
  const defaultRepeat = settings.defaultRepeat;
  const autoPlayNext = settings.autoPlayNext;
  const compactMode = settings.compactMode;
  const showAlbumArt = settings.showAlbumArt;
  const showLyrics = settings.showLyrics;

  // Theme loader
  const { themes, currentTheme, setTheme } = useThemeLoader();

  // Handlers
  const handleResetSettings = async () => {
    const defaultThemeName = "Blue";
    try {
      await setTheme(defaultThemeName); // ensure theme is applied first
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
      });
    } catch {
      toast.error("Error resetting settings.")
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    onSettingsChange({ volume: newVolume[0] / 100 });
  };

  const handleCrossfadeChange = (newCrossfade: number[]) => {
    onSettingsChange({ crossfade: newCrossfade[0] });
  };

  const handleShuffleChange = (shuffle: boolean) => {
    onSettingsChange({ defaultShuffle: shuffle });
  };

  const handleRepeatChange = (repeat: string) => {
    onSettingsChange({
      defaultRepeat: repeat as PlayerSettings["defaultRepeat"],
    });
  };

  const handleAutoPlayChange = (autoPlay: boolean) => {
    onSettingsChange({ autoPlayNext: autoPlay });
  };

  const handleCompactModeChange = (compact: boolean) => {
    onSettingsChange({ compactMode: compact });
  };

  const handleShowAlbumArtChange = (show: boolean) => {
    onSettingsChange({ showAlbumArt: show });
  };

  const handleShowLyricsChange = (show: boolean) => {
    onSettingsChange({ showLyrics: show });
  };

  const handleThemeModeChange = (mode: string) => {
    onSettingsChange({ themeMode: mode as PlayerSettings["themeMode"] });
  };

  const handleColorThemeChange = async (themeName: string) => {
    try {
      await setTheme(themeName); // wait for CSS to load
      onSettingsChange({ colorTheme: themeName }); // now update settings
    } catch {
      toast.error("Theme load error!",)
    }
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className={styles.sheetContent}>
          <SheetHeader>
            <SheetTitle>Settings</SheetTitle>
            <SheetDescription>
              Customize your music player experience and preferences.
            </SheetDescription>
          </SheetHeader>

          <div className={styles.settingsContent}>
            {/* Audio Settings */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Volume2 className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Audio Settings</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="volume-slider">Volume</label>
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
                  <label htmlFor="crossfade-slider">Crossfade</label>
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
                <h3 className={styles.sectionTitle}>Playback Settings</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="default-shuffle">Default Shuffle Mode</label>
                  <p className={styles.settingDescription}>
                    Enable shuffle by default when starting playback
                  </p>
                </div>
                <Switch
                  id="default-shuffle"
                  checked={defaultShuffle}
                  onCheckedChange={handleShuffleChange}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="default-repeat">Default Repeat Mode</label>
                </div>
                <Select
                  value={defaultRepeat}
                  onValueChange={handleRepeatChange}
                >
                  <SelectTrigger id="default-repeat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="one">Repeat One</SelectItem>
                    <SelectItem value="all">Repeat All</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="auto-play-next">Auto-play Next Song</label>
                  <p className={styles.settingDescription}>
                    Automatically play the next song when current song ends
                  </p>
                </div>
                <Switch
                  id="auto-play-next"
                  checked={autoPlayNext}
                  onCheckedChange={handleAutoPlayChange}
                />
              </div>
            </section>

            {/* Interface Settings */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Palette className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Interface Settings</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="color-theme">Color Theme</label>
                </div>
                <Select
                  value={currentTheme?.name || settings.colorTheme}
                  onValueChange={handleColorThemeChange}
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
                  <label>Theme Mode</label>
                  <p className={styles.settingDescription}>
                    Choose your preferred theme mode
                  </p>
                </div>
                <ThemeModeSwitch
                  value={settings.themeMode}
                  onChange={handleThemeModeChange}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="compact-mode">Compact Mode</label>
                  <p className={styles.settingDescription}>
                    Use a more compact layout to fit more content
                  </p>
                </div>
                <Switch
                  id="compact-mode"
                  checked={compactMode}
                  onCheckedChange={handleCompactModeChange}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="show-album-art">Show Album Art</label>
                  <p className={styles.settingDescription}>
                    Display album artwork in the player interface
                  </p>
                </div>
                <Switch
                  id="show-album-art"
                  checked={showAlbumArt}
                  onCheckedChange={handleShowAlbumArtChange}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="show-lyrics">Show Lyrics</label>
                  <p className={styles.settingDescription}>
                    Display song lyrics when available
                  </p>
                </div>
                <Switch
                  id="show-lyrics"
                  checked={showLyrics}
                  onCheckedChange={handleShowLyricsChange}
                />
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
              Reset to Defaults
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
