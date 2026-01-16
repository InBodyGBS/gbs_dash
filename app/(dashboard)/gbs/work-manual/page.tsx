'use client';

/**
 * GBS - 업무기술서 페이지
 * 업무 기술서 관리 및 조회
 */

import { useState, useEffect } from 'react';
import { WorkManualUpload } from '@/components/gbs/WorkManualUpload';
import { WorkManualList } from '@/components/gbs/WorkManualList';
import { WorkManualViewer } from '@/components/gbs/WorkManualViewer';
import { getWorkManuals } from '@/lib/services/workManualService';
import type { WorkManual } from '@/lib/types/work-manual';

export default function WorkManualPage() {
  const [selectedManual, setSelectedManual] = useState<WorkManual | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 초기 로드 시 '업무기술서' 타입의 첫 번째 파일 자동 선택
  useEffect(() => {
    const loadDefaultManual = async () => {
      try {
        const manuals = await getWorkManuals('업무기술서');
        if (manuals.length > 0 && !selectedManual) {
          setSelectedManual(manuals[0]);
        }
      } catch (error) {
        console.error('Failed to load default manual:', error);
      }
    };

    loadDefaultManual();
  }, [refreshKey]); // refreshKey가 변경될 때마다 다시 시도

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900">
          업무기술서
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6 space-y-6">
        {/* 파일 업로드 영역 */}
        <WorkManualUpload 
          onUploadSuccess={() => setRefreshKey(prev => prev + 1)} 
        />

        {/* 업로드된 파일 목록 */}
        <WorkManualList
          key={refreshKey}
          onSelect={setSelectedManual}
          selectedId={selectedManual?.id || null}
        />

        {/* 문서 내용 표시 - 기본적으로 '업무기술서' 타입 문서 표시 */}
        {selectedManual ? (
          <WorkManualViewer manual={selectedManual} />
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">표시할 업무기술서가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
