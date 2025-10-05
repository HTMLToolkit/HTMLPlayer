import { useState, memo, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { Icon } from "./Icon";

interface SidebarProps {
  musicPlayerHook: ReturnType<
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
  onCollapseChange?: (isCollapsed: boolean) => void;
  onShortcutsChanged?: () => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const COLLAPSED_WIDTH = "40px";
const EXPANDED_WIDTH = "250px";

export const Sidebar = memo(({
  musicPlayerHook,
  onCollapseChange,
  onShortcutsChanged,
  settingsOpen,
  onSettingsOpenChange,
  isMobileOpen,
  onMobileOpenChange,
}: SidebarProps) => {
  const { t } = useTranslation();

  const [showAbout, setShowAbout] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { settings, updateSettings } = musicPlayerHook;

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update CSS custom property when collapsed state changes
  useLayoutEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    );
  }, [isCollapsed]);

  // Use external settings state if provided, otherwise use internal state
  const isSettingsOpen = settingsOpen !== undefined ? settingsOpen : false;
  const setSettingsOpen = onSettingsOpenChange || (() => {});

  const handleAbout = () => {
    setShowAbout(true);
  };

  const handleSettings = () => {
    setSettingsOpen(!isSettingsOpen);
  };

  const handleMenuClick = () => {
    if (isMobile) {
      // On mobile, close the sidebar overlay
      onMobileOpenChange?.(false);
    } else {
      // On desktop, toggle collapse
      const newCollapsedState = !isCollapsed;
      setIsCollapsed(newCollapsedState);
      onCollapseChange?.(newCollapsedState);
    }
  };

  const handleSliverClick = () => {
    setIsCollapsed(false);
    onCollapseChange?.(false);
  };

  const handleBackdropClick = () => {
    if (isMobile) {
      onMobileOpenChange?.(false);
    }
  };

  // On desktop, show collapsed sliver
  if (isCollapsed && !isMobile) {
    return (
      <div className={`${styles.sidebar} ${styles.collapsed}`} onClick={handleSliverClick}>
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${styles.expandButton} ${styles.noHover}`}
          onClick={handleSliverClick}
          aria-label={t("expandSidebar")}
        >
          <Icon name="chevronRight" size={16} decorative />
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop for mobile overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className={styles.backdrop} 
          onClick={handleBackdropClick}
          aria-label={t("closeSidebar")}
        />
      )}
      
      <div className={`${styles.sidebar} ${isMobile && isMobileOpen ? styles.sidebarMobileOpen : ''} ${isMobile && !isMobileOpen ? styles.sidebarMobileClosed : ''}`}>
      <div className={styles.header}>
        <Button
          variant="ghost"
          size="icon-md"
          className={styles.menuButton}
          onClick={handleMenuClick}
          aria-label={t("menu")}
        >
          <Icon name="menu" size={24} decorative />
        </Button>
        <h2 className={styles.title}>{t("playlists")}</h2>
      </div>

      <PlaylistComponent musicPlayerHook={musicPlayerHook} />

      <div className={styles.footer}>
        <Separator />
        <Button
          variant="ghost"
          className={styles.footerButton}
          onClick={handleAbout}
        >
          <Icon name="info" size={16} decorative />
          {t("aboutMenu")}
        </Button>
        <Button
          variant="ghost"
          className={styles.footerButton}
          onClick={handleSettings}
        >
          <Icon name="settings" size={16} decorative />
          {t("settings.title")}
        </Button>
        <SettingsComponent
          open={isSettingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSettingsChange={updateSettings}
          onShortcutsChanged={onShortcutsChanged}
        />
      </div>

      {/* About Modal */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("aboutHTMLPlayer")}</DialogTitle>
            <DialogDescription>
              {t("aboutHTMLPlayerDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAbout(false)}>
              {t("common.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}, (prevProps, nextProps) => {
  // Only re-render if the library playlists or songs have actually changed
  return (
    prevProps.musicPlayerHook.library.playlists === nextProps.musicPlayerHook.library.playlists &&
    prevProps.musicPlayerHook.library.songs === nextProps.musicPlayerHook.library.songs &&
    prevProps.musicPlayerHook.library.favorites === nextProps.musicPlayerHook.library.favorites &&
    prevProps.musicPlayerHook.settings === nextProps.musicPlayerHook.settings &&
    prevProps.settingsOpen === nextProps.settingsOpen &&
    prevProps.isMobileOpen === nextProps.isMobileOpen
  );
});