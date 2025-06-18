"use client";

import React, { useEffect, useState } from "react";
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
  getCurrentThemeMode,
} from "../helpers/themeMode";
import styles from "./ThemeModeSwitch.module.css";

export interface ThemeModeSwitchProps {
  /**
   * Optional CSS class to apply to the component
   */
  className?: string;
}

// Note: if the current style only supports one mode (light or dark), we will need to
// first update the global style to support 2 modes before using this component.
export const ThemeModeSwitch = ({
  className,
}: ThemeModeSwitchProps) => {
  const [currentMode, setCurrentMode] = useState<ThemeMode>("light");

  // Initialize theme on component mount
  useEffect(() => {
    const initialMode = getCurrentThemeMode();
    setCurrentMode(initialMode);
  }, []);

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
    
    setCurrentMode(mode);
  };

  const getThemeIcon = () => {
    switch (currentMode) {
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
            aria-label={`Current theme: ${currentMode}. Click to change theme`}
            className={styles.themeButton}
          >
            {getThemeIcon()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className={currentMode === "light" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("light")}
          >
            <Sun size={16} className={styles.menuIcon} />
            Light
            {currentMode === "light" && (
              <span className={styles.checkmark}>✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={currentMode === "dark" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("dark")}
          >
            <Moon size={16} className={styles.menuIcon} />
            Dark
            {currentMode === "dark" && (
              <span className={styles.checkmark}>✓</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className={currentMode === "auto" ? styles.activeItem : ""}
            onClick={() => applyThemeMode("auto")}
          >
            <SunMoon size={16} className={styles.menuIcon} />
            Auto
            {currentMode === "auto" && (
              <span className={styles.checkmark}>✓</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};