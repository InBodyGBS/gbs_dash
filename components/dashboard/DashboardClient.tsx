'use client';

/**
 * 대시보드 클라이언트 컴포넌트
 * WorldMap과 SubsidiaryCard를 연결하고 상태를 관리합니다.
 */

import { useState } from 'react';
import type { Subsidiary } from '@/lib/supabase/types';
import { WorldMap } from './WorldMap';
import { SubsidiaryCard } from './SubsidiaryCard';

interface DashboardClientProps {
  subsidiaries: Subsidiary[];
}

/**
 * 대시보드 메인 클라이언트 컴포넌트
 * 법인 선택 상태를 관리하고 지도와 카드를 조율합니다.
 */
export const DashboardClient = ({ subsidiaries }: DashboardClientProps) => {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);

  return (
    <div className="h-full flex relative">
      {/* 지도 영역 */}
      <div
        className={`transition-all duration-300 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${
          selectedSubsidiaryId ? 'w-[calc(100%-400px)] mr-2' : 'w-full'
        }`}
      >
        <WorldMap
          subsidiaries={subsidiaries}
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
  );
};

