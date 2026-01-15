'use client';

/**
 * System Management 페이지
 * 시스템 현황 그리드 관리
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { SystemGrid } from '@/components/system/SystemGrid';
import type { Subsidiary } from '@/lib/supabase/types';
import type { System } from '@/lib/types/system';
import { getSystems } from '@/lib/services/systemService';

export default function SystemPage() {
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);

      // 법인 및 시스템 데이터 병렬 로드
      const [subsidiariesData, systemsData] = await Promise.all([
        supabase.from('subsidiaries').select('*').order('name'),
        getSystems(),
      ]);

      setSubsidiaries(subsidiariesData.data || []);
      setSystems(systemsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Management</h1>
        <p className="text-sm text-gray-600 mt-1">법인별 IT 시스템 현황 관리</p>
      </div>

      {/* 컨텐츠 영역 */}
      <SystemGrid subsidiaries={subsidiaries} systems={systems} onUpdate={loadData} />
    </div>
  );
}
