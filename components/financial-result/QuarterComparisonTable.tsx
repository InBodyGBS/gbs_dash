'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import type { QuarterComparison } from '@/lib/types/financial-result';
import { REV_ACCOUNT_ORDER } from '@/lib/types/financial-result';
import { formatKRW } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface QuarterComparisonTableProps {
  data: QuarterComparison[];
  entity?: string;
  showEntityColumn?: boolean;
}

export function QuarterComparisonTable({
  data,
  entity,
  showEntityColumn = false,
}: QuarterComparisonTableProps) {
  // Entity별, 계정별 데이터 그룹화
  const entityData = useMemo(() => {
    const grouped = new Map<string, Map<string, QuarterComparison>>();
    
    data.forEach((item) => {
      if (!grouped.has(item.entity)) {
        grouped.set(item.entity, new Map());
      }
      grouped.get(item.entity)!.set(item.revAccount, item);
    });

    return grouped;
  }, [data]);

  // Entity → Subsidiary Name 매핑
  const entityToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((item) => {
      if (item.subsidiaryName) {
        map.set(item.entity, item.subsidiaryName);
      } else {
        // subsidiary name이 없으면 entity 그대로 사용
        if (!map.has(item.entity)) {
          map.set(item.entity, item.entity);
        }
      }
    });
    return map;
  }, [data]);

  // 고유 Entity 목록 추출 및 정렬
  const entities = useMemo(() => {
    const entityList = Array.from(entityData.keys());
    // Entity 순서 정의 (노트북 파일 참고)
    const ENTITY_ORDER = [
      'HQ', 'USA', 'Japan', 'China', 'Europe', 'Asia', 'India', 
      'Mexico', 'Oceania', 'BWA', 'Vietnam', 'Turkey', 'KOROT', 
      '헬스케어', '삼한정공', 'KOCP', '연결조정', '합계'
    ];
    
    const sorted = entityList.sort((a, b) => {
      const indexA = ENTITY_ORDER.indexOf(a);
      const indexB = ENTITY_ORDER.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return sorted;
  }, [entityData]);

  // Entity 표시 이름 가져오기 (subsidiary name 우선, 없으면 entity)
  const getEntityDisplayName = (entity: string): string => {
    return entityToNameMap.get(entity) || entity;
  };

  // 계정별 데이터 집계 (Entity별)
  const getAccountData = (account: string, entityName: string) => {
    const entityMap = entityData.get(entityName);
    if (!entityMap) return null;
    return entityMap.get(account) || null;
  };

  // QoQ, YoY(Q), YoY(Y) 데이터 계산
  const calculateAnalysisData = () => {
    const qoqData = new Map<string, Map<string, { base: number; compare: number; change: number; rate: number | null }>>();
    const yoyqData = new Map<string, Map<string, { base: number; compare: number; change: number; rate: number | null }>>();
    const yoyyData = new Map<string, Map<string, { base: number; compare: number; change: number; rate: number | null }>>();

    entities.forEach((entityName) => {
      qoqData.set(entityName, new Map());
      yoyqData.set(entityName, new Map());
      yoyyData.set(entityName, new Map());

      REV_ACCOUNT_ORDER.forEach((account) => {
        const item = getAccountData(account, entityName);
        if (!item) return;

        // QoQ
        const qoqBase = item.previousAmount || 0;
        const qoqCompare = item.currentAmount;
        const qoqChange = item.qoqChange || 0;
        const qoqRate = item.qoqChangePercent;
        qoqData.get(entityName)!.set(account, { base: qoqBase, compare: qoqCompare, change: qoqChange, rate: qoqRate });

        // YoY(Q)
        const yoyqBase = item.previousYearAmount || 0;
        const yoyqCompare = item.currentAmount;
        const yoyqChange = item.yoyChange || 0;
        const yoyqRate = item.yoyChangePercent;
        yoyqData.get(entityName)!.set(account, { base: yoyqBase, compare: yoyqCompare, change: yoyqChange, rate: yoyqRate });

        // YoY(Y) - 누적 데이터는 현재 분기 누적값이 필요하지만, 일단 YoY(Q)와 동일하게 처리
        yoyyData.get(entityName)!.set(account, { base: yoyqBase, compare: yoyqCompare, change: yoyqChange, rate: yoyqRate });
      });
    });

    return { qoqData, yoyqData, yoyyData };
  };

  const { qoqData, yoyqData, yoyyData } = calculateAnalysisData();

  const formatValue = (value: number): string => {
    return formatKRW(value);
  };

  const formatChange = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${formatKRW(value)}`;
  };

  const formatRate = (rate: number | null): string => {
    if (rate === null) return '-';
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(2)}%`;
  };

  const getChangeColor = (value: number): string => {
    if (value > 0) return 'bg-green-50 text-green-700';
    if (value < 0) return 'bg-red-50 text-red-700';
    return '';
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-400">
          <p>표시할 데이터가 없습니다.</p>
        </CardContent>
      </Card>
    );
  }

  const period = data[0]?.period || '';
  const prevPeriod = data[0]?.fiscalYear && data[0]?.quarter 
    ? `${data[0].fiscalYear - (data[0].quarter === 1 ? 1 : 0)}${data[0].quarter === 1 ? 4 : data[0].quarter - 1}Q`
    : '';
  const yoyPeriod = data[0]?.fiscalYear && data[0]?.quarter
    ? `${data[0].fiscalYear - 1}${data[0].quarter}Q`
    : '';

  // 필터링된 Entity 목록
  const displayEntities = entity ? [entity] : entities;
  
  // 표시용 Entity 이름 목록 (subsidiary name 우선) - useMemo로 최적화
  const displayEntityNames = useMemo(() => {
    return displayEntities.map((e) => getEntityDisplayName(e));
  }, [displayEntities, entityToNameMap]);

  // Excel 다운로드 함수
  const downloadExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // QoQ 분석 시트
      const qoqSheetData: any[][] = [];
      
      // QoQ Base
      qoqSheetData.push([`QoQ 분석: ${prevPeriod}`]);
      qoqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = qoqData.get(entityName)?.get(account);
          row.push(item ? item.base : 0);
        });
        qoqSheetData.push(row);
      });
      qoqSheetData.push([]);

      // QoQ Compare
      qoqSheetData.push([`QoQ 분석: ${period}`]);
      qoqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = qoqData.get(entityName)?.get(account);
          row.push(item ? item.compare : 0);
        });
        qoqSheetData.push(row);
      });
      qoqSheetData.push([]);

      // QoQ Change
      qoqSheetData.push([`QoQ 분석: 증감액 (${prevPeriod} → ${period})`]);
      qoqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = qoqData.get(entityName)?.get(account);
          row.push(item ? item.change : 0);
        });
        qoqSheetData.push(row);
      });
      qoqSheetData.push([]);

      // QoQ Rate
      qoqSheetData.push([`QoQ 분석: 증감률(%) (${prevPeriod} → ${period})`]);
      qoqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = qoqData.get(entityName)?.get(account);
          row.push(item && item.rate !== null ? item.rate : null);
        });
        qoqSheetData.push(row);
      });

      const qoqWs = XLSX.utils.aoa_to_sheet(qoqSheetData);
      XLSX.utils.book_append_sheet(wb, qoqWs, 'QoQ 분석');

      // YoY(Q) 분석 시트
      const yoyqSheetData: any[][] = [];
      
      yoyqSheetData.push([`YoY(Q) 분석: ${yoyPeriod}`]);
      yoyqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyqData.get(entityName)?.get(account);
          row.push(item ? item.base : 0);
        });
        yoyqSheetData.push(row);
      });
      yoyqSheetData.push([]);

      yoyqSheetData.push([`YoY(Q) 분석: ${period}`]);
      yoyqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyqData.get(entityName)?.get(account);
          row.push(item ? item.compare : 0);
        });
        yoyqSheetData.push(row);
      });
      yoyqSheetData.push([]);

      yoyqSheetData.push([`YoY(Q) 분석: 증감액 (${yoyPeriod} → ${period})`]);
      yoyqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyqData.get(entityName)?.get(account);
          row.push(item ? item.change : 0);
        });
        yoyqSheetData.push(row);
      });
      yoyqSheetData.push([]);

      yoyqSheetData.push([`YoY(Q) 분석: 증감률(%) (${yoyPeriod} → ${period})`]);
      yoyqSheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyqData.get(entityName)?.get(account);
          row.push(item && item.rate !== null ? item.rate : null);
        });
        yoyqSheetData.push(row);
      });

      const yoyqWs = XLSX.utils.aoa_to_sheet(yoyqSheetData);
      XLSX.utils.book_append_sheet(wb, yoyqWs, 'YoY(Q) 분석');

      // YoY(Y) 분석 시트
      const yoyySheetData: any[][] = [];
      
      yoyySheetData.push([`YoY(Y) 분석: ${yoyPeriod}(누적)`]);
      yoyySheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyyData.get(entityName)?.get(account);
          row.push(item ? item.base : 0);
        });
        yoyySheetData.push(row);
      });
      yoyySheetData.push([]);

      yoyySheetData.push([`YoY(Y) 분석: ${period}(누적)`]);
      yoyySheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyyData.get(entityName)?.get(account);
          row.push(item ? item.compare : 0);
        });
        yoyySheetData.push(row);
      });
      yoyySheetData.push([]);

      yoyySheetData.push([`YoY(Y) 분석: 증감액 (${yoyPeriod} → ${period})`]);
      yoyySheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyyData.get(entityName)?.get(account);
          row.push(item ? item.change : 0);
        });
        yoyySheetData.push(row);
      });
      yoyySheetData.push([]);

      yoyySheetData.push([`YoY(Y) 분석: 증감률(%) (${yoyPeriod} → ${period})`]);
      yoyySheetData.push(['계정', ...displayEntityNames]);
      REV_ACCOUNT_ORDER.forEach((account) => {
        const row = [account];
        displayEntities.forEach((entityName) => {
          const item = yoyyData.get(entityName)?.get(account);
          row.push(item && item.rate !== null ? item.rate : null);
        });
        yoyySheetData.push(row);
      });

      const yoyyWs = XLSX.utils.aoa_to_sheet(yoyySheetData);
      XLSX.utils.book_append_sheet(wb, yoyyWs, 'YoY(Y) 분석');

      // 파일 다운로드
      const fileName = `분기별_증감표_${period}${entity ? `_${entity}` : ''}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success('다운로드 완료', {
        description: `${fileName} 파일이 다운로드되었습니다.`,
      });
    } catch (error: any) {
      console.error('Excel Download Error:', error);
      toast.error('다운로드 실패', {
        description: error.message || 'Excel 파일 생성 중 오류가 발생했습니다.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* 다운로드 버튼 */}
      <div className="flex justify-end">
        <Button onClick={downloadExcel} variant="outline" size="sm">
          <span className="mr-2">📥</span>
          Excel 다운로드
        </Button>
      </div>

      {/* QoQ 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">QoQ 분석: {prevPeriod} → {period}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 overflow-x-auto overflow-y-auto max-h-[600px]">
            {/* QoQ Base */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">QoQ 분석: {prevPeriod}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = qoqData.get(entityName)?.get(account);
                        return (
                          <TableCell key={entityName} className="text-right">
                            {data ? formatValue(data.base) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* QoQ Compare */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">QoQ 분석: {period}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = qoqData.get(entityName)?.get(account);
                        return (
                          <TableCell key={entityName} className="text-right">
                            {data ? formatValue(data.compare) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* QoQ Change */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">QoQ 분석: 증감액 ({prevPeriod} → {period})</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = qoqData.get(entityName)?.get(account);
                        return (
                          <TableCell 
                            key={entityName} 
                            className={cn('text-right', data && getChangeColor(data.change))}
                          >
                            {data ? formatChange(data.change) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* QoQ Rate */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">QoQ 분석: 증감률(%) ({prevPeriod} → {period})</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = qoqData.get(entityName)?.get(account);
                        return (
                          <TableCell 
                            key={entityName} 
                            className={cn('text-right', data && data.rate !== null && getChangeColor(data.rate))}
                          >
                            {data ? formatRate(data.rate) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YoY(Q) 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">YoY(Q) 분석: {yoyPeriod} → {period}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 overflow-x-auto overflow-y-auto max-h-[600px]">
            {/* YoY(Q) Base */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Q) 분석: {yoyPeriod}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyqData.get(entityName)?.get(account);
                        return (
                          <TableCell key={entityName} className="text-right">
                            {data ? formatValue(data.base) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* YoY(Q) Compare */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Q) 분석: {period}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyqData.get(entityName)?.get(account);
                        return (
                          <TableCell key={entityName} className="text-right">
                            {data ? formatValue(data.compare) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* YoY(Q) Change */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Q) 분석: 증감액 ({yoyPeriod} → {period})</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyqData.get(entityName)?.get(account);
                        return (
                          <TableCell 
                            key={entityName} 
                            className={cn('text-right', data && getChangeColor(data.change))}
                          >
                            {data ? formatChange(data.change) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* YoY(Q) Rate */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Q) 분석: 증감률(%) ({yoyPeriod} → {period})</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyqData.get(entityName)?.get(account);
                        return (
                          <TableCell 
                            key={entityName} 
                            className={cn('text-right', data && data.rate !== null && getChangeColor(data.rate))}
                          >
                            {data ? formatRate(data.rate) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YoY(Y) 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">YoY(Y) 분석: {yoyPeriod}(누적) → {period}(누적)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 overflow-x-auto overflow-y-auto max-h-[600px]">
            {/* YoY(Y) Base */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Y) 분석: {yoyPeriod}(누적)</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyyData.get(entityName)?.get(account);
                        return (
                          <TableCell key={entityName} className="text-right">
                            {data ? formatValue(data.base) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* YoY(Y) Compare */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Y) 분석: {period}(누적)</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyyData.get(entityName)?.get(account);
                        return (
                          <TableCell key={entityName} className="text-right">
                            {data ? formatValue(data.compare) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* YoY(Y) Change */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Y) 분석: 증감액 ({yoyPeriod} → {period})</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyyData.get(entityName)?.get(account);
                        return (
                          <TableCell 
                            key={entityName} 
                            className={cn('text-right', data && getChangeColor(data.change))}
                          >
                            {data ? formatChange(data.change) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* YoY(Y) Rate */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">YoY(Y) 분석: 증감률(%) ({yoyPeriod} → {period})</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계정</TableHead>
                    {displayEntities.map((entityName) => (
                      <TableHead key={entityName} className="text-right">{getEntityDisplayName(entityName)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {REV_ACCOUNT_ORDER.map((account) => (
                    <TableRow key={account}>
                      <TableCell className="font-medium">{account}</TableCell>
                      {displayEntities.map((entityName) => {
                        const data = yoyyData.get(entityName)?.get(account);
                        return (
                          <TableCell 
                            key={entityName} 
                            className={cn('text-right', data && data.rate !== null && getChangeColor(data.rate))}
                          >
                            {data ? formatRate(data.rate) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
