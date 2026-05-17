'use client';

/**
 * 대시보드 공통 레이아웃
 * Sidebar + Header + 메인 컨텐츠 영역
 *
 * 인증 가드:
 *   - Supabase 세션이 없거나
 *   - 로그인 시점에 저장한 만료 시간이 지나면
 *   → /login?redirect=<현재경로> 로 리다이렉트
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { Menu, X, Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { SidebarProvider, useSidebar } from '@/lib/contexts/SidebarContext';
import { supabase } from '@/lib/supabase/client';
import { isAuthExpired, signOut, clearLocalSession, isRefreshTokenError } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useSidebar();

  /* ── 인증 가드 ── */
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // getSession 자체가 백그라운드 refresh 를 트리거하면서 "Invalid Refresh Token" 에러를
      // 던질 수 있다. 이 경우 세션이 무효이므로 로컬만 정리하고 로그인 페이지로 보낸다.
      let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
      try {
        const res = await supabase.auth.getSession();
        session = res.data.session;
      } catch (e) {
        if (isRefreshTokenError(e)) {
          clearLocalSession();
        } else {
          console.warn('getSession failed:', e);
        }
      }

      // 세션 자체가 없거나, 클라이언트 측 만료 타임스탬프가 지난 경우 → 로그인 페이지로
      if (!session) {
        const redirect = encodeURIComponent(pathname || '/');
        router.replace(`/login?redirect=${redirect}`);
        return;
      }
      if (isAuthExpired()) {
        // 만료된 세션은 강제 종료 (Supabase 세션 + 로컬 만료 타임스탬프 모두 정리)
        await signOut().catch(() => undefined);
        const redirect = encodeURIComponent(pathname || '/');
        router.replace(`/login?redirect=${redirect}`);
        return;
      }
      if (!cancelled) setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  // Supabase 세션이 외부에서 종료되면(다른 탭에서 로그아웃 등) 즉시 반응
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        const redirect = encodeURIComponent(pathname || '/');
        router.replace(`/login?redirect=${redirect}`);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!authChecked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

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
