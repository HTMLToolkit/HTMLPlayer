import { useEffect, useRef, useState } from "react";
import { logger } from "../../../helpers/logger";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "react-i18next";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Button } from "../primitives/Button";
import { Icon } from "./Icon";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";
import styles from "./UpdatePrompt.module.css";

gsap.registerPlugin(useGSAP);

const DEFAULT_CHECK_INTERVAL_MS = 60 * 60 * 1000;

interface UpdatePromptProps {
  checkInterval?: number;
}

export function UpdatePrompt({
  checkInterval = DEFAULT_CHECK_INTERVAL_MS,
}: UpdatePromptProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(
    undefined,
  );

  useGSAP(
    () => {
      const prompt = promptRef.current;
      if (!prompt || prefersReducedMotion()) return;
      gsap.fromTo(
        prompt,
        { opacity: 0, y: 20, x: "-50%" },
        { opacity: 1, y: 0, x: "-50%", duration: 0.3, ease: "power2.out" },
      );
    },
    { scope: promptRef },
  );

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(
      swUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) {
      logger.info("SW registered", { swUrl });
      registrationRef.current = registration;
    },
    onRegisterError(error: Error) {
      logger.error("SW registration error:", { error: error.message });
    },
  });

  useEffect(() => {
    if (checkInterval <= 0) return;

    const tick = () => {
      logger.info("Checking for SW updates...");
      void registrationRef.current?.update().catch(() => {});
    };

    const id = window.setInterval(tick, checkInterval);
    return () => window.clearInterval(id);
  }, [checkInterval]);

  useEffect(() => {
    if (needRefresh) {
      setDismissed(false);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setNeedRefresh(false);
  };

  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div
      ref={promptRef}
      className={styles.updatePrompt}
      role="alert"
      aria-live="polite"
    >
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <Icon name="refreshCw" size={20} decorative />
        </div>
        <div className={styles.text}>
          <strong className={styles.title}>{t("update.available")}</strong>
          <p className={styles.description}>{t("update.description")}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          {t("update.later")}
        </Button>
        <Button variant="primary" size="sm" onClick={handleUpdate}>
          <Icon name="download" size={14} decorative />
          {t("update.now")}
        </Button>
      </div>
    </div>
  );
}

export default UpdatePrompt;
