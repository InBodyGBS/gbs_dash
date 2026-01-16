'use client';

/**
 * 대시보드 공통 레이아웃
 * Sidebar + Header + 메인 컨텐츠 영역
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebar } from '@/lib/contexts/SidebarContext';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

    // 인증 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push('/login');
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // 인증 확인 중이면 로딩 표시
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#971B2F' }}></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 인증되지 않은 경우 (리다이렉트 중)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="relative w-screen h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar 토글 버튼 */}
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'absolute top-4 left-4 z-30 bg-white/90 backdrop-blur-sm shadow-lg',
          sidebarOpen && 'left-[260px]'
        )}
        onClick={toggleSidebar}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

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
