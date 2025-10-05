import React from "react";
import ReactDOM from "react-dom/client";
import IndexPage from "./_index";
import "../global.css";
import { Toaster } from "sonner";
import { ThemeLoader } from "../helpers/themeLoader";
import { IconRegistryProvider } from "../helpers/iconLoader";
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { languageNames } from "../../public/locales/supportedLanguages";

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

// Hide loading screen once React is ready
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove();
    }, 500); // Match the CSS transition duration
  }
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <IconRegistryProvider defaultSetId="lucide">
        <ThemeLoader defaultTheme="Blue">
          <Toaster />
          <IndexPage />
        </ThemeLoader>
      </IconRegistryProvider>
    </I18nextProvider>
  </React.StrictMode>
);

// Hide loading screen after render
hideLoadingScreen();
