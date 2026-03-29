import React from "react";
import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { useTranslation } from "react-i18next";
import PersistentDropdownMenu, {
  PersistentDropdownMenuRef,
} from "../primitives/PersistentDropdownMenu";
import styles from "./MainContent.module.css";

interface SortDropdownProps {
  sortBy: "name" | "artist" | "album" | "rating" | null;
  sortOrder: "asc" | "desc";
  onSortByChange: (sortBy: "name" | "artist" | "album" | "rating" | null) => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
  ref?: React.Ref<PersistentDropdownMenuRef>;
}

export const SortDropdown = React.forwardRef<PersistentDropdownMenuRef, SortDropdownProps>(
  ({ sortBy, sortOrder, onSortByChange, onSortOrderChange }, ref) => {
    const { t } = useTranslation();

    return (
      <PersistentDropdownMenu
        ref={ref}
        trigger={
          <Button
            variant="outline"
            size="icon-md"
            className={styles.actionButton}
            aria-label={t("sort.sortBy")}
          >
            <Icon name="arrowUpDown" size={16} decorative />
          </Button>
        }
        onClose={() => {}}
      >
        <Button
          variant="ghost"
          onClick={() => onSortByChange("name")}
          className="w-full justify-start text-sm"
        >
          <Icon name="type" size={16} className="mr-2" decorative />
          {t("sort.name")}
          {sortBy === "name" && <span className="ml-auto">•</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onSortByChange("artist")}
          className="w-full justify-start text-sm"
        >
          <Icon name="user" size={16} className="mr-2" decorative />
          {t("sort.artist")}
          {sortBy === "artist" && <span className="ml-auto">•</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onSortByChange("album")}
          className="w-full justify-start text-sm"
        >
          <Icon name="disc" size={16} className="mr-2" decorative />
          {t("sort.album")}
          {sortBy === "album" && <span className="ml-auto">•</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={() => onSortByChange("rating")}
          className="w-full justify-start text-sm"
        >
          <Icon name="star" size={16} className="mr-2" decorative />
          {t("sort.rating")}
          {sortBy === "rating" && <span className="ml-auto">•</span>}
        </Button>
        <div className="border-t my-1"></div>
        <Button
          variant="ghost"
          onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
          className="w-full justify-start text-sm"
        >
          {sortOrder === "asc" ? (
            <Icon name="arrowUp" size={16} className="mr-2" decorative />
          ) : (
            <Icon name="arrowDown" size={16} className="mr-2" decorative />
          )}
          {sortOrder === "asc" ? t("sort.ascending") : t("sort.descending")}
        </Button>
        <div className="border-t my-1"></div>
        <Button
          variant="ghost"
          onClick={() => onSortByChange(null)}
          className="w-full justify-start text-sm"
        >
          <Icon name="close" size={16} className="mr-2" decorative />
          {t("sort.clear")}
        </Button>
      </PersistentDropdownMenu>
    );
  },
);

SortDropdown.displayName = "SortDropdown";
