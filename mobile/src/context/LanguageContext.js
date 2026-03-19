import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Localization from 'expo-localization';
import { translations } from '../localization/translations';

const LanguageContext = createContext(null);

const getSupportedLocale = () => {
  const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';
  const supported = ['en', 'hi', 'pa', 'mr', 'ta'];
  return supported.includes(deviceLocale) ? deviceLocale : 'en';
};

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState(getSupportedLocale());
  const t = (key) => translations[locale]?.[key] || translations['en']?.[key] || key;
  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);