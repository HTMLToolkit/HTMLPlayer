import React from "react";
import ReactDOM from "react-dom/client";
import IndexPage from "./_index";
import "../global.css";
import { Toaster } from "sonner";
import { ThemeLoader } from "../helpers/themeLoader";
import { IconRegistryProvider } from "../helpers/iconLoader";
import { WallpaperLoader } from "../helpers/wallpaperLoader";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { languageNames } from "../types/supportedLanguages";
import { useThemeLoader } from "../helpers/themeLoader";
import { useIconRegistry } from "../helpers/iconLoader";
import { bundledResources } from "../helpers/i18nManual";

const isSingleFile = __IS_SINGLE_FILE__;
const i18nInstance = i18n;

// Only use HttpApi if NOT a single file build
if (!isSingleFile) {
  i18nInstance.use(HttpApi);
}

i18nInstance
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: true,
    supportedLngs: Object.keys(languageNames), // <-- dynamically from file
    resources: bundledResources,

    detection: {
      order: ["queryString", "cookie", "localStorage", "navigator"],
      caches: ["cookie", "localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

function LoadingGate({ children }: { children: React.ReactNode }) {
  const { isLoading: themeLoading } = useThemeLoader();
  const { iconsReady } = useIconRegistry();
  const [ready, setReady] = React.useState(false);
  const [appRendered, setAppRendered] = React.useState(false);

  React.useEffect(() => {
    if (!themeLoading && iconsReady && !ready) {
      setReady(true);
    }
  }, [themeLoading, iconsReady, ready]);

  React.useEffect(() => {
    if (ready && !appRendered) {
      // Wait for app to be painted, then hide loading screen
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const loadingScreen = document.getElementById("loading-screen");
          if (loadingScreen) {
            loadingScreen.classList.add("fade-out");
            // Remove after transition completes
            setTimeout(() => {
              loadingScreen.remove();
            }, 500);
          }
          setAppRendered(true);
        });
      });
    }
  }, [ready, appRendered]);

  // Don't render children until ready
  if (!ready) return null;

  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <IconRegistryProvider defaultSetId="lucide">
        <ThemeLoader defaultTheme="Blue">
          <WallpaperLoader defaultWallpaper="None">
            <LoadingGate>
              <Toaster
                theme="system"
                position="bottom-right"
                toastOptions={{
                  style: {
                    background:
                      "linear-gradient(135deg, var(--themecolor-transparent), var(--themecolor2-transparent))",
                    color: "var(--primary-foreground)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)",
                    fontFamily: "var(--font-family-base)",
                    border: "1px solid var(--primary-border)",
                  },
                }}
              />
              <IndexPage />
            </LoadingGate>
          </WallpaperLoader>
        </ThemeLoader>
      </IconRegistryProvider>
    </I18nextProvider>
  </React.StrictMode>,
);
