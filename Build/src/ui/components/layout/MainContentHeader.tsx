import React from "react";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { Input } from "../primitives/Input";
import { SortDropdown } from "./SortDropdown";
import { SelectSongsMenu } from "./SelectSongsMenu";
import { DeleteDialog } from "../primitives/DeleteDialog";
import type { NavigationState } from "../../navigation";
import styles from "./MainContent.module.css";

interface MainContentHeaderProps {
  navState: NavigationState;
  songSearchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "name" | "artist" | "album" | "rating" | null;
  sortOrder: "asc" | "desc";
  onSortByChange: (sortBy: "name" | "artist" | "album" | "rating" | null) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
  selectedSongs: string[];
  sortedSongsCount: number;
  onToggleSelect: () => void;
  onAddToPlaylist: () => void;
  onDeleteSelected: () => void;
  onDeleteSong: () => void;
  onAddMusic: () => void;
  onMobileMenuClick: () => void;
  onBackClick: () => void;
  sortDropdownRef: React.Ref<{ close: () => void }>;
  songToDelete: { title?: string } | null;
  showDeleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  isHomeView: boolean;
  viewSwitcher: React.ReactNode;
}

export function MainContentHeader({
  navState,
  songSearchQuery,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  selectedSongs,
  sortedSongsCount,
  onToggleSelect,
  onAddToPlaylist,
  onDeleteSelected,
  onDeleteSong,
  onAddMusic,
  onMobileMenuClick,
  onBackClick,
  sortDropdownRef,
  songToDelete,
  showDeleteConfirm,
  onDeleteConfirm,
  onDeleteConfirmOpenChange,
  t,
  isHomeView,
  viewSwitcher,
}: MainContentHeaderProps) {
  const getTitle = () => {
    switch (navState.view) {
      case "home":
      case "songs":
        return "HTMLPlayer";
      case "artist":
        return `Artist: ${navState.artist}`;
      case "album":
        return `Album: ${navState.album}`;
    }
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Button
            variant="ghost"
            size="icon-md"
            className={styles.mobileMenuButton}
            onClick={onMobileMenuClick}
            aria-label={t("menu")}
          >
            <Icon name="menu" size={24} decorative />
          </Button>
          {navState.view === "artist" && (
            <Button variant="link" onClick={onBackClick} className={styles.backLink}>
              {t("actions.back")}
            </Button>
          )}
          {navState.view === "album" && (
            <Button variant="link" onClick={onBackClick} className={styles.backLink}>
              {t("actions.back")}
            </Button>
          )}
          <h1 className={styles.title}>{getTitle()}</h1>
          <div className={styles.mobileOnly} style={{ marginLeft: "auto" }}>
            {viewSwitcher}
          </div>
        </div>
        {isHomeView && (
          <div className={`${styles.desktopOnly} ${styles.viewSwitcherRow}`}>
            {viewSwitcher}
          </div>
        )}
        {!isHomeView && (
          <div className={styles.actions}>
            <div className={styles.searchWrapper}>
              <Icon name="search" className={styles.searchIcon} size={16} decorative />
              <Input
                placeholder={t("search.placeholder")}
                className={styles.searchInput}
                value={songSearchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                data-tour="search"
              />
            </div>
            <div className={styles.buttonGroup}>
              <Button
                variant="outline"
                size="icon-md"
                className={styles.actionButton}
                onClick={onDeleteSong}
                aria-label={t("actions.delete")}
              >
                <Icon name="trash2" size={16} decorative />
              </Button>
              <SortDropdown
                ref={sortDropdownRef as React.Ref<{ close: () => void }>}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortByChange={onSortByChange}
                onSortOrderChange={onSortOrderChange}
              />
              <SelectSongsMenu
                selectedCount={selectedSongs.length}
                totalCount={sortedSongsCount}
                onToggle={onToggleSelect}
                onAddToPlaylist={onAddToPlaylist}
                onDeleteSelected={onDeleteSelected}
              />
              <Button
                variant="outline"
                size="icon-md"
                className={styles.actionButton}
                onClick={onAddMusic}
                aria-label={t("actions.addMusic")}
                data-tour="upload-music"
              >
                <Icon name="plus" size={16} decorative />
              </Button>
              <div className={styles.desktopOnly}>{viewSwitcher}</div>
            </div>
          </div>
        )}
      </div>

      <DeleteDialog
        open={showDeleteConfirm}
        onOpenChange={onDeleteConfirmOpenChange}
        title={t("delete.songTitle")}
        itemName={songToDelete?.title}
        onConfirm={onDeleteConfirm}
        dontShowAgainKey="delete-song-confirmation"
      />
    </>
  );
}
