'use client';

/**
 * 대시보드 상단 헤더 컴포넌트
 * 페이지 제목과 마지막 업데이트 시간을 표시합니다.
 */

import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { CATEGORIES } from '@/lib/constants/categories';
import { formatDate } from '@/lib/utils/format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface HeaderProps {
  title?: string;
}

/**
 * 현재 경로로부터 페이지 제목 추출
 */
const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Dashboard';
  
  const category = CATEGORIES.find(c => c.path === pathname);
  return category?.label || 'Dashboard';
};

export const Header = ({ title }: HeaderProps) => {
  const pathname = usePathname();
  const pageTitle = title || getPageTitle(pathname);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* 좌측: 페이지 제목 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
      </div>

      {/* 우측: 업데이트 시간 + 사용자 아이콘 */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          마지막 업데이트: {formatDate(new Date())}
        </span>
        
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-slate-100">
            <User className="h-5 w-5 text-slate-600" />
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
};

