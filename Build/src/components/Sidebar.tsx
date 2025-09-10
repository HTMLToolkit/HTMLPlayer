import { useState, memo, useCallback } from "react";
import { Menu, Settings as SettingsIcon, Info, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { Separator } from "./Separator";
import { Settings as SettingsComponent } from "./Settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./Dialog";
import { PlaylistComponent } from "./Playlist";
import styles from "./Sidebar.module.css";

type SidebarProps = {
  musicPlayer: ReturnType<typeof import("../hooks/useMusicPlayer").useMusicPlayer>;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

const COLLAPSED_WIDTH = "40px";
const EXPANDED_WIDTH = "250px";

// Memoized Settings Component
const MemoizedSettings = memo(SettingsComponent);

// Memoized Playlist Component
const MemoizedPlaylist = memo(PlaylistComponent);

export const Sidebar = ({ musicPlayer, onCollapseChange }: SidebarProps) => {
  // Local state for UI interactions
  const [showAbout, setShowAbout] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { settings, updateSettings } = musicPlayer.playerSettings;

  // Memoized callbacks to avoid re-creation on each render
  const handleMenuClick = useCallback(() => {
    setIsCollapsed(prev => {
      const newState = !prev;
      document.documentElement.style.setProperty(
        "--sidebar-width",
        newState ? COLLAPSED_WIDTH : EXPANDED_WIDTH
      );
      onCollapseChange?.(newState);
      return newState;
    });
  }, [onCollapseChange]);

  const handleSliverClick = useCallback(() => {
    setIsCollapsed(false);
    document.documentElement.style.setProperty("--sidebar-width", EXPANDED_WIDTH);
    onCollapseChange?.(false);
  }, [onCollapseChange]);

  const handleAbout = useCallback(() => setShowAbout(true), []);
  const handleSettings = useCallback(() => setShowSettings(prev => !prev), []);

  // Collapsed view
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

      <MemoizedPlaylist musicPlayer={musicPlayer} />

      <div className={styles.footer}>
        <Separator />
        <Button variant="ghost" className={styles.footerButton} onClick={handleAbout}>
          <Info size={16} />
          About
        </Button>
        <Button variant="ghost" className={styles.footerButton} onClick={handleSettings}>
          <SettingsIcon size={16} />
          Settings
        </Button>

        <MemoizedSettings
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onSettingsChange={updateSettings}
        />
      </div>

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>About HTMLPlayer</DialogTitle>
            <DialogDescription>
              HTMLPlayer v2.0 - A modern music streaming interface built with React.
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
