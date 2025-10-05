import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { Button } from "./Button";
import { Icon } from "./Icon";
import {
  ThemeMode,
  switchToDarkMode,
  switchToLightMode,
  switchToAutoMode,
} from "../helpers/themeMode";
import styles from "./ThemeModeSwitch.module.css";

export interface ThemeModeSwitchProps {
  className?: string;
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

export const ThemeModeSwitch = ({
  className,
  value,
  onChange,
}: ThemeModeSwitchProps) => {
  const { t } = useTranslation();

  const applyThemeMode = (mode: ThemeMode) => {
    switch (mode) {
      case "light":
        switchToLightMode();
        break;
      case "dark":
        switchToDarkMode();
        break;
      case "auto":
        switchToAutoMode();
        break;
    }
    onChange(mode);
  };

  const getThemeIcon = () => {
    switch (value) {
      case "light":
        return <Icon name="sun" className={styles.icon} decorative />;
      case "dark":
        return <Icon name="moon" className={styles.icon} decorative />;
      case "auto":
        return <Icon name="sunMoon" className={styles.icon} decorative />;
      default:
        return <Icon name="sun" className={styles.icon} decorative />;
    }
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            aria-label={t("currentThemeAria", { theme: value })}
            className={styles.themeButton}
          >
            {getThemeIcon()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className={value === "light" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("light")}
          >
            <Icon
              name="sun"
              size={16}
              className={styles.menuIcon}
              decorative
            />
            {t("themeLight")}
            {value === "light" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={value === "dark" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("dark")}
          >
            <Icon
              name="moon"
              size={16}
              className={styles.menuIcon}
              decorative
            />
            {t("themeDark")}
            {value === "dark" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={value === "auto" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("auto")}
          >
            <Icon
              name="sunMoon"
              size={16}
              className={styles.menuIcon}
              decorative
            />
            {t("themeAuto")}
            {value === "auto" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
