'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import en, { type Locale } from './locales/en';
import zh from './locales/zh';

export type LocaleCode = 'en' | 'zh';

const LOCALES: Record<LocaleCode, Locale> = { en, zh };
const STORAGE_KEY = 'fe-lang';

interface LangContextType {
  lang: LocaleCode;
  setLang: (l: LocaleCode) => void;
  toggleLang: () => void;
  t: (key: keyof Locale, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LocaleCode>('en');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    if (stored && stored in LOCALES) setLangState(stored);
  }, []);

  useEffect(() => {
    document.title = LOCALES[lang].appName;
  }, [lang]);

  const setLang = useCallback((l: LocaleCode) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next: LocaleCode = prev === 'en' ? 'zh' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback((key: keyof Locale, vars?: Record<string, string | number>): string => {
    return interpolate(LOCALES[lang][key], vars);
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}

export function useT() {
  return useLang().t;
}
