// Import translations directly so Vite can bundle them
import enTranslation from "../../public/locales/en/translation.json";
import frTranslation from "../../public/locales/fr/translation.json";

export const bundledResources = {
  en: { translation: enTranslation },
  fr: { translation: frTranslation },
};
