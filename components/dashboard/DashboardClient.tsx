'use client';

/**
 * 대시보드 클라이언트 컴포넌트
 * WorldMap과 SubsidiaryCard를 연결하고 상태를 관리합니다.
 */

import { useState, useMemo } from 'react';
import type { Subsidiary } from '@/lib/supabase/types';
import { WorldMap } from './WorldMap';
import { SubsidiaryCard } from './SubsidiaryCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface DashboardClientProps {
  subsidiaries: Subsidiary[];
}

type FilterType = 'all' | 'domestic' | 'overseas';

/**
 * 대시보드 메인 클라이언트 컴포넌트
 * 법인 선택 상태를 관리하고 지도와 카드를 조율합니다.
 */
export const DashboardClient = ({ subsidiaries }: DashboardClientProps) => {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');

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
    <div className="h-full flex flex-col">
      {/* 탭 필터 */}
      <div className="mb-4">
        <Tabs value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="domestic">국내</TabsTrigger>
            <TabsTrigger value="overseas">해외</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 지도 및 카드 영역 */}
      <div className="flex-1 flex relative">
        {/* 지도 영역 */}
        <div
          className={`transition-all duration-300 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${
            selectedSubsidiaryId ? 'w-[calc(100%-400px)] mr-2' : 'w-full'
          }`}
        >
          <WorldMap
            subsidiaries={filteredSubsidiaries}
            selectedId={selectedSubsidiaryId}
            onSubsidiaryClick={setSelectedSubsidiaryId}
          />
        </div>

        {/* 법인 정보 카드 (우측 패널) */}
        {selectedSubsidiaryId && (
          <div className="w-[400px]">
            <SubsidiaryCard
              subsidiaryId={selectedSubsidiaryId}
              onClose={() => setSelectedSubsidiaryId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

