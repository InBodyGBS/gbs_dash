'use client';

/**
 * Financial Result 페이지
 * 해외법인 재무 실적 분석 및 리포팅
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FinancialResultUpload } from '@/components/financial-result/FinancialResultUpload';
import { QuarterComparisonTable } from '@/components/financial-result/QuarterComparisonTable';
import {
  getFinancialResultFiles,
  getFinancialResultDataByFile,
  getQuarterComparison,
  getAllFinancialEntities,
} from '@/lib/services/financialResultService';
import type { FinancialResultFile, QuarterComparison } from '@/lib/types/financial-result';
import { toast } from 'sonner';

export default function FinancialResultPage() {
  const [files, setFiles] = useState<FinancialResultFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<FinancialResultFile | null>(null);
  const [comparisonData, setComparisonData] = useState<QuarterComparison[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [allEntities, setAllEntities] = useState<Array<{ entity: string; subsidiaryName: string | null }>>([]);

  // 파일 목록 로드
  const loadFiles = async () => {
    try {
      setLoading(true);
      const fileList = await getFinancialResultFiles();
      setFiles(fileList);
      
      // 가장 최근 파일 선택
      if (fileList.length > 0 && !selectedFile) {
        const latestFile = fileList[0];
        setSelectedFile(latestFile);
        const period = `${latestFile.fiscal_year}${latestFile.quarter}Q`;
        setSelectedPeriod(period);
      }
    } catch (error: any) {
      console.error('Load Files Error:', error);
      toast.error('파일 목록 로드 실패', {
        description: error.message || '파일 목록을 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 증감표 데이터 로드
  const loadComparisonData = async (period: string, entity?: string) => {
    if (!period) return;
    
    try {
      setLoading(true);
      const data = await getQuarterComparison(period, entity || undefined);
      setComparisonData(data);
    } catch (error: any) {
      console.error('Load Comparison Data Error:', error);
      toast.error('증감표 데이터 로드 실패', {
        description: error.message || '증감표 데이터를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 모든 Entity 목록 로드
  const loadAllEntities = async () => {
    try {
      const entities = await getAllFinancialEntities();
      setAllEntities(entities);
    } catch (error: any) {
      console.error('Load All Entities Error:', error);
      // 에러가 발생해도 계속 진행
    }
  };

  useEffect(() => {
    loadFiles();
    loadAllEntities();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      loadComparisonData(selectedPeriod, selectedEntity || undefined);
    }
  }, [selectedPeriod, selectedEntity]);

  // 고유 Entity 목록 추출 (subsidiary name 매핑 포함)
  // allEntities를 우선 사용하고, 없으면 comparisonData에서 추출
  const uniqueEntities = useMemo(() => {
    if (allEntities.length > 0) {
      return allEntities.map(({ entity, subsidiaryName }) => ({
        entity,
        name: subsidiaryName || entity,
      })).sort((a, b) => a.entity.localeCompare(b.entity));
    }
    
    // allEntities가 없으면 comparisonData에서 추출
    const entityMap = new Map<string, string>(); // entity -> subsidiary name
    comparisonData.forEach((item) => {
      if (!entityMap.has(item.entity)) {
        entityMap.set(item.entity, item.subsidiaryName || item.entity);
      }
    });
    return Array.from(entityMap.entries())
      .map(([entity, name]) => ({ entity, name }))
      .sort((a, b) => a.entity.localeCompare(b.entity));
  }, [allEntities, comparisonData]);

  // 고유 Period 목록 추출
  const uniquePeriods = Array.from(
    new Set(files.map((f) => `${f.fiscal_year}${f.quarter}Q`))
  ).sort((a, b) => b.localeCompare(a)); // 최신순

  const handleUploadSuccess = () => {
    loadFiles();
    toast.success('업로드 완료', {
      description: '파일이 성공적으로 업로드되었습니다.',
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Result</h1>
          <p className="text-gray-500 mt-2">해외법인 재무 실적 분석 및 리포팅</p>
        </div>
        <Button
          onClick={loadFiles}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          {loading ? (
            <span className="mr-2 inline-block animate-spin">⟳</span>
          ) : (
            <span className="mr-2">⟳</span>
          )}
          새로고침
        </Button>
      </div>

      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">파일 업로드</TabsTrigger>
          <TabsTrigger value="analysis">분기별 증감표</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <FinancialResultUpload onUploadSuccess={handleUploadSuccess} />
          
          {files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>업로드된 파일 목록</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        setSelectedFile(file);
                        const period = `${file.fiscal_year}${file.quarter}Q`;
                        setSelectedPeriod(period);
                      }}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.file_name}</p>
                        <p className="text-xs text-gray-500">
                          {file.fiscal_year}년 {file.quarter}분기 ·{' '}
                          {(file.file_size / 1024 / 1024).toFixed(2)} MB ·{' '}
                          {new Date(file.uploaded_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>분기별 증감표 분석</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    분석 대상 분기
                  </label>
                  <Select
                    value={selectedPeriod}
                    onValueChange={(value) => {
                      setSelectedPeriod(value);
                      setSelectedEntity(''); // Entity 초기화
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="분기를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniquePeriods.map((period) => (
                        <SelectItem key={period} value={period}>
                          {period}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Entity 필터 (선택)
                  </label>
                  <Select
                    value={selectedEntity || 'all'}
                    onValueChange={(value) => setSelectedEntity(value === 'all' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="전체" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">전체</SelectItem>
                      {uniqueEntities.map(({ entity, name }) => (
                        <SelectItem key={entity} value={entity}>
                          {name || entity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading && comparisonData.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-400">
                <p>데이터를 불러오는 중...</p>
              </CardContent>
            </Card>
          ) : (
            <QuarterComparisonTable
              data={comparisonData}
              entity={selectedEntity || undefined}
              showEntityColumn={!selectedEntity}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
