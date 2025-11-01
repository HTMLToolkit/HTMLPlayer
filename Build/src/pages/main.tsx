import React from "react";
import ReactDOM from "react-dom/client";
import IndexPage from "./_index";
import "../global.css";
import { Toaster } from "sonner";
import { ThemeLoader } from "../helpers/themeLoader";
import { IconRegistryProvider } from "../helpers/iconLoader";
import { WallpaperLoader } from "../helpers/wallpaperLoader";
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { languageNames } from "../../public/locales/supportedLanguages";
import { useThemeLoader } from "../helpers/themeLoader";
import { useIconRegistry } from "../helpers/iconLoader";

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: true,
    supportedLngs: Object.keys(languageNames), // <-- dynamically from file
    backend: {
      loadPath: './locales/{{lng}}/translation.json',
    },
    detection: {
      order: ['queryString', 'cookie'],
      caches: ['cookie']
    },
    interpolation: {
      escapeValue: false
    }
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
          const loadingScreen = document.getElementById('loading-screen');
          if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
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
              <Toaster />
              <IndexPage />
            </LoadingGate>
          </WallpaperLoader>
        </ThemeLoader>
      </IconRegistryProvider>
    </I18nextProvider>
  </React.StrictMode>
);
