import React from "react";
import ReactDOM from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { languageNames } from "../types/supportedLanguages";
import { bundledResources } from "../helpers/i18nManual";
import { ThemeProvider } from "../ui/theming/ThemeProvider";
import TermsPage from "./terms";

const i18nInstance = i18n;

i18nInstance.use(HttpApi);
i18nInstance.use(LanguageDetector);
i18nInstance.use(initReactI18next).init({
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
        <ThemeProvider>
          <TermsPage />
        </ThemeProvider>
      </I18nextProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
