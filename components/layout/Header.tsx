'use client';

/**
 * 대시보드 상단 헤더 컴포넌트
 * 페이지 제목과 마지막 업데이트 시간을 표시합니다.
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { CATEGORIES, getDeepestMatchingChild } from '@/lib/constants/categories';
import { formatDate } from '@/lib/utils/format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface HeaderProps {
  title?: string;
}

interface UserProfile {
  name: string;
  email: string;
  team: string | null;
}

type UserProfileRow = {
  name: string;
  email: string;
  team: string | null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

/**
 * 현재 경로로부터 페이지 제목 추출
 */
const getPageTitle = (pathname: string): string => {
  if (pathname === '/') return 'Dashboard';

  const exact = CATEGORIES.find((c) => c.path && c.path === pathname);
  if (exact) return exact.label;

  if (pathname.startsWith('/monthly-closing/overview')) return 'Overview';
  if (pathname.startsWith('/monthly-closing/submission')) return 'Submission';

  for (const c of CATEGORIES) {
    if (!c.children?.length) continue;
    const child = getDeepestMatchingChild([...c.children], pathname);
    if (child) return child.label;
  }

  return 'Dashboard';
};

export const Header = ({ title }: HeaderProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = title || getPageTitle(pathname);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // user_profiles 테이블에서 프로필 정보 가져오기
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('name, email, team')
            .eq('id', user.id)
            .single();

          if (error) {
            // 프로필이 없으면 기본 정보 사용
            setUserProfile({
              name: user.email?.split('@')[0] || 'User',
              email: user.email || '',
              team: null,
            });
          } else {
            const typedProfile = profile as unknown as UserProfileRow;
            setUserProfile({
              name: typedProfile.name,
              email: typedProfile.email,
              team: typedProfile.team,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('로그아웃되었습니다.');
      router.push('/login');
      router.refresh();
    } catch (error: unknown) {
      toast.error('로그아웃 실패', {
        description: getErrorMessage(error),
      });
    }
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* 좌측: 페이지 제목 */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
      </div>

      {/* 우측: 업데이트 시간 + 사용자 메뉴 */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          마지막 업데이트: {formatDate(new Date())}
        </span>
        
        {!loading && userProfile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="h-9 w-9">
                  <AvatarFallback style={{ backgroundColor: '#971B2F', color: '#ffffff' }}>
                    {getInitials(userProfile.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-gray-900">{userProfile.name}</p>
                  {userProfile.team && (
                    <p className="text-xs text-gray-500">{userProfile.team}</p>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userProfile.name}</p>
                  <p className="text-xs text-gray-500">{userProfile.email}</p>
                  {userProfile.team && (
                    <p className="text-xs text-gray-500">{userProfile.team}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

