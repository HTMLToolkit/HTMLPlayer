import { useState } from "react";
import { useTranslation } from "react-i18next";
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
    typeof import("../hooks/musicPlayerHook").useMusicPlayer
  >;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

const COLLAPSED_WIDTH = "40px";
const EXPANDED_WIDTH = "250px";

export const Sidebar = ({
  musicPlayerHook,
  onCollapseChange,
}: SidebarProps) => {
  const { t } = useTranslation();

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

    document.documentElement.style.setProperty(
      "--sidebar-width",
      newCollapsedState ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    );
  };

  const handleSliverClick = () => {
    setIsCollapsed(false);
    onCollapseChange?.(false);

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
          aria-label={t("expandSidebar")}
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
          aria-label={t("menu")}
        >
          <Menu size={16} />
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
          <Info size={16} />
          {t("about")}
        </Button>
        <Button
          variant="ghost"
          className={styles.footerButton}
          onClick={handleSettings}
        >
          <SettingsIcon size={16} />
          {t("settings.title")}
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
            <DialogTitle>{t("aboutHTMLPlayer")}</DialogTitle>
            <DialogDescription>
              {t("aboutHTMLPlayerDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAbout(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};