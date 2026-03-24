'use client';

/**
 * System Management 레이아웃
 * 공통 탭 네비게이션 제공
 */

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SystemLayoutProps {
  children: React.ReactNode;
}

export default function SystemLayout({ children }: SystemLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // 현재 활성 탭 결정
  const getActiveTab = () => {
    if (pathname.includes('/system/project')) return 'project';
    if (pathname.includes('/system/process')) return 'process';
    return 'system';
  };

  const activeTab = getActiveTab();

  const handleTabChange = (value: string) => {
    if (value === 'system') {
      router.push('/system');
    } else if (value === 'project') {
      router.push('/system/project');
    } else if (value === 'process') {
      router.push('/system/process');
    }
  };

  return (
    <div className="space-y-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-2 px-6">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList>
              <TabsTrigger value="system">시스템 현황</TabsTrigger>
              <TabsTrigger value="project">프로젝트</TabsTrigger>
              <TabsTrigger value="process">프로세스</TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>
      </div>

      {/* 페이지 컨텐츠 */}
      <div className="px-6">
        {children}
      </div>
    </div>
  );
}
