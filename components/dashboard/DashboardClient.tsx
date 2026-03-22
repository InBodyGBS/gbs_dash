'use client';

/**
 * 대시보드 클라이언트 컴포넌트
 * SubsidiaryCardGrid(국내/해외)와 SubsidiaryCard를 연결하고 상태를 관리합니다.
 */

import { useState, useMemo } from 'react';
import type { Subsidiary } from '@/lib/supabase/types';
import { SubsidiaryCardGrid } from './SubsidiaryCardGrid';
import { SubsidiaryCard } from './SubsidiaryCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface DashboardClientProps {
  subsidiaries: Subsidiary[];
}

type FilterType = 'domestic' | 'overseas';

export const DashboardClient = ({ subsidiaries }: DashboardClientProps) => {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('overseas');

  const filteredSubsidiaries = useMemo(() => {
    if (filterType === 'domestic') {
      return subsidiaries.filter(
        (sub) =>
          sub.country === '한국' ||
          sub.country === 'Korea' ||
          sub.country === 'South Korea' ||
          sub.country === '대한민국'
      );
    } else {
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
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <Tabs value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
          <TabsList>
            <TabsTrigger value="domestic">국내</TabsTrigger>
            <TabsTrigger value="overseas">해외</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <SubsidiaryCardGrid
          subsidiaries={filteredSubsidiaries}
          selectedId={selectedSubsidiaryId}
          onSubsidiaryClick={setSelectedSubsidiaryId}
        />
      </div>

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
    </div>
  );
};
