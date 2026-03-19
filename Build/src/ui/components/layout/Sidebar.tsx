import { useState, memo, useEffect, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../primitives/Button";
import { Separator } from "../primitives/Separator";
import { Settings as SettingsComponent } from "../features/Settings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../primitives/Dialog";
import { PlaylistComponent } from "../features/Playlist";
import styles from "./Sidebar.module.css";
import { Icon } from "../shared/Icon";
import { HelpGuideButton } from "../shared/HelpGuide";
import type { UseKomorebiReturn } from "../../../hooks/useKomorebi";

interface SidebarProps {
  komorebi: UseKomorebiReturn;
  onCollapseChange?: (isCollapsed: boolean) => void;
  onShortcutsChanged?: () => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
  isMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

const COLLAPSED_WIDTH = "40px";
const EXPANDED_WIDTH = "250px";

export const Sidebar = memo(
  ({
    komorebi,
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

    // Detect mobile viewport
    useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth <= 768);
      };

      checkMobile();
      window.addEventListener("resize", checkMobile);

      return () => window.removeEventListener("resize", checkMobile);
    }, []);

    // Update CSS custom property when collapsed state changes
    useLayoutEffect(() => {
      document.documentElement.style.setProperty(
        "--sidebar-width",
        isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
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
        <div
          className={`${styles.sidebar} ${styles.collapsed}`}
          onClick={handleSliverClick}
        >
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

        <div
          className={`${styles.sidebar} ${isMobile && isMobileOpen ? styles.sidebarMobileOpen : ""} ${isMobile && !isMobileOpen ? styles.sidebarMobileClosed : ""}`}
          data-tour="sidebar"
        >
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

          <PlaylistComponent komorebi={komorebi} />

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
            <HelpGuideButton />
            <Button
              variant="ghost"
              className={styles.footerButton}
              onClick={handleSettings}
              data-tour="settings"
            >
              <Icon name="settings" size={16} decorative />
              {t("settings.title")}
            </Button>
            <SettingsComponent
              komorebi={komorebi}
              open={isSettingsOpen}
              onOpenChange={setSettingsOpen}
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
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-3)",
                  padding: "var(--spacing-2) 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.875rem",
                  }}
                >
                  <span style={{ color: "var(--muted-foreground)" }}>
                    {t("about.version")}
                  </span>
                  <span>2.0.0</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--spacing-2)",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        "https://github.com/user/HTMLPlayer",
                        "_blank",
                      )
                    }
                  >
                    <Icon name="github" size={14} decorative />
                    GitHub
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/privacy.html", "_blank")}
                  >
                    {t("about.privacy")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/tos.html", "_blank")}
                  >
                    {t("about.terms")}
                  </Button>
                </div>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--muted-foreground)",
                    marginTop: "var(--spacing-2)",
                  }}
                >
                  {t("about.madeWith")}
                </p>
              </div>
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
  },
  (prevProps, nextProps) => {
    const prevLibrary = prevProps.komorebi.library.getState();
    const nextLibrary = nextProps.komorebi.library.getState();
    return (
      prevLibrary.playlists === nextLibrary.playlists &&
      prevLibrary.songs === nextLibrary.songs &&
      prevLibrary.favorites === nextLibrary.favorites &&
      prevProps.komorebi.settings.getSettings() === nextProps.komorebi.settings.getSettings() &&
      prevProps.settingsOpen === nextProps.settingsOpen &&
      prevProps.isMobileOpen === nextProps.isMobileOpen
    );
  },
);
