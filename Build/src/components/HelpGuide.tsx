import { TourProvider, useTour, components } from "@reactour/tour";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { Icon } from "./Icon";
import styles from "./HelpGuide.module.css";
import { useEffect, useState, createContext, useContext } from "react";

interface HelpGuideProps {
  children: React.ReactNode;
}

const { Badge, Close, Navigation } = components;

const TourContext = createContext<{ loaded: boolean }>({ loaded: false });

export const useTourLoaded = () => useContext(TourContext);

export const HelpGuideProvider = ({ children }: HelpGuideProps) => {
  function useTourStepsConfig() {
    const { i18n } = useTranslation();
    const [tourStepsConfig, setTourStepsConfig] = useState<any[]>([]);

    useEffect(() => {
      const loadTourConfig = async () => {
        try {
          const lang = i18n.language?.split("-")[0] || "en";
          const response = await fetch(`/locales/${lang}/tour.json`);
          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}: Failed to fetch tour configuration`,
            );
          }
          const config = await response.json();
          setTourStepsConfig(config);
        } catch (error) {
          console.error("Failed to load tour configuration:", error);
          setTourStepsConfig([]);
        }
      };
      loadTourConfig();
    }, [i18n.language]);
    return tourStepsConfig;
  }

  const tourStepsConfig = useTourStepsConfig();

  const steps = tourStepsConfig.map(
    ({ key, title, content, extraContent, position }) => ({
      selector: `[data-tour="${key}"]`,
      content: (
        <div>
          <h3>{title}</h3>
          <p>{content}</p>
          {extraContent && <p>{extraContent}</p>}
        </div>
      ),
      position: position as "top" | "bottom" | "left" | "right",
    }),
  );

  if (!tourStepsConfig.length) {
    return (
      <TourContext.Provider value={{ loaded: false }}>
        {children}
      </TourContext.Provider>
    );
  }

  return (
    <TourContext.Provider value={{ loaded: true }}>
      <TourProvider
        steps={steps}
        styles={{
          popover: (base) => ({
            ...base,
            backgroundColor: "var(--primary-foreground)",
            color: "var(--text-color)",
            border: "1px solid var(--color-border)",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)",
            fontFamily: "var(--font-family)",
            animation: "fadeIn 0.3s ease-out",
          }),
          maskArea: (base) => ({
            ...base,
            rx: 12,
            animation: "pulse 2s infinite",
          }),
          badge: (base) => ({
            ...base,
            backgroundColor: "var(--color-accent)",
            color: "var(--color-accent-text)",
          }),
          controls: (base) => ({
            ...base,
            marginTop: 20,
          }),
          close: (base) => ({
            ...base,
            color: "var(--color-text-secondary)",
            right: 10,
            top: 10,
          }),
        }}
        components={{
          Badge: (props) => (
            <Badge {...props}>
              <Icon name="sparkles" size={14} decorative />
            </Badge>
          ),
          Close: ({ ...props }) => (
            <Close {...props}>
              <Icon name="x" size={16} decorative />
            </Close>
          ),
          Navigation: ({ ...props }) => (
            <Navigation {...props}>
              <Button variant="outline" size="sm">
                <Icon name="chevronLeft" size={14} decorative />
              </Button>
              <Button variant="outline" size="sm">
                <Icon name="chevronRight" size={14} decorative />
              </Button>
            </Navigation>
          ),
        }}
        onClickMask={() => {}}
        showCloseButton={true}
        showNavigation={true}
        showBadge={true}
        scrollSmooth={true}
        maskClassName={styles.mask}
        className={styles.tour}
      >
        {children}
      </TourProvider>
    </TourContext.Provider>
  );
};

export const HelpGuideButton = () => {
  const { setIsOpen } = useTour();
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      className={styles.helpButton}
      onClick={() => setIsOpen(true)}
      aria-label={t("help.startTour")}
    >
      <Icon name="circleQuestionMark" size={16} decorative />
      {t("help.startTour")}
    </Button>
  );
};
