"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, translations, TranslationKey } from "@/lib/translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [isLoading, setIsLoading] = useState(true);

  // Cargar preferencia del localStorage después de montar
  useEffect(() => {
    const saved = localStorage.getItem("cafe-cursor-locale") as Locale | null;
    if (saved && (saved === "pt-BR" || saved === "en")) {
      console.log(`🌐 [LOCALE] Cargado del localStorage: ${saved}`);
      setLocaleState(saved);
    }
    setIsLoading(false);
  }, []);

  const setLocale = (newLocale: Locale) => {
    console.log(`🌐 [LOCALE] Cambiando idioma a: ${newLocale}`);
    setLocaleState(newLocale);
    localStorage.setItem("cafe-cursor-locale", newLocale);
  };

  const t = (key: TranslationKey): string => {
    return translations[locale][key];
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
