/**
 * G3: 国际化框架 (i18n) — 模块化词典
 *
 * 轻量级 i18n 实现，不引入 i18next 等重量级库
 * 支持中/英双语，按需扩展
 *
 * 词典结构：
 *   src/lib/i18n/
 *     index.tsx          ← 本文件：Provider + Hook + LocaleSwitcher
 *     zh/
 *       index.ts         ← 中文聚合
 *       common.ts         操作/状态/统计/PWA
 *       layout.ts         侧边栏/头部
 *       nav.ts            导航路由
 *       forms.ts          表单字段
 *       professional.ts   环保/环评术语
 *       pages.ts          页面标题/卡片
 *     en/
 *       (同结构，英文镜像)
 *
 * 使用方式：
 *   import { useI18n } from '@/lib/i18n';
 *   const { t, locale } = useI18n();
 *   t('nav.home') // → "首页" / "Home"
 *
 * 扩展方式：
 *   1. 在 zh/ 和 en/ 对应模块文件中新增键值
 *   2. 或新建模块文件，在 index.ts 中 import 并展开
 */

import { ReactNode, createContext, useCallback, useContext, useState } from 'react';
import { zh } from './zh';
import { en } from './en';

// ===== 类型定义 =====
export type Locale = 'zh' | 'en';

export type TranslationDict = Record<string, string>;

export const translations: Record<Locale, TranslationDict> = { zh, en };

// ===== Context =====
interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'ws-archive-locale';

// ===== Provider =====
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === 'zh' || saved === 'en') return saved;
    }
    return 'zh';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = translations[locale];
      let text = dict[key] || translations.zh[key] || key;

      if (params) {
        for (const [param, value] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
        }
      }

      return text;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

// ===== Hook =====
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: 'zh',
      t: (key: string) => translations.zh[key] || key,
      setLocale: () => {},
    };
  }
  return ctx;
}

// ===== 语言切换组件 =====
export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        onClick={() => setLocale('zh')}
        className={`px-2 py-0.5 rounded ${locale === 'zh' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
      >
        中文
      </button>
      <button
        onClick={() => setLocale('en')}
        className={`px-2 py-0.5 rounded ${locale === 'en' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
      >
        EN
      </button>
    </div>
  );
}
