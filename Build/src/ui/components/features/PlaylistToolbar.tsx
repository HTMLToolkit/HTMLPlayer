import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../primitives/Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../primitives/DropdownMenu";
import { Icon } from "../shared/Icon";
import styles from "./Playlist.module.css";

interface PlaylistToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreatePlaylist: () => void;
  onCreateFolder: () => void;
  onImport: () => void;
}

export const PlaylistToolbar = memo(function PlaylistToolbar({
  searchQuery,
  onSearchChange,
  onCreatePlaylist,
  onCreateFolder,
  onImport,
}: PlaylistToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchWrapper}>
        <div className={styles.searchIcon}>
          <Icon name="music" size={16} decorative />
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t("playlist.searchPlaylists")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-md"
            className={styles.actionButton}
          >
            <Icon name="plus" size={16} decorative />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuItem onClick={onCreatePlaylist}>
            <Icon name="plus" size={16} style={{ marginRight: 8 }} decorative />
            {t("playlist.addPlaylist")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCreateFolder}>
            <Icon name="folderPlus" size={16} style={{ marginRight: 8 }} decorative />
            {t("playlist.addFolder")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onImport}>
            <Icon name="upload" size={16} style={{ marginRight: 8 }} decorative />
            {t("playlist.importPlaylist")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
