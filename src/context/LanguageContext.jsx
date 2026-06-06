import { createContext, useContext, useState } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem('sabai_lang') || 'en',
  );

  function setAndPersist(lang) {
    setLanguage(lang);
    localStorage.setItem('sabai_lang', lang);
  }

  const t = translations[language] || translations.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setAndPersist, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
