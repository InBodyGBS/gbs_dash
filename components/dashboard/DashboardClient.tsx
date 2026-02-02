'use client';

/**
 * 대시보드 클라이언트 컴포넌트
 * WorldMap(전체), SubsidiaryCardGrid(국내/해외)와 SubsidiaryCard를 연결하고 상태를 관리합니다.
 */

import { useState, useMemo } from 'react';
import type { Subsidiary } from '@/lib/supabase/types';
import { WorldMap } from './WorldMap';
import { SubsidiaryCardGrid } from './SubsidiaryCardGrid';
import { SubsidiaryCard } from './SubsidiaryCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSidebar } from '@/lib/contexts/SidebarContext';

interface DashboardClientProps {
  subsidiaries: Subsidiary[];
}

type FilterType = 'all' | 'domestic' | 'overseas';

/**
 * 대시보드 메인 클라이언트 컴포넌트
 * 법인 선택 상태를 관리하고 지도(전체) 또는 카드 그리드(국내/해외)와 상세 카드를 조율합니다.
 */
export const DashboardClient = ({ subsidiaries }: DashboardClientProps) => {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const { sidebarOpen } = useSidebar();

  // Sidebar 상태에 따라 팝업 너비 동적 조정 (전체 탭에서만 사용)
  const popupWidth = useMemo(() => {
    return sidebarOpen ? 240 : 320;
  }, [sidebarOpen]);

  // 필터에 따라 법인 목록 필터링
  const filteredSubsidiaries = useMemo(() => {
    if (filterType === 'all') {
      return subsidiaries;
    } else if (filterType === 'domestic') {
      // 한국인 법인만 필터링 (country가 "한국", "Korea", "South Korea" 등)
      return subsidiaries.filter(
        (sub) =>
          sub.country === '한국' ||
          sub.country === 'Korea' ||
          sub.country === 'South Korea' ||
          sub.country === '대한민국'
      );
    } else {
      // 해외 법인 (한국이 아닌 모든 법인)
      return subsidiaries.filter(
        (sub) =>
          sub.country !== '한국' &&
          sub.country !== 'Korea' &&
          sub.country !== 'South Korea' &&
          sub.country !== '대한민국'
      );
    }
  }, [subsidiaries, filterType]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* 탭 필터 - Header 아래 */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <Tabs value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="domestic">국내</TabsTrigger>
            <TabsTrigger value="overseas">해외</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 지도/카드 그리드 및 상세 카드 영역 */}
      <div className="flex-1 w-full flex relative overflow-hidden">
        {/* 지도 또는 카드 그리드 영역 */}
        <div
          className="transition-all duration-300 w-full h-full"
          style={{
            width: filterType === 'all' && selectedSubsidiaryId ? `calc(100% - ${popupWidth}px)` : '100%',
          }}
        >
          {filterType === 'all' ? (
            <WorldMap
              subsidiaries={filteredSubsidiaries}
              selectedId={selectedSubsidiaryId}
              onSubsidiaryClick={setSelectedSubsidiaryId}
            />
          ) : (
            <SubsidiaryCardGrid
              subsidiaries={filteredSubsidiaries}
              selectedId={selectedSubsidiaryId}
              onSubsidiaryClick={setSelectedSubsidiaryId}
            />
          )}
        </div>

        {/* 법인 정보 카드 (전체 탭: 우측 패널) */}
        {filterType === 'all' && selectedSubsidiaryId && (
          <div
            className="absolute right-0 top-0 bottom-0 z-10 h-full"
            style={{ width: `${popupWidth}px` }}
          >
            <SubsidiaryCard
              subsidiaryId={selectedSubsidiaryId}
              onClose={() => setSelectedSubsidiaryId(null)}
            />
          </div>
        )}
      </div>

      {/* 법인 정보 카드 (국내/해외 탭: 가운데 팝업) */}
      {filterType !== 'all' && (
        <Dialog open={!!selectedSubsidiaryId} onOpenChange={(open) => !open && setSelectedSubsidiaryId(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
            {selectedSubsidiaryId && (
              <div className="h-full flex flex-col min-h-0">
                <SubsidiaryCard
                  subsidiaryId={selectedSubsidiaryId}
                  onClose={() => setSelectedSubsidiaryId(null)}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

