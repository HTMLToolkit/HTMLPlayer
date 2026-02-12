// Import translations directly so Vite can bundle them
import enTranslation from "../locales/en/translation.json";
import frTranslation from "../locales/fr/translation.json";

export const bundledResources = {
  en: { translation: enTranslation },
  fr: { translation: frTranslation },
};
