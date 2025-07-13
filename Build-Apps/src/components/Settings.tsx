"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./Sheet";
import { Button } from "./Button";
import { Switch } from "./Switch";
import { Slider } from "./Slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./Select";
import { ThemeModeSwitch } from "./ThemeModeSwitch";
import {
  Settings as SettingsIcon,
  Volume2,
  Music,
  Palette,
  Database,
  RotateCcw,
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import styles from "./Settings.module.css";



export type PlayerSettings = {
  volume: number;
  audioQuality: 'low' | 'medium' | 'high' | 'lossless';
  crossfade: number;
  defaultShuffle: boolean;
  defaultRepeat: 'off' | 'one' | 'all';
  themeMode: 'light' | 'dark' | 'auto';
  autoPlayNext: boolean;
  compactMode: boolean;
  showAlbumArt: boolean;
  showLyrics: boolean;
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
  onSettingsChange 
}: SettingsProps) => {
  // Convert volume to percentage for display
  const volume = [Math.round(settings.volume * 100)];
  const audioQuality = settings.audioQuality;
  const crossfade = [settings.crossfade];
  const defaultShuffle = settings.defaultShuffle;
  const defaultRepeat = settings.defaultRepeat;
  const autoPlayNext = settings.autoPlayNext;
  const compactMode = settings.compactMode;
  const showAlbumArt = settings.showAlbumArt;
  const showLyrics = settings.showLyrics;

  // Handlers that actually call onSettingsChange
  const handleResetSettings = () => {
    onSettingsChange({
      volume: 0.75,
      audioQuality: 'high',
      crossfade: 3,
      defaultShuffle: false,
      defaultRepeat: 'off',
      autoPlayNext: true,
      compactMode: false,
      showAlbumArt: true,
      showLyrics: false,
    });
  };

  const handleVolumeChange = (newVolume: number[]) => {
    onSettingsChange({ volume: newVolume[0] / 100 });
  };

  const handleAudioQualityChange = (quality: string) => {
    onSettingsChange({ audioQuality: quality as SettingsProps["settings"]["audioQuality"] });
  };

  const handleCrossfadeChange = (newCrossfade: number[]) => {
    onSettingsChange({ crossfade: newCrossfade[0] });
  };

  const handleShuffleChange = (shuffle: boolean) => {
    onSettingsChange({ defaultShuffle: shuffle });
  };

  const handleRepeatChange = (repeat: string) => {
    onSettingsChange({ defaultRepeat: repeat as SettingsProps["settings"]["defaultRepeat"] });
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
            {/* Audio Settings Section */}
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
                  <label htmlFor="audio-quality">Audio Quality</label>
                </div>
                <Select value={audioQuality} onValueChange={handleAudioQualityChange}>
                  <SelectTrigger id="audio-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (96 kbps)</SelectItem>
                    <SelectItem value="medium">Medium (160 kbps)</SelectItem>
                    <SelectItem value="high">High (320 kbps)</SelectItem>
                    <SelectItem value="lossless">Lossless</SelectItem>
                  </SelectContent>
                </Select>
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

            {/* Playback Settings Section */}
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
                <Select value={defaultRepeat} onValueChange={handleRepeatChange}>
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

            {/* Interface Settings Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <Palette className={styles.sectionIcon} />
                <h3 className={styles.sectionTitle}>Interface Settings</h3>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label>Theme</label>
                  <p className={styles.settingDescription}>
                    Choose your preferred color theme
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