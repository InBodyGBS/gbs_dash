'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Subsidiary } from '@/lib/supabase/types';
import { WorldMap } from '@/components/dashboard/WorldMap';
import { SubsidiaryCardGrid } from '@/components/dashboard/SubsidiaryCardGrid';
import { SubsidiaryCard } from '@/components/dashboard/SubsidiaryCard';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSidebar } from '@/lib/contexts/SidebarContext';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';

interface FinancialResultClientProps {
  subsidiaries: Subsidiary[];
}

type FilterType = 'all' | 'domestic' | 'overseas';

export const FinancialResultClient = ({ subsidiaries }: FinancialResultClientProps) => {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const { sidebarOpen } = useSidebar();

  // 서버 컴포넌트에서 받은 전체 법인을 사용자 권한 범위로 필터
  // (서버에서는 auth 세션을 못 보기 때문에 클라이언트에서 한 번 더 가드)
  const [allowedCodes, setAllowedCodes] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const roleInfo = await getCurrentUserRoleInfo();
      if (cancelled) return;
      if (roleInfo.canSeeAll) {
        setAllowedCodes(null); // null = 전체 허용
      } else {
        setAllowedCodes(new Set(roleInfo.entityCodes));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accessibleSubsidiaries = useMemo(() => {
    if (allowedCodes === null) return subsidiaries;
    return subsidiaries.filter((s) => allowedCodes.has(s.code));
  }, [subsidiaries, allowedCodes]);

  const popupWidth = useMemo(() => {
    return sidebarOpen ? 240 : 320;
  }, [sidebarOpen]);

  const filteredSubsidiaries = useMemo(() => {
    if (filterType === 'domestic') {
      return accessibleSubsidiaries.filter(
        (sub) =>
          sub.country === '한국' ||
          sub.country === 'Korea' ||
          sub.country === 'South Korea' ||
          sub.country === '대한민국'
      );
    } else if (filterType === 'overseas') {
      return accessibleSubsidiaries.filter(
        (sub) =>
          sub.country !== '한국' &&
          sub.country !== 'Korea' &&
          sub.country !== 'South Korea' &&
          sub.country !== '대한민국'
      );
    }
    return accessibleSubsidiaries;
  }, [accessibleSubsidiaries, filterType]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <Tabs
          value={filterType}
          onValueChange={(value) => {
            setFilterType(value as FilterType);
            setSelectedSubsidiaryId(null);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="domestic">국내</TabsTrigger>
            <TabsTrigger value="overseas">해외</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 w-full flex relative overflow-hidden">
        {filterType === 'all' ? (
          <>
            <div
              className="transition-all duration-300 h-full"
              style={{
                width: selectedSubsidiaryId ? `calc(100% - ${popupWidth}px)` : '100%',
              }}
            >
              <WorldMap
                subsidiaries={filteredSubsidiaries}
                selectedId={selectedSubsidiaryId}
                onSubsidiaryClick={setSelectedSubsidiaryId}
              />
            </div>

            {selectedSubsidiaryId && (
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
          </>
        ) : (
          <>
            <div className="w-full h-full overflow-hidden">
              <SubsidiaryCardGrid
                subsidiaries={filteredSubsidiaries}
                selectedId={selectedSubsidiaryId}
                onSubsidiaryClick={setSelectedSubsidiaryId}
              />
            </div>

            <Dialog
              open={!!selectedSubsidiaryId}
              onOpenChange={(open) => !open && setSelectedSubsidiaryId(null)}
            >
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
          </>
        )}
      </div>
    </div>
  );
};
