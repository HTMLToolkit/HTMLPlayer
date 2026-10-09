import React from "react";
import ReactDOM from "react-dom/client";
import { broadcastThemeCSS } from "../platform/pip/broadcastTheme";
import IndexPage from "./_index";
import "../global.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "../ui/theming/ThemeProvider";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { languageNames } from "../types/supportedLanguages";
import { bundledResources } from "../helpers/i18nManual";
import { logEnvironmentReport } from "../platform/diagnostics/environmentReport";
import { declarePlaybackSession } from "../platform/audio/session/audioSession";

const isSingleFile = __IS_SINGLE_FILE__;
const i18nInstance = i18n;

declarePlaybackSession();

void logEnvironmentReport().catch((error: unknown) => {
  console.warn("Environment report failed", error);
});

if (!isSingleFile) {
  i18nInstance.use(HttpApi);
}

i18nInstance
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: true,
    supportedLngs: Object.keys(languageNames),
    resources: bundledResources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <I18nextProvider i18n={i18nInstance}>
        <ThemeProvider onThemeChange={() => broadcastThemeCSS()}>
          <IndexPage />
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          closeButton
          richColors
          duration={3000}
        />
      </I18nextProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
