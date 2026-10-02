import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { useTranslation } from "react-i18next";
import PersistentDropdownMenu from "../primitives/PersistentDropdownMenu";
import styles from "./MainContent.module.css";

interface SelectSongsMenuProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onExitSelectMode: () => void;
  onAddToPlaylist: () => void;
  onDeleteSelected: () => void;
}

export function SelectSongsMenu({
  selectedCount,
  totalCount,
  onSelectAll,
  onExitSelectMode,
  onAddToPlaylist,
  onDeleteSelected,
}: SelectSongsMenuProps) {
  const { t } = useTranslation();
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <PersistentDropdownMenu
      trigger={
        <Button
          variant="outline"
          size="icon-md"
          className={`${styles.actionButton} action-button-lift`}
          aria-label={t("actions.selectSongs")}
        >
          <Icon name="listChecks" size={16} decorative />
        </Button>
      }
      onClose={onExitSelectMode}
    >
      <Button variant="ghost" onClick={onSelectAll}>
        <Icon
          name="listChecks"
          size={16}
          style={{ marginRight: 8 }}
          decorative
        />
        {allSelected ? t("actions.deselectAll") : t("actions.selectAll")}
      </Button>
      <Button variant="ghost" onClick={onAddToPlaylist}>
        <Icon name="plus" size={16} style={{ marginRight: 8 }} decorative />
        {t("playlist.addTo")}
      </Button>
      <Button variant="ghost" onClick={onDeleteSelected}>
        <Icon name="trash2" size={16} style={{ marginRight: 8 }} decorative />
        {t("common.delete")}
      </Button>
    </PersistentDropdownMenu>
  );
}
