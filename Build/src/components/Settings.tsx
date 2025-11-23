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
import { Input } from "./Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./Select";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import { ShortcutConfig } from "./ShortcutConfig";
import styles from "./Settings.module.css";
import { useThemeLoader } from "../helpers/themeLoader";
import { useIconRegistry } from "../helpers/iconLoader";
import { useWallpaperLoader } from "../helpers/wallpaperLoader";
import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { languageNames } from "../../public/locales/supportedLanguages";
import { isSafari } from "../helpers/safariHelper";
import { Icon } from "./Icon";

import { resetAllDialogPreferences } from "../helpers/musicIndexedDbHelper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

export interface SettingsProps {
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  settings: PlayerSettings;
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  onShortcutsChanged?: () => void;
}

export const Settings = ({
  className,
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onShortcutsChanged,
}: SettingsProps) => {
  const { t, i18n } = useTranslation();

  // State for dialog reset button
  const [dialogResetOpen, setDialogResetOpen] = useState(false);
  const [dialogResetLoading, setDialogResetLoading] = useState(false);

  const handleDialogResetClose = () => setDialogResetOpen(false);

  // Use the persisted crossfadeBeforeGapless value, fallback to current crossfade
  const previousCrossfadeRef = useRef<number>(
    settings.crossfadeBeforeGapless ?? settings.crossfade,
  );

  const { themes, currentTheme, setTheme } = useThemeLoader();
  const { iconSets, currentSet, setIconSet } = useIconRegistry();
  const { wallpapers, setWallpaper } = useWallpaperLoader();

  // Check if running on Safari
  const isOnSafari = isSafari();

  // Initialize Eruda if it was previously enabled
  useEffect(() => {
    if (settings.erudaEnabled && !(window as any).eruda) {
      loadEruda().catch(console.error);
    }
  }, [settings.erudaEnabled]);

  const handleResetSettings = async () => {
    const defaultThemeName = "Blue";
    try {
      await setTheme(defaultThemeName);
      onSettingsChange({
        volume: 0.75,
        crossfade: 3,
        crossfadeBeforeGapless: undefined,
        defaultShuffle: false,
        defaultRepeat: "off",
        autoPlayNext: true,
        compactMode: false,
        showAlbumArt: true,
        showLyrics: false,
        sessionRestore: true,
        gaplessPlayback: false,
        smartShuffle: true,
        colorTheme: defaultThemeName,
        wallpaper: "None",
        language: "English",
        tempo: 1,
        pitch: 0,
        discordEnabled: false,
        discordUserId: undefined,
        erudaEnabled: false,
      });
    } catch {
      toast.error(t("settings.resetError"));
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    onSettingsChange({ volume: newVolume[0] / 100 });
  };

  const handleCrossfadeChange = (newCrossfade: number[]) => {
    // Prevent crossfade changes when gapless playback is enabled
    if (settings.gaplessPlayback) {
      return;
    }
    const newValue = newCrossfade[0];
    previousCrossfadeRef.current = newValue; // Update stored value
    onSettingsChange({
      crossfade: newValue,
      crossfadeBeforeGapless: undefined, // Clear stored value when manually changed
    });
  };

  // Get supported languages dynamically from i18next config
  let languages: string[] = [];

  // Only use filter if supportedLngs is an array
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
      // Clear all cache storage (service worker caches)
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName)),
        );
      }

      // Clear i18n resource cache
      if (i18n.services.resourceStore) {
        Object.keys(i18n.services.resourceStore.data).forEach((lang) => {
          i18n.services.resourceStore.data[lang] = {};
        });
      }

      // Reload i18n resources
      await i18n.reloadResources();

      toast.success(t("settings.cacheClearedSuccess"));
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error(t("settings.cacheClearedError"));
    }
  };

  // Dynamic Eruda loading/unloading functions
  const loadEruda = () => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).eruda) {
        // Already loaded
        (window as any).eruda.init();
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.integrity =
        "sha384-F7xQBvh3l6dG/mMD6QPIeVmXtzWT4Ce3ZDu8ysPuzMWMx9bFOIMGnRPUhLuQipss";
      script.crossOrigin = "anonymous";
      script.onload = () => {
        try {
          (window as any).eruda.init();
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const unloadEruda = () => {
    if ((window as any).eruda) {
      try {
        (window as any).eruda.destroy();
        // Remove the script element
        const erudaScript = document.querySelector('script[src*="eruda"]');
        if (erudaScript) {
          erudaScript.remove();
        }
        // Clean up global reference
        delete (window as any).eruda;
      } catch (error) {
        console.warn("Failed to unload Eruda:", error);
      }
    }
  };

  // TODO: i18n-ize
  const handleErudaToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await loadEruda();
        toast.success("Eruda debug console enabled");
      } else {
        unloadEruda();
        toast.success("Eruda debug console disabled");
      }
      onSettingsChange({ erudaEnabled: enabled });
    } catch (error) {
      console.error("Failed to toggle Eruda:", error);
      toast.error("Failed to toggle Eruda debug console");
    }
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
                <Icon
                  name="volume2"
                  className={styles.sectionIcon}
                  size="1.25rem"
                  decorative
                />
                <h3 className={styles.sectionTitle}>
                  {t("settings.audio.title")}
                </h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="tempo-slider">
                    {t("settings.playback.tempo")}
                  </label>
                  <span className={styles.settingValue}>
                    {Math.round(settings.tempo * 100)}%
                  </span>
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
                  <label htmlFor="pitch-slider">
                    {t("settings.playback.pitch")}
                  </label>
                  <span className={styles.settingValue}>
                    {(settings.pitch ?? 0) === 0
                      ? "0"
                      : (settings.pitch ?? 0) > 0
                        ? `+${settings.pitch ?? 0}`
                        : (settings.pitch ?? 0)}
                  </span>
                </div>
                <Slider
                  id="pitch-slider"
                  value={[settings.pitch ?? 0]}
                  onValueChange={(val) => {
                    let newVal = val[0];

                    // Snap to 0 if within ±0.5 semitones
                    if (Math.abs(newVal) <= 0.5) {
                      newVal = 0;
                    }

                    onSettingsChange({ pitch: newVal });
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
                    {Math.round(settings.volume * 100)}%
                  </span>
                </div>
                <Slider
                  id="volume-slider"
                  value={[Math.round(settings.volume * 100)]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={1}
                  className={styles.slider}
                />
              </div>

              {!isOnSafari && (
                <div className={styles.settingItem}>
                  <div className={styles.settingLabel}>
                    <label htmlFor="crossfade-slider">
                      {t("settings.audio.crossfade")}
                      {settings.gaplessPlayback && (
                        <span className={styles.settingDescription}>
                          {" "}
                          ({t("settings.audio.crossfadeDisabled")})
                        </span>
                      )}
                    </label>
                    <span className={styles.settingValue}>
                      {settings.gaplessPlayback
                        ? "0s"
                        : `${settings.crossfade}s`}
                    </span>
                  </div>
                  <Slider
                    id="crossfade-slider"
                    value={
                      settings.gaplessPlayback ? [0] : [settings.crossfade]
                    }
                    onValueChange={handleCrossfadeChange}
                    max={10}
                    step={1}
                    className={styles.slider}
                    disabled={settings.gaplessPlayback}
                  />
                </div>
              )}

              {!isOnSafari && (
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
                    checked={settings.gaplessPlayback}
                    onCheckedChange={(val) => {
                      if (val) {
                        // Store current crossfade value before setting to 0
                        const currentCrossfade = settings.crossfade;
                        previousCrossfadeRef.current = currentCrossfade;
                        onSettingsChange({
                          gaplessPlayback: val,
                          crossfade: 0,
                          crossfadeBeforeGapless: currentCrossfade,
                        });
                      } else {
                        // Restore previous crossfade value when disabling gapless
                        const restoreValue =
                          settings.crossfadeBeforeGapless ??
                          previousCrossfadeRef.current;
                        onSettingsChange({
                          gaplessPlayback: val,
                          crossfade: restoreValue,
                          crossfadeBeforeGapless: undefined, // Clear the stored value
                        });
                      }
                    }}
                  />
                </div>
              )}
            </section>

            {/* Playback Settings */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Icon
                  name="music"
                  className={styles.sectionIcon}
                  size="1.25rem"
                  decorative
                />
                <h3 className={styles.sectionTitle}>
                  {t("settings.playback.title")}
                </h3>
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
                  checked={settings.defaultShuffle}
                  onCheckedChange={(val) =>
                    onSettingsChange({ defaultShuffle: val })
                  }
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
                  checked={settings.smartShuffle}
                  onCheckedChange={(val) =>
                    onSettingsChange({ smartShuffle: val })
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
                  value={settings.defaultRepeat}
                  onValueChange={(val) =>
                    onSettingsChange({
                      defaultRepeat: val as PlayerSettings["defaultRepeat"],
                    })
                  }
                >
                  <SelectTrigger id="default-repeat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">{t("player.repeatOff")}</SelectItem>
                    <SelectItem value="one">
                      {t("player.repeatTrack")}
                    </SelectItem>
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
                  checked={settings.autoPlayNext}
                  onCheckedChange={(val) =>
                    onSettingsChange({ autoPlayNext: val })
                  }
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
                  checked={settings.sessionRestore}
                  onCheckedChange={(val) =>
                    onSettingsChange({ sessionRestore: val })
                  }
                />
              </div>
            </section>

            {/* Interface Settings */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Icon
                  name="palette"
                  className={styles.sectionIcon}
                  size="1.25rem"
                  decorative
                />
                <h3 className={styles.sectionTitle}>
                  {t("settings.interface.title")}
                </h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label htmlFor="color-theme">
                    {t("settings.interface.colorTheme")}
                  </label>
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
                <div className={styles.settingLabel}>
                  <label htmlFor="icon-set">
                    {t("settings.interface.iconSet")}
                  </label>
                  <p className={styles.settingDescription}>
                    {t("settings.interface.iconSetDesc")}
                  </p>
                </div>
                <Select
                  value={currentSet?.id || "blue"}
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
                  <label htmlFor="wallpaper">
                    {t("settings.interface.wallpaper")}
                  </label>
                  <p className={styles.settingDescription}>
                    {t("settings.interface.wallpaperDesc")}
                  </p>
                </div>
                <Select
                  value={settings.wallpaper || "None"}
                  onValueChange={async (val) => {
                    try {
                      if (val === "None") {
                        await setWallpaper(val);
                        onSettingsChange({ wallpaper: "None" });
                      } else {
                        await setWallpaper(val);
                        onSettingsChange({ wallpaper: val });
                      }
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
                  value={settings.themeMode}
                  onChange={(val) =>
                    onSettingsChange({
                      themeMode: val as PlayerSettings["themeMode"],
                    })
                  }
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
                  checked={settings.compactMode}
                  onCheckedChange={(val) =>
                    onSettingsChange({ compactMode: val })
                  }
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
                  checked={settings.showAlbumArt}
                  onCheckedChange={(val) =>
                    onSettingsChange({ showAlbumArt: val })
                  }
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="show-lyrics">
                    {t("settings.interface.lyrics")}
                  </label>
                  <p className={styles.settingDescription}>
                    {t("settings.interface.lyricsDesc")}
                  </p>
                </div>
                <Switch
                  id="show-lyrics"
                  checked={settings.showLyrics}
                  onCheckedChange={(val) =>
                    onSettingsChange({ showLyrics: val })
                  }
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
                <Select
                  value={i18n.language}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger id="language-selector">
                    <SelectValue>
                      {languageNames[i18n.language] ||
                        i18n.language.toUpperCase()}
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
                  onClick={() => setDialogResetOpen(true)}
                >
                  <Icon name="rotateCcw" size={16} decorative />
                  {t("settings.resetDialogsButton")}
                </Button>
                <Dialog
                  open={dialogResetOpen}
                  onOpenChange={setDialogResetOpen}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {t("settings.resetDialogsTitle")}
                      </DialogTitle>
                      <DialogDescription>
                        {t("settings.resetDialogsDescription")}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={handleDialogResetClose}
                        disabled={dialogResetLoading}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        onClick={async () => {
                          setDialogResetLoading(true);
                          try {
                            await resetAllDialogPreferences();
                            toast.success(t("settings.resetDialogsSuccess"));
                            setDialogResetOpen(false);
                          } catch (e: any) {
                            toast.error(e?.message || t("settings.resetError"));
                          } finally {
                            setDialogResetLoading(false);
                          }
                        }}
                        disabled={dialogResetLoading}
                        variant="destructive"
                      >
                        {dialogResetLoading
                          ? t("common.loading")
                          : t("common.reset")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </section>

            {/* Keyboard Shortcuts */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Icon
                  name="keyboard"
                  className={styles.sectionIcon}
                  size="1.25rem"
                  decorative
                />
                <h3 className={styles.sectionTitle}>
                  {t("settings.shortcuts.title")}
                </h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingLabel}>
                  <label>{t("settings.shortcuts.enabled")}</label>
                  <p className={styles.settingDescription}>
                    {t("settings.shortcuts.enabledDesc")}
                  </p>
                </div>
                <Switch
                  id="shortcuts-enabled"
                  checked={true}
                  onCheckedChange={() => {}}
                />
              </div>

              <ShortcutConfig onShortcutsChanged={onShortcutsChanged} />
            </section>

            {/* Beta */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Icon
                  name="messageCircle"
                  className={styles.sectionIcon}
                  size="1.25rem"
                  decorative
                />
                <h3 className={styles.sectionTitle}>Beta</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="discord-enabled">
                    Enable Discord Integration (Broken Beta)
                  </label>
                  <p className={styles.settingDescription}>
                    Note: Discord&apos;s RPC API requires special approval.
                    Currently logs track info for testing.
                  </p>
                </div>
                <Switch
                  id="discord-enabled"
                  checked={settings.discordEnabled || false}
                  onCheckedChange={(val) =>
                    onSettingsChange({ discordEnabled: val })
                  }
                />
              </div>

              {settings.discordEnabled && (
                <>
                  <div className={styles.settingItem}>
                    <div className={styles.settingInfo}>
                      <label>{t("discord.connection")}</label>
                      <p className={styles.settingDescription}>
                        {settings.discordUserId
                          ? t("discord.connected", {
                              userId: settings.discordUserId,
                            })
                          : t("discord.notConnected")}
                      </p>
                    </div>
                    <Button
                      variant={settings.discordUserId ? "outline" : "primary"}
                      onClick={() => {
                        if (settings.discordUserId) {
                          // Disconnect Discord
                          onSettingsChange({ discordUserId: undefined });
                          toast.success(t("discord.disconnected"));
                        } else {
                          // Redirect to Discord OAuth
                          const discordOAuthUrl =
                            "https://discord.com/oauth2/authorize?client_id=1419480226970341476&response_type=code&redirect_uri=https%3A%2F%2Fhtmlplayer-backend.onrender.com%2Foauth%2Fcallback&scope=identify%20rpc.activities.write";
                          window.open(discordOAuthUrl, "_blank");
                          toast.info(t("discord.completeAuth"));
                        }
                      }}
                    >
                      {settings.discordUserId
                        ? t("discord.disconnect")
                        : t("discord.connect")}
                    </Button>
                  </div>

                  {!settings.discordUserId && (
                    <div className={styles.settingItem}>
                      <div className={styles.settingInfo}>
                        <label htmlFor="discord-user-id">
                          {t("discord.manualUserId")}
                        </label>
                        <p className={styles.settingDescription}>
                          {t("discord.manualUserIdDescription")}
                        </p>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <Input
                          id="discord-user-id"
                          type="text"
                          placeholder={t("discord.userId")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                onSettingsChange({
                                  discordUserId: input.value.trim(),
                                });
                                toast.success(t("discord.userIdSaved"));
                                input.value = "";
                              }
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            const input = (e.target as HTMLElement)
                              .previousElementSibling as HTMLInputElement;
                            if (input && input.value.trim()) {
                              onSettingsChange({
                                discordUserId: input.value.trim(),
                              });
                              toast.success(t("discord.userIdSaved"));
                              input.value = "";
                            }
                          }}
                        >
                          {t("common.save")}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label htmlFor="eruda-enabled">
                    Enable Eruda Debug Console
                  </label>
                  <p className={styles.settingDescription}>
                    Eruda is a debug console for mobile browsers. Takes effect
                    immediately.
                  </p>
                </div>
                <Switch
                  id="eruda-enabled"
                  checked={settings.erudaEnabled === true}
                  onCheckedChange={handleErudaToggle}
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
              <Icon name="rotateCcw" size={16} decorative />
              {t("settings.reset")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};
