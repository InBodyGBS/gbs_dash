'use client';

/**
 * GBS - 업무분장표 페이지
 * 업무 분장표 관리 및 조회
 */

import { useState, useEffect, useMemo } from 'react';
import { getWorkManuals, getWorkManualUrl } from '@/lib/services/workManualService';
import { WorkAssignmentCard } from '@/components/gbs/WorkAssignmentCard';
import { WorkAssignmentDialog } from '@/components/gbs/WorkAssignmentDialog';
import { parseWorkAssignmentFile } from '@/lib/utils/parseWorkAssignment';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { WorkManual } from '@/lib/types/work-manual';
import type { WorkAssignment } from '@/lib/utils/parseWorkAssignment';

export default function WorkAssignmentPage() {
  const [manuals, setManuals] = useState<WorkManual[]>([]);
  const [assignments, setAssignments] = useState<WorkAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<WorkAssignment | null>(null);
  const [filterSheet, setFilterSheet] = useState<string>('전체');

  useEffect(() => {
    const loadManuals = async () => {
      try {
        setLoading(true);
        // 모든 파일을 조회하고 클라이언트에서 필터링 (file_type이 잘못 저장된 경우 대비)
        const allData = await getWorkManuals();
        console.log('Loaded all work manuals:', allData.length);
        console.log('File types:', allData.map(d => ({ name: d.file_name, type: d.file_type })));
        
        // 업무분장표 타입만 필터링 (file_type이 null이거나 없는 경우도 포함)
        const data = allData.filter(d => 
          d.file_type === '업무분장표' || 
          d.file_type === null || 
          d.file_type === undefined
        );
        console.log('Filtered work assignments:', data.length);
        console.log('Filtered file types:', data.map(d => ({ name: d.file_name, type: d.file_type })));
        setManuals(data);
        
        // 모든 파일의 내용 파싱 (Excel 및 Word 모두 지원)
        const allAssignments: WorkAssignment[] = [];
        for (const manual of data) {
          try {
            console.log(`Processing file: ${manual.file_name}, type: ${manual.file_type}`);
            if (manual.file_name.endsWith('.xlsx') || manual.file_name.endsWith('.docx')) {
              const fileUrl = await getWorkManualUrl(manual.file_path);
              const response = await fetch(fileUrl);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                console.log(`Parsing file: ${manual.file_name}, size: ${arrayBuffer.byteLength}`);
                const parsed = await parseWorkAssignmentFile(arrayBuffer, manual.file_name);
                console.log(`Parsed ${parsed.length} assignments from ${manual.file_name}`);
                allAssignments.push(...parsed);
              } else {
                console.error(`Failed to fetch file ${manual.file_name}: ${response.status} ${response.statusText}`);
              }
            } else {
              console.warn(`Skipping file ${manual.file_name}: not .xlsx or .docx`);
            }
          } catch (error) {
            console.error(`Failed to parse ${manual.file_name}:`, error);
            toast.error(`파일 파싱 실패: ${manual.file_name}`, {
              description: (error as Error).message || '파일 내용을 읽는 중 오류가 발생했습니다.',
            });
          }
        }
        console.log(`Total assignments parsed: ${allAssignments.length}`);
        setAssignments(allAssignments);
      } catch (error: any) {
        console.error('Failed to load work assignments:', error);
        toast.error('파일 목록 로드 실패', {
          description: error.message || '업무분장표 목록을 불러오는 중 오류가 발생했습니다.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadManuals();
  }, []);

  // 시트명 목록 추출 (유형별 필터링용)
  const sheetNames = useMemo(() => {
    const sheets = new Set<string>();
    assignments.forEach(a => {
      if (a.sheetName) {
        sheets.add(a.sheetName);
      }
    });
    return Array.from(sheets).sort();
  }, [assignments]);

  // 필터링된 업무 분장 목록 (시트별)
  const filteredAssignments = useMemo(() => {
    if (filterSheet === '전체') {
      return assignments;
    }
    return assignments.filter(a => a.sheetName === filterSheet);
  }, [assignments, filterSheet]);

  // 시트별 통계
  const sheetStats = useMemo(() => {
    const stats: Record<string, number> = {};
    assignments.forEach(a => {
      const sheet = a.sheetName || '기타';
      stats[sheet] = (stats[sheet] || 0) + 1;
    });
    return stats;
  }, [assignments]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
        <div className="mb-6 flex-shrink-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">업무분장표</h1>
          <p className="text-gray-600">GBS 업무 분장표를 관리하고 조회합니다</p>
        </div>
        <div className="flex-1 overflow-y-auto pb-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#971B2F' }}></div>
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">업무분장표</h1>
        <p className="text-gray-600">GBS 업무 분장표를 관리하고 조회합니다</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {manuals.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <p className="text-lg font-semibold text-gray-900 mb-2">업무분장표가 없습니다</p>
              <p className="text-sm text-gray-600 mb-4">
                업무기술서 페이지에서 업무분장표 타입으로 파일을 업로드하세요.
              </p>
              <p className="text-xs text-gray-500">
                {loading ? '로딩 중...' : '현재 업로드된 업무분장표 파일이 없습니다.'}
              </p>
            </div>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <p className="text-lg font-semibold text-gray-900 mb-2">파싱된 데이터가 없습니다</p>
              <p className="text-sm text-gray-600">
                업무분장표 파일을 파싱할 수 없습니다. Excel 파일 형식을 확인해주세요.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 시트별 필터 탭 */}
            <Tabs value={filterSheet} onValueChange={setFilterSheet}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="전체">
                  전체 ({assignments.length})
                </TabsTrigger>
                {sheetNames.map((sheetName) => (
                  <TabsTrigger key={sheetName} value={sheetName}>
                    {sheetName} ({sheetStats[sheetName] || 0})
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 카드 그리드 */}
            {filteredAssignments.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <p className="text-gray-600">선택한 유형에 해당하는 업무 분장이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredAssignments.map((assignment) => (
                  <WorkAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onClick={() => setSelectedAssignment(assignment)}
                    showSheetName={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상세 정보 다이얼로그 */}
      <WorkAssignmentDialog
        open={selectedAssignment !== null}
        onClose={() => setSelectedAssignment(null)}
        assignment={selectedAssignment}
      />
    </div>
  );
}
