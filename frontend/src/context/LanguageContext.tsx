/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { translations } from '../locales/translations';
import type { Language } from '../locales/translations';

type TranslationKey = keyof typeof translations['fr'];

interface LanguageContextValue {
  lang: Language;
  changeLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('fr');

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const changeLanguage = (newLang: Language) => setLang(newLang);

  const t = (key: TranslationKey) => translations[lang][key] ?? translations.fr[key];

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage doit être utilisé dans <LanguageProvider>');
  return ctx;
}
