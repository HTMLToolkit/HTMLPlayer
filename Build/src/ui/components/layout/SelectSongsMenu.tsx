import { Button } from "../primitives/Button";
import { Icon } from "../shared/Icon";
import { useTranslation } from "react-i18next";
import PersistentDropdownMenu from "../primitives/PersistentDropdownMenu";
import styles from "./MainContent.module.css";

interface SelectSongsMenuProps {
  selectedCount: number;
  totalCount: number;
  onToggle: () => void;
  onAddToPlaylist: () => void;
  onDeleteSelected: () => void;
}

export function SelectSongsMenu({
  selectedCount,
  totalCount,
  onToggle,
  onAddToPlaylist,
  onDeleteSelected,
}: SelectSongsMenuProps) {
  const { t } = useTranslation();

  const handleSelectAll = () => {
    onToggle();
  };

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
      onClose={onToggle}
    >
      <Button variant="ghost" onClick={handleSelectAll}>
        <Icon name="listChecks" size={16} style={{ marginRight: 8 }} decorative />
        {selectedCount === totalCount ? t("actions.deselectAll") : t("actions.selectAll")}
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
