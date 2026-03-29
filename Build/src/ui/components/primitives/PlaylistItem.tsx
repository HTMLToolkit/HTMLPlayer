import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { DropZone, DraggableItem } from "./Draggable";
import { Button } from "./Button";
import { Icon } from "../shared/Icon";
import { ScrollText } from "../shared/ScrollText";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./DropdownMenu";
import { useRightClickMenu } from "./DropdownMenu";
import styles from "../features/Playlist.module.css";

interface PlaylistItemProps {
  item: { id: string; name: string; songs: { id: string }[] };
  playlistImages: Record<string, string>;
  depth: number;
  getPlaylistIcon: (name: string) => React.ReactElement;
  onSelect: () => void;
  onRename: () => void;
  onShare: () => void;
  onMoveToFolder: () => void;
  onMoveToRoot: () => void;
  onExportJson: () => void;
  onExportM3u: () => void;
  onDelete: () => void;
}

export const PlaylistItem = memo(function PlaylistItem({
  item,
  playlistImages,
  depth,
  getPlaylistIcon,
  onSelect,
  onRename,
  onShare,
  onMoveToFolder,
  onMoveToRoot,
  onExportJson,
  onExportM3u,
  onDelete,
}: PlaylistItemProps) {
  const { t } = useTranslation();
  const { open, setOpen, containerRef } = useRightClickMenu(true);

  return (
    <div
      data-id={item.id}
      className={styles.playlistItemContainer}
      style={{ marginLeft: `${depth * 20}px` }}
      ref={containerRef}
    >
      <div className={styles.playlistItemMain}>
        <DraggableItem id={item.id} type="playlist" data={item}>
          <DropZone
            id={item.id}
            type="playlist"
            data={item}
            className={styles.playlistDropZone}
          >
            <button className={styles.playlistItem} onClick={onSelect}>
              {playlistImages[item.id] ? (
                <div className={styles.playlistImage}>
                  <img src={playlistImages[item.id]} alt="" loading="lazy" />
                </div>
              ) : (
                getPlaylistIcon(item.name)
              )}
              <div className={styles.playlistNameWrapper}>
                <ScrollText
                  text={item.name}
                  textClassName={styles.playlistNameText}
                  gap={12}
                  speed={40}
                  minDuration={6}
                  pauseOnHover
                  allowHTML={false}
                />
              </div>
              <span className={styles.songCount}>{item.songs.length}</span>
            </button>
          </DropZone>
        </DraggableItem>
      </div>

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={styles.moreButton}
            title={t("moreOptions")}
          >
            <Icon name="moreHorizontal" size={16} decorative />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuItem onClick={onRename}>
            <Icon name="edit" size={16} style={{ marginRight: 8 }} decorative />
            {t("playlist.renamePlaylist")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShare}>
            <Icon
              name="share"
              size={16}
              style={{ marginRight: 8 }}
              decorative
            />
            {t("playlist.sharePlaylist")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onMoveToFolder}>
            <Icon
              name="folder"
              size={16}
              style={{ marginRight: 8 }}
              decorative
            />
            {t("playlist.moveToFolder")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMoveToRoot}>
            <Icon
              name="folderOpen"
              size={16}
              style={{ marginRight: 8 }}
              decorative
            />
            {t("playlist.moveToRoot")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExportJson}>
            <Icon
              name="download"
              size={16}
              style={{ marginRight: 8 }}
              decorative
            />
            {t("playlist.exportJSON")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportM3u}>
            <Icon
              name="download"
              size={16}
              style={{ marginRight: 8 }}
              decorative
            />
            {t("playlist.exportM3U")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className={styles.deleteMenuItem}
          >
            <Icon
              name="trash2"
              size={16}
              style={{ marginRight: 8 }}
              decorative
            />
            {t("playlist.deletePlaylist")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
