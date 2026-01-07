'use client';

/**
 * 대시보드 공통 레이아웃
 * Sidebar + Header + 메인 컨텐츠 영역
 */

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 좌측 Sidebar - 고정 */}
      <Sidebar currentPath={pathname} />

      {/* 우측 메인 영역 */}
      <div className="ml-64 flex-1 flex flex-col">
        {/* 상단 Header */}
        <Header />

        {/* 메인 컨텐츠 */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* Sonner Toaster - 전역 알림 */}
      <Toaster position="top-right" />
    </div>
  );
}

