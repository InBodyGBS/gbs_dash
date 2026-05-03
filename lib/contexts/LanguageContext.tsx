'use client';

/**
 * 언어 설정 Context
 * - localStorage 에 사용자 선택을 저장 (브라우저 간 공유)
 * - 기본값: 'ko'
 * - 사용법:
 *     const { lang, setLang, t } = useLanguage();
 *     <h1>{t('dashboard.title')}</h1>
 *     혹은 단순 hook:
 *     const t = useT();
 *     <h1>{t('dashboard.title')}</h1>
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translate, type Lang } from '@/lib/i18n/translations';

const STORAGE_KEY = 'gbs_lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ko');
  const [hydrated, setHydrated] = useState(false);

  // 초기 1회 — localStorage 에서 복원
  // 서버 렌더링 안전: 기본값('ko') 으로 SSR 후, 마운트 시점에 사용자 선택을 반영.
  // 잠깐의 깜빡임은 hydration-safe 한 표준 패턴이며 의도된 동작.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === 'ko' || saved === 'en') {
      setLangState(saved);
    }
    setHydrated(true);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
      // <html lang="..."> 도 함께 업데이트 (스크린리더/접근성)
      document.documentElement.setAttribute('lang', next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, lang, params),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  // 하이드레이션 전에는 children 렌더 (한국어 기본 — 깜빡임 방지)
  // 하이드레이션 후에는 localStorage 값으로 렌더
  return (
    <LanguageContext.Provider value={value}>
      {/* hydrated 여부와 무관하게 children 표시 — SSR 안전 */}
      <span style={{ display: 'contents' }} data-hydrated={hydrated ? 'true' : 'false'}>
        {children}
      </span>
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // 프로바이더 밖에서 호출되는 경우 — 안전하게 한국어 반환
    return {
      lang: 'ko',
      setLang: () => undefined,
      t: (key, params) => translate(key, 'ko', params),
    };
  }
  return ctx;
}

/** 단순 번역 hook — `const t = useT(); t('key')` */
export function useT() {
  return useLanguage().t;
}
