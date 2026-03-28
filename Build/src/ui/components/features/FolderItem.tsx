import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { DropZone, DraggableItem } from "../primitives/Draggable";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { ScrollText } from "../shared/ScrollText";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../primitives/Collapsible";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "../primitives/DropdownMenu";
import { useRightClickMenu } from "../primitives/DropdownMenu";
import styles from "./Playlist.module.css";
import type { PlaylistFolder, Playlist } from "../../../core/engine/types";

interface FolderItemProps {
  item: PlaylistFolder;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
  onRename: () => void;
  onMoveToFolder: () => void;
  onMoveToRoot: () => void;
  onDelete: () => void;
  renderPlaylistItem: (item: Playlist | PlaylistFolder, depth: number) => React.ReactElement | null;
}

export const FolderItem = memo(function FolderItem({
  item,
  depth,
  isOpen,
  onToggle,
  onRename,
  onMoveToFolder,
  onMoveToRoot,
  onDelete,
  renderPlaylistItem,
}: FolderItemProps) {
  const { t } = useTranslation();
  const { open, setOpen, containerRef } = useRightClickMenu(true);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div
        className={styles.playlistItemContainer}
        style={{ marginLeft: `${depth * 20}px` }}
        data-id={item.id}
        ref={containerRef}
      >
        <div className={styles.playlistItemMain}>
          <DraggableItem id={item.id} type="folder" data={item}>
            <DropZone id={item.id} type="folder" data={item} className={styles.playlistDropZone}>
              <CollapsibleTrigger asChild>
                <button className={`${styles.playlistItem} ${styles.folderItem}`} style={{ width: "100%" }}>
                  <Icon
                    name="chevronDown"
                    size={16}
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                    decorative
                  />
                  <Icon name="folder" size={16} decorative />
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
                  <span className={styles.songCount}>{item.children.length}</span>
                </button>
              </CollapsibleTrigger>
            </DropZone>
          </DraggableItem>
        </div>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className={styles.moreButton} title={t("moreOptions")}>
              <Icon name="moreHorizontal" size={16} decorative />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuItem onClick={onRename}>
              <Icon name="edit" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.renameFolder")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMoveToFolder}>
              <Icon name="folder" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.moveToFolder")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveToRoot}>
              <Icon name="folderOpen" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.moveToRoot")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className={styles.deleteMenuItem}>
              <Icon name="trash2" size={16} style={{ marginRight: 8 }} decorative />
              {t("playlist.deleteFolder")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CollapsibleContent>
        <div>
          {item.children.map((child) => renderPlaylistItem(child, depth + 1))}
          {item.children.length === 0 && (
            <div
              style={{
                height: 20,
                margin: "4px 0",
                padding: "0 20px",
                color: "var(--foreground-subtle)",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {t("playlist.emptyFolder")}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});
