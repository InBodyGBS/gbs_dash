'use client';

/**
 * 헤더 우측 상단의 KR / EN 언어 토글.
 * LanguageProvider 안에서 사용한다.
 */

import { useLanguage } from '@/lib/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-md border border-gray-200 bg-white overflow-hidden text-xs"
    >
      <button
        type="button"
        onClick={() => setLang('ko')}
        aria-pressed={lang === 'ko'}
        className={cn(
          'px-2.5 py-1 font-semibold transition-colors',
          lang === 'ko'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:bg-gray-50',
        )}
      >
        KR
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={cn(
          'px-2.5 py-1 font-semibold transition-colors border-l border-gray-200',
          lang === 'en'
            ? 'bg-gray-900 text-white'
            : 'text-gray-500 hover:bg-gray-50',
        )}
      >
        EN
      </button>
    </div>
  );
}
