import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../primitives/Button";
import { SearchInput } from "../primitives/SearchInput";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../primitives/DropdownMenu";
import styles from "./Playlist.module.css";
import Icon from "../shared/Icon";

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
      <SearchInput
        icon="music"
        placeholder={t("playlist.searchPlaylists")}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon-md"
            className={`${styles.actionButton} action-button-lift`}
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
