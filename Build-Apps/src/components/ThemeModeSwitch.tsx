import { Sun, Moon, SunMoon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./DropdownMenu";
import { Button } from "./Button";
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
        return <Sun className={styles.icon} />;
      case "dark":
        return <Moon className={styles.icon} />;
      case "auto":
        return <SunMoon className={styles.icon} />;
      default:
        return <Sun className={styles.icon} />;
    }
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-md"
            aria-label={`Current theme: ${value}. Click to change theme`}
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
            <Sun size={16} className={styles.menuIcon} />
            Light
            {value === "light" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={value === "dark" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("dark")}
          >
            <Moon size={16} className={styles.menuIcon} />
            Dark
            {value === "dark" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={value === "auto" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("auto")}
          >
            <SunMoon size={16} className={styles.menuIcon} />
            Auto
            {value === "auto" && <span className={styles.checkmark}>✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
