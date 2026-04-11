import React from "react";
import ReactDOM from "react-dom/client";
import { logger } from "../helpers/logger";
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
    debug: true,
    supportedLngs: Object.keys(languageNames),
    resources: bundledResources,
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <I18nextProvider i18n={i18nInstance}>
        <ThemeProvider
          onThemeChange={(data) => logger.info(`Theme changed: ${data.type} = ${data.value}`)}
        >
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
