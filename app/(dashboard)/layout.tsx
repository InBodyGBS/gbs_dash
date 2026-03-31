'use client';

/**
 * 대시보드 공통 레이아웃
 * Sidebar + Header + 메인 컨텐츠 영역
 */

import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebar } from '@/lib/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // 인증 체크 제거 - 로그인 없이도 접근 가능

  return (
    <div className="relative w-screen h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar 토글: 기본 숨김 — hover/focus 시만 표시 (헤더 제목 옆 X가 항상 보이는 것처럼 느껴지지 않도록) */}
      <div
        className={cn(
          'group absolute top-4 z-30 rounded-md p-2 -m-2',
          sidebarOpen ? 'left-[260px]' : 'left-4'
        )}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'bg-white/90 backdrop-blur-sm shadow-lg transition-opacity duration-200',
            'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto',
            'focus-visible:opacity-100 focus-visible:pointer-events-auto'
          )}
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* 좌측 Sidebar - 조건부 렌더링 */}
      {sidebarOpen && (
        <div className="absolute left-0 top-0 bottom-0 z-20">
          <Sidebar currentPath={pathname} />
        </div>
      )}

      {/* 우측 메인 영역 - full screen */}
      <div
        className={cn(
          'h-full flex flex-col transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-0'
        )}
        style={{
          width: sidebarOpen ? 'calc(100% - 256px)' : '100%',
        }}
      >
        {/* 상단 Header */}
        <Header />

        {/* 메인 컨텐츠 - full screen (Header 높이 제외) */}
        <main className="flex-1 w-full overflow-hidden" style={{ height: 'calc(100% - 4rem)' }}>
          {children}
        </main>
      </div>

      {/* Sonner Toaster - 전역 알림 */}
      <Toaster position="top-right" />
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}
