import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../primitives/Sheet";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { ShortcutConfig } from "../shared/ShortcutConfig";
import styles from "./Settings.module.css";
import { usePalette } from "../../theming/hooks";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

import { SettingsAudio } from "./SettingsAudio";
import { SettingsPlayback } from "./SettingsPlayback";
import { SettingsInterface } from "./SettingsInterface";
import { SettingsExperimental } from "./SettingsExperimental";

export interface SettingsProps {
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  komorebi: UseKomorebiReturn;
  onShortcutsChanged?: () => void;
}

type SettingsCategory = "playback" | "interface" | "shortcuts" | "experimental";

export function Settings({
  className,
  open,
  onOpenChange,
  komorebi,
  onShortcutsChanged,
}: SettingsProps) {
  const { t } = useTranslation();
  const { setPalette } = usePalette();
  const settings = komorebi.settings;
  const settingsState = settings.getSettings();
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("playback");

  const handleResetSettings = async () => {
    const defaultThemeName = "Blue";
    try {
      await setPalette(defaultThemeName);
      settings.setVolume(0.75);
      settings.setCrossfade(3);
      settings.setDefaultShuffle(false);
      settings.setDefaultRepeat("off");
      settings.setAutoPlayNext(true);
      settings.setCompactMode(false);
      settings.setShowAlbumArt(true);
      settings.setShowLyrics(false);
      settings.setSessionRestore(true);
      settings.setGaplessPlayback(false);
      settings.setSmartShuffle(true);
      settings.setColorTheme(defaultThemeName);
      settings.setWallpaper("None");
      settings.setLanguage("English");
      settings.setTempo(1);
      settings.setPitch(0);
      settings.setDiscordEnabled(false);
      settings.setDiscordUserId("");
      settings.setErudaEnabled(false);
    } catch {
      // toast.error(t("settings.resetError"));
    }
  };

  const categoryList: Array<{
    id: SettingsCategory;
    label: string;
    description: string;
    icon: string;
  }> = [
    {
      id: "playback",
      label: t("settings.category.playback", "Playback"),
      description: t(
        "settings.category.playbackDescription",
        "Audio and playback behavior",
      ),
      icon: "music",
    },
    {
      id: "interface",
      label: t("settings.category.interface", "Interface"),
      description: t(
        "settings.category.interfaceDescription",
        "Themes, language, and appearance",
      ),
      icon: "palette",
    },
    {
      id: "shortcuts",
      label: t("settings.category.shortcuts", "Shortcuts"),
      description: t(
        "settings.category.shortcutsDescription",
        "Keyboard shortcut preferences",
      ),
      icon: "keyboard",
    },
    {
      id: "experimental",
      label: t("settings.category.experimental", "Beta"),
      description: t(
        "settings.category.experimentalDescription",
        "Early and experimental features",
      ),
      icon: "messageCircle",
    },
  ];

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className={styles.sheetContent}>
          <SheetHeader className={styles.sheetHeader}>
            <SheetTitle>{t("settings.title")}</SheetTitle>
            <SheetDescription>{t("settings.description")}</SheetDescription>
          </SheetHeader>

          <div className={styles.settingsContent}>
            <div className={styles.settingsLayout}>
              <div className={styles.sidebarShell}>
                <nav
                  className={styles.settingsSidebar}
                  aria-label={t("settings.title")}
                >
                  {categoryList.map((category) => {
                    const isActive = activeCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`${styles.sidebarButton} ${isActive ? styles.sidebarButtonActive : ""}`}
                        onClick={() => setActiveCategory(category.id)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon
                          name={category.icon}
                          size="1.25rem"
                          decorative
                          className={styles.sidebarButtonIcon}
                        />
                        <div className={styles.sidebarButtonText}>
                          <span className={styles.sidebarButtonLabel}>
                            {category.label}
                          </span>
                          <span className={styles.sidebarButtonDescription}>
                            {category.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div className={styles.categoryContent}>
                {activeCategory === "playback" && (
                  <>
                    <SettingsAudio
                      settings={settings}
                      settingsState={settingsState}
                    />
                    <SettingsPlayback
                      settings={settings}
                      settingsState={settingsState}
                    />
                  </>
                )}
                {activeCategory === "interface" && (
                  <SettingsInterface
                    settings={settings}
                    settingsState={settingsState}
                  />
                )}
                {activeCategory === "shortcuts" && (
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
                    <ShortcutConfig onShortcutsChanged={onShortcutsChanged} />
                  </section>
                )}
                {activeCategory === "experimental" && (
                  <SettingsExperimental
                    settings={settings}
                    settingsState={settingsState}
                  />
                )}
              </div>
            </div>
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
}
