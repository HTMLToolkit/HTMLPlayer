import { useTranslation } from "react-i18next";
import { Icon } from "../shared/Icon";
import { ShortcutConfig } from "../shared/ShortcutConfig";
import styles from "./Settings.module.css";

interface SettingsShortcutsProps {
  onShortcutsChanged?: () => void;
}

export const SettingsShortcuts = ({ onShortcutsChanged }: SettingsShortcutsProps) => {
  const { t } = useTranslation();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon
          name="keyboard"
          className={styles.sectionIcon}
          size="1.25rem"
          decorative
        />
        <h3 className={styles.sectionTitle}>
          {t("settings.shortcuts.title")}
        </h3>
      </div>
      <ShortcutConfig onShortcutsChanged={onShortcutsChanged} />
    </section>
  );
};
