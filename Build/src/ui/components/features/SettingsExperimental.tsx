import { useTranslation } from "react-i18next";
import { Switch } from "../primitives/Switch";
import { Button } from "../primitives/Button";
import { Input } from "../primitives/Input";
import { Icon } from "../shared/Icon";
import { isTauri } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import styles from "./Settings.module.css";
import type { SettingsManager } from "../../../platform/settings/settings";

interface SettingsExperimentalProps {
  settings: SettingsManager;
  settingsState: ReturnType<SettingsManager["getSettings"]>;
}

export function SettingsExperimental({ settings, settingsState }: SettingsExperimentalProps) {
  const { t } = useTranslation();
  const isTauriEnv = isTauri();

  const [discordRpcStatus, setDiscordRpcStatus] = useState<"unknown" | "available" | "unavailable" | "unsupported">("unknown");

  const checkDiscordRpcStatus = async () => {
    if (!isTauriEnv) {
      setDiscordRpcStatus("unsupported");
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const available = await invoke("is_discord_running");
      setDiscordRpcStatus(available ? "available" : "unavailable");
    } catch {
      setDiscordRpcStatus("unavailable");
    }
  };

  useEffect(() => {
    if (settingsState.discordEnabled) {
      checkDiscordRpcStatus();
    } else {
      setDiscordRpcStatus("unknown");
    }
  }, [settingsState.discordEnabled]);

  const loadEruda = () => {
    return new Promise<void>((resolve, reject) => {
      if ((window as any).eruda) {
        (window as any).eruda.init();
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.crossOrigin = "anonymous";
      script.onload = () => { (window as any).eruda.init(); resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const unloadEruda = () => {
    if ((window as any).eruda) {
      try {
        (window as any).eruda.destroy();
        const erudaScript = document.querySelector('script[src*="eruda"]');
        if (erudaScript) erudaScript.remove();
        delete (window as any).eruda;
      } catch {}
    }
  };

  const handleErudaToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await loadEruda();
        toast.success("Eruda debug console enabled");
      } else {
        unloadEruda();
        toast.success("Eruda debug console disabled");
      }
      settings.setErudaEnabled(enabled);
    } catch {
      toast.error("Failed to toggle Eruda debug console");
    }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <Icon name="messageCircle" className={styles.sectionIcon} size="1.25rem" decorative />
        <h3 className={styles.sectionTitle}>Beta</h3>
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="discord-enabled">Enable Discord Integration (Broken Beta)</label>
          <p className={styles.settingDescription}>
            Note: Discord&apos;s RPC API requires special approval. Currently logs track info for testing.
          </p>
        </div>
        <Switch
          id="discord-enabled"
          checked={settingsState.discordEnabled || false}
          onCheckedChange={settings.setDiscordEnabled}
        />
      </div>

      {settingsState.discordEnabled && (
        <>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label>{t("discord.connection")}</label>
              <p className={styles.settingDescription}>
                {settingsState.discordUserId
                  ? t("discord.connected", { userId: settingsState.discordUserId })
                  : t("discord.notConnected")}
              </p>
            </div>
            <Button
              variant={settingsState.discordUserId ? "outline" : "primary"}
              onClick={() => {
                if (settingsState.discordUserId) {
                  settings.setDiscordUserId("");
                  toast.success(t("discord.disconnected"));
                } else {
                  window.open(
                    "https://discord.com/oauth2/authorize?client_id=1419480226970341476&response_type=code&redirect_uri=https%3A%2F%2Fhtmlplayer-backend.onrender.com%2Foauth%2Fcallback&scope=identify",
                    "_blank",
                  );
                  toast.info(t("discord.completeAuth"));
                }
              }}
            >
              {settingsState.discordUserId ? t("discord.disconnect") : t("discord.connect")}
            </Button>
          </div>

          {!settingsState.discordUserId && (
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <label htmlFor="discord-user-id">{t("discord.manualUserId")}</label>
                <p className={styles.settingDescription}>{t("discord.manualUserIdDescription")}</p>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Input
                  id="discord-user-id"
                  type="text"
                  placeholder={t("discord.userId")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        settings.setDiscordUserId(input.value.trim());
                        toast.success(t("discord.userIdSaved"));
                        input.value = "";
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    if (input && input.value.trim()) {
                      settings.setDiscordUserId(input.value.trim());
                      toast.success(t("discord.userIdSaved"));
                      input.value = "";
                    }
                  }}
                >
                  {t("common.save")}
                </Button>
              </div>
            </div>
          )}

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <label>{t("discord.status")}</label>
              <p className={styles.settingDescription}>
                {discordRpcStatus === "unknown" && t("discord.statusUnknown")}
                {discordRpcStatus === "unsupported" && t("discord.statusUnsupported")}
                {discordRpcStatus === "available" && t("discord.statusAvailable")}
                {discordRpcStatus === "unavailable" && t("discord.statusUnavailable")}
              </p>
            </div>
            <Button variant="outline" onClick={checkDiscordRpcStatus} disabled={!isTauriEnv}>
              {t("discord.refreshStatus")}
            </Button>
          </div>
        </>
      )}

      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <label htmlFor="eruda-enabled">Enable Eruda Debug Console</label>
          <p className={styles.settingDescription}>
            Eruda is a debug console for mobile browsers. Takes effect immediately.
          </p>
        </div>
        <Switch
          id="eruda-enabled"
          checked={settingsState.erudaEnabled === true}
          onCheckedChange={handleErudaToggle}
        />
      </div>
    </section>
  );
}
