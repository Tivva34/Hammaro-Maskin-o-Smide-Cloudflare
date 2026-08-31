import React, { createContext, useContext, useState, useCallback } from 'react';
import translations from '../i18n/translations';

/* ─────────────────────────────────────────────────────────────
   LanguageContext – lightweight i18n for the public site.
   Admin panel is intentionally NOT wrapped.

   Exposes:
     lang      – current language code ('sv' | 'en')
     setLang   – change language + persist to localStorage
     t(key)    – resolve a dot-separated key, e.g. t('hero.title1')
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'hms_lang';
const SUPPORTED = ['sv', 'en'];

function resolveKey(dict, key) {
  return key.split('.').reduce((obj, part) => obj?.[part], dict) ?? key;
}

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED.includes(stored) ? stored : 'sv';
  });

  const setLang = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return;
    localStorage.setItem(STORAGE_KEY, code);
    setLangState(code);
  }, []);

  const t = useCallback(
    (key) => resolveKey(translations[lang], key),
    [lang]
  );

  const tDb = useCallback(
    (value, dictKey = 'machinery.types') => {
      if (!value) return '';
      const standardKey = `${dictKey}.${value}`;
      const resolved = resolveKey(translations[lang], standardKey);
      if (resolved !== standardKey) return resolved;
      
      const dbValKey = `dbValues.${value}`;
      const dbResolved = resolveKey(translations[lang], dbValKey);
      if (dbResolved !== dbValKey) return dbResolved;

      return value;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, tDb }}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * useLang – consume the LanguageContext.
 * Must be used inside <LanguageProvider>.
 */
export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
};
