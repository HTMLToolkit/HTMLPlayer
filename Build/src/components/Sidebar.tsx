import React, { useState } from "react";
import {
  Menu,
  Settings as SettingsIcon,
  Info,
  ChevronRight,
} from "lucide-react";
import { Button } from "./Button";
import { Separator } from "./Separator";
import { Settings as SettingsComponent } from "./Settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { PlaylistComponent } from "./Playlist";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  musicPlayerHook: ReturnType<
    typeof import("../helpers/musicPlayerHook").useMusicPlayer
  >;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

const COLLAPSED_WIDTH = "40px";
const EXPANDED_WIDTH = "250px";

export const Sidebar = ({
  musicPlayerHook,
  onCollapseChange,
}: SidebarProps) => {
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { settings, updateSettings } = musicPlayerHook;

  const handleAbout = () => {
    setShowAbout(true);
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  const handleMenuClick = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);

    // Update CSS variable for sidebar width:
    document.documentElement.style.setProperty(
      "--sidebar-width",
      newCollapsedState ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    );
  };

  const handleSliverClick = () => {
    setIsCollapsed(false);
    onCollapseChange?.(false);

    // Reset CSS variable to expanded width
    document.documentElement.style.setProperty(
      "--sidebar-width",
      EXPANDED_WIDTH
    );
  };

  if (isCollapsed) {
    return (
      <div className={styles.sidebarCollapsed} onClick={handleSliverClick}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${styles.expandButton} ${styles.noHover}`}
          onClick={handleSliverClick}
          aria-label="Expand sidebar"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={styles.menuButton}
          onClick={handleMenuClick}
          aria-label="Menu"
        >
          <Menu size={16} />
        </Button>
        <h2 className={styles.title}>Playlists</h2>
      </div>

      <PlaylistComponent musicPlayerHook={musicPlayerHook} />

      <div className={styles.footer}>
        <Separator />
        <Button
          variant="ghost"
          className={styles.footerButton}
          onClick={handleAbout}
        >
          <Info size={16} />
          About
        </Button>
        <Button
          variant="ghost"
          className={styles.footerButton}
          onClick={handleSettings}
        >
          <SettingsIcon size={16} />
          Settings
        </Button>
        <SettingsComponent
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      </div>

      {/* About Modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>About HTMLPlayer</DialogTitle>
            <DialogDescription>
              HTMLPlayer v2.0 - A modern music streaming interface built with
              React
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAbout(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
