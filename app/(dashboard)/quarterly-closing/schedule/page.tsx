'use client';

/**
 * Quarterly Closing - Schedule 페이지
 * 분기별 결산 일정 관리 및 성사율 추적
 */

import { useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CategoryBar } from '@/components/quarterly-closing/CategoryBar';
import { ScheduleGrid } from '@/components/quarterly-closing/ScheduleGrid';
import { calculateAchievementRate } from '@/lib/utils/achievement-rate';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { getCategoryById, CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { cn } from '@/lib/utils';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem, DocumentSubmission } from '@/lib/types/quarterly-closing';
import { OverviewGrid } from '@/components/quarterly-closing/OverviewGrid';
import { SubmissionLogTable } from '@/components/quarterly-closing/SubmissionLogTable';
import { SubmissionSummary } from '@/components/quarterly-closing/SubmissionSummary';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const STORAGE_KEY = 'quarterly-closing-schedule-state';
const ENTITY_ORDER_KEY = 'quarterly-closing-entity-order';

export default function SchedulePage() {
  // localStorage에서 저장된 상태 복원
  const loadSavedState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          selectedYear: parsed.selectedYear || '2025',
          selectedQuarter: parsed.selectedQuarter || '1',
        };
      }
    } catch (error) {
      console.error('Failed to load saved state:', error);
    }
    return null;
  };

  // 상태 저장
  const saveState = (state: {
    selectedYear: string;
    selectedQuarter: string;
  }) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedYear: state.selectedYear,
        selectedQuarter: state.selectedQuarter,
      }));
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  };

  const savedState = loadSavedState();
  
  // 필터 상태
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(savedState?.selectedYear || '2025');
  const [selectedQuarter, setSelectedQuarter] = useState<string>(savedState?.selectedQuarter || '1');
  
  // 데이터 상태
  const [quarter, setQuarter] = useState<Quarter | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'submissions'>('overview');

  // Entity 순서 적용
  const applyEntityOrder = (subs: Subsidiary[]): Subsidiary[] => {
    if (typeof window === 'undefined') return subs;
    try {
      const savedOrder = localStorage.getItem(ENTITY_ORDER_KEY);
      if (savedOrder) {
        const order: string[] = JSON.parse(savedOrder);
        const ordered = [...subs].sort((a, b) => {
          const indexA = order.indexOf(a.id);
          const indexB = order.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
        return ordered;
      }
    } catch (error) {
      console.error('Failed to load entity order:', error);
    }
    return subs;
  };

  // Entity 순서 저장
  const saveEntityOrder = (order: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(ENTITY_ORDER_KEY, JSON.stringify(order));
    } catch (error) {
      console.error('Failed to save entity order:', error);
    }
  };

  // 귀속연도에서 업무 기간(Year/Quarter) 계산
  // 귀속연도가 2025년 4Q → 업무 기간: 2026년 1Q
  // 귀속연도가 2026년 1Q → 업무 기간: 2026년 2Q
  // 귀속연도가 2026년 2Q → 업무 기간: 2026년 3Q
  // 귀속연도가 2026년 3Q → 업무 기간: 2026년 4Q
  // 귀속연도가 2026년 4Q → 업무 기간: 2027년 1Q
  const calculateWorkPeriod = (fiscalYear: string, fiscalQuarter: string): { year: number; quarter: number } => {
    const year = parseInt(fiscalYear);
    const quarter = parseInt(fiscalQuarter);
    
    if (quarter === 4) {
      return { year: year + 1, quarter: 1 };
    } else {
      return { year, quarter: quarter + 1 };
    }
  };

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      // 귀속연도에서 업무 기간 계산
      const workPeriod = calculateWorkPeriod(selectedYear, selectedQuarter);
      console.log('🔍 데이터 로딩 시작...', { 
        fiscalPeriod: `${selectedYear}년 ${selectedQuarter}Q`,
        workPeriod: `${workPeriod.year}년 ${workPeriod.quarter}Q`
      });

      let quarterData: Quarter | null = null;

      const { data, error: quarterError } = await supabase
        .from('quarters')
        .select('*')
        .eq('year', workPeriod.year)
        .eq('quarter', workPeriod.quarter)
        .maybeSingle();

      if (data) {
        quarterData = data;
        console.log('✅ 분기 데이터 조회 성공:', quarterData);
      } else {
        const quarterStartDate = new Date(workPeriod.year, (workPeriod.quarter - 1) * 3, 1);
        const quarterEndDate = new Date(workPeriod.year, workPeriod.quarter * 3, 0);
        
        quarterData = {
          id: `temp-${workPeriod.year}-${workPeriod.quarter}`,
          year: workPeriod.year,
          quarter: workPeriod.quarter,
          start_date: format(quarterStartDate, 'yyyy-MM-dd'),
          end_date: format(quarterEndDate, 'yyyy-MM-dd'),
          created_at: new Date().toISOString(),
        };
        console.log('⚠️ 분기 데이터 없음, 임시 생성:', quarterData);
        
        if (quarterError) {
          console.warn('Supabase 조회 에러 (임시 데이터 사용):', quarterError);
        }
      }

      if (!quarterData) {
        console.error('❌ quarterData가 생성되지 않음', { selectedYear, selectedQuarter, workPeriod });
        throw new Error('날짜 범위를 선택해주세요.');
      }
      
      console.log('✅ 최종 quarterData:', quarterData);
      setQuarter(quarterData);

      // 법인 데이터
      const { data: subsData, error: subsError } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');

      if (subsError) throw subsError;
      
      const orderedSubsidiaries = applyEntityOrder(subsData || []);
      setSubsidiaries(orderedSubsidiaries);

      // 귀속연도에 해당하는 quarter_id 찾기 (Submission 페이지에서 사용하는 quarter_id)
      // quarterData가 temp-여도 submissions는 조회해야 함
      const fiscalYear = parseInt(selectedYear);
      const fiscalQuarter = parseInt(selectedQuarter);
      
      let fiscalQuarterId: string | null = null;
      
      // Quarter 조회
      const { data: fiscalQuarterData, error: fiscalQuarterError } = await supabase
        .from('quarters')
        .select('id')
        .eq('year', fiscalYear)
        .eq('quarter', fiscalQuarter)
        .maybeSingle();

      if (fiscalQuarterData) {
        fiscalQuarterId = (fiscalQuarterData as any).id;
        console.log(`✅ 귀속연도 Quarter 조회 성공:`, {
          fiscalYear,
          fiscalQuarter,
          fiscalQuarterId,
        });
      } else {
        // Quarter가 없으면 생성 시도
        console.log(`⚠️ 귀속연도 ${fiscalYear}년 ${fiscalQuarter}Q의 quarter가 없습니다. 생성 시도...`);
        const quarterStartDate = new Date(fiscalYear, (fiscalQuarter - 1) * 3, 1);
        const quarterEndDate = new Date(fiscalYear, fiscalQuarter * 3, 0);
        
        const { data: newFiscalQuarter, error: insertError } = await (supabase as any)
          .from('quarters')
          .insert({
            year: fiscalYear,
            quarter: fiscalQuarter,
            start_date: format(quarterStartDate, 'yyyy-MM-dd'),
            end_date: format(quarterEndDate, 'yyyy-MM-dd'),
          })
          .select('id')
          .single();

        if (insertError) {
          console.warn('Quarter 생성 실패:', insertError);
          // 생성 실패해도 계속 진행 (quarter_id가 null인 submissions도 조회)
        } else {
          fiscalQuarterId = (newFiscalQuarter as any)?.id;
          console.log(`✅ Quarter 생성 성공: ${fiscalQuarterId}`);
        }
      }

      // submissions 조회 쿼리 구성 (quarterData가 temp-여도 조회해야 함)
      // fiscalQuarterId가 있으면 해당 ID와 일치하는 것만 조회
      // null인 것은 제외 (다른 귀속연도와 혼동 방지)
      let submissionsQuery = supabase
        .from('submissions')
        .select('*');
      
      if (fiscalQuarterId) {
        // fiscalQuarterId가 있으면 해당 ID와 일치하는 것만 조회
        submissionsQuery = submissionsQuery.eq('quarter_id', fiscalQuarterId);
      } else {
        // fiscalQuarterId가 없으면 null인 경우만 조회 (제출 시 quarter가 없었던 경우)
        submissionsQuery = submissionsQuery.is('quarter_id', null);
      }

      // Preliminary Sales/SG&A 데이터 조회 (preliminary-sales 카테고리용)
      let preliminarySalesSGAQuery = supabase
        .from('preliminary_sales_sga')
        .select('*');
      
      if (fiscalQuarterId) {
        preliminarySalesSGAQuery = preliminarySalesSGAQuery.eq('quarter_id', fiscalQuarterId);
      } else {
        preliminarySalesSGAQuery = preliminarySalesSGAQuery.is('quarter_id', null);
      }

      // 스케줄 항목 (quarter_id가 실제로 존재하는 경우만)
      if (quarterData.id.startsWith('temp-') || quarterData.id.startsWith('custom-')) {
        setScheduleItems([]);
        // submissions는 별도로 조회
        const [submissionsResult, preliminarySalesSGAResult] = await Promise.all([
          submissionsQuery,
          preliminarySalesSGAQuery,
        ]);

        if (submissionsResult.error) {
          console.warn('submissions 테이블 조회 실패 (무시):', submissionsResult.error);
        }
        if (preliminarySalesSGAResult.error) {
          console.warn('preliminary_sales_sga 테이블 조회 실패 (무시):', preliminarySalesSGAResult.error);
        }

        // submissions 처리
        const submissionDocuments = ((submissionsResult.data || []) as any[])
          .filter((item: any) => {
            if (!item.quarter_id) {
              return !fiscalQuarterId;
            }
            return item.quarter_id === fiscalQuarterId;
          })
          .map((item: any) => ({
            id: item.id,
            quarter_id: item.quarter_id || fiscalQuarterId,
            subsidiary_id: item.subsidiary_id,
            category: item.category,
            file_name: item.file_name,
            file_path: item.file_path,
            file_size: item.file_size,
            version: item.version,
            submitted_by: item.submitted_by,
            submitted_at: item.submitted_at,
          }));

        // Preliminary Sales/SG&A 처리
        const preliminarySalesSGAData = (preliminarySalesSGAResult.data || []) as any[];
        const preliminarySalesSubmissions = new Map<string, any>();
        
        preliminarySalesSGAData.forEach((item: any) => {
          const key = `${item.subsidiary_id}_preliminary-sales`;
          if (!preliminarySalesSubmissions.has(key)) {
            const sameSubsidiary = preliminarySalesSGAData.filter(
              (d: any) => d.subsidiary_id === item.subsidiary_id
            );
            const latestUpdate = sameSubsidiary.reduce((latest: string, current: any) => {
              return new Date(current.updated_at) > new Date(latest) ? current.updated_at : latest;
            }, item.updated_at);
            
            preliminarySalesSubmissions.set(key, {
              id: `preliminary-sales-${item.subsidiary_id}`,
              quarter_id: item.quarter_id || fiscalQuarterId,
              subsidiary_id: item.subsidiary_id,
              category: 'preliminary-sales',
              file_name: 'Preliminary Sales/SG&A',
              file_path: '',
              file_size: 0,
              version: 1,
              submitted_by: null,
              submitted_at: latestUpdate,
            });
          }
        });

        const mergedSubmissions = [...submissionDocuments];
        preliminarySalesSubmissions.forEach((sub) => {
          const existingIndex = mergedSubmissions.findIndex(
            (d) => d.subsidiary_id === sub.subsidiary_id && d.category === sub.category
          );
          if (existingIndex >= 0) {
            if (new Date(sub.submitted_at) > new Date(mergedSubmissions[existingIndex].submitted_at)) {
              mergedSubmissions[existingIndex] = sub;
            }
          } else {
            mergedSubmissions.push(sub);
          }
        });

        console.log(`📊 최종 merged submissions (temp quarter):`, {
          totalCount: mergedSubmissions.length,
          fiscalYear,
          fiscalQuarter,
          fiscalQuarterId,
          submissions: mergedSubmissions.map(s => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
        });

        setSubmissions(mergedSubmissions);
      } else {
        const [itemsResult, documentSubmissionsResult, submissionsResult, preliminarySalesSGAResult] = await Promise.all([
          supabase
            .from('schedule_items')
            .select('*')
            .eq('quarter_id', quarterData.id),
          supabase
            .from('document_submissions')
            .select('*')
            .eq('quarter_id', quarterData.id),
          // Submission 페이지에서 제출한 데이터 조회
          submissionsQuery,
          // Preliminary Sales/SG&A 데이터 조회
          preliminarySalesSGAQuery,
        ]);

        if (itemsResult.error) throw itemsResult.error;
        if (documentSubmissionsResult.error) throw documentSubmissionsResult.error;
        if (submissionsResult.error) {
          // submissions 테이블이 없을 수 있으므로 에러는 무시
          console.warn('submissions 테이블 조회 실패 (무시):', submissionsResult.error);
        }
        if (preliminarySalesSGAResult.error) {
          // preliminary_sales_sga 테이블이 없을 수 있으므로 에러는 무시
          console.warn('preliminary_sales_sga 테이블 조회 실패 (무시):', preliminarySalesSGAResult.error);
        }
        
        setScheduleItems(itemsResult.data || []);
        
        // document_submissions와 submissions를 합쳐서 DocumentSubmission 형식으로 변환
        const documentSubmissions = (documentSubmissionsResult.data || []).map((item: any) => ({
          id: item.id,
          quarter_id: item.quarter_id,
          subsidiary_id: item.subsidiary_id,
          category: item.category,
          file_name: item.file_name,
          file_path: item.file_path,
          file_size: item.file_size,
          version: item.version,
          submitted_by: item.submitted_by,
          submitted_at: item.submitted_at,
        }));
        
        // submissions를 DocumentSubmission 형식으로 변환
        // quarter_id가 null인 경우는 제외 (다른 귀속연도와 혼동 방지)
        // 단, fiscalQuarterId가 null인 경우는 포함 (제출 시 quarter가 없었던 경우)
        const submissionDocuments = ((submissionsResult.data || []) as any[])
          .filter((item: any) => {
            // quarter_id가 null이면 fiscalQuarterId도 null인 경우만 포함
            if (!item.quarter_id) {
              return !fiscalQuarterId;
            }
            // quarter_id가 있으면 fiscalQuarterId와 일치하는 경우만 포함
            return item.quarter_id === fiscalQuarterId;
          })
          .map((item: any) => ({
            id: item.id,
            quarter_id: item.quarter_id || fiscalQuarterId, // null이면 fiscalQuarterId로 설정
            subsidiary_id: item.subsidiary_id,
            category: item.category,
            file_name: item.file_name,
            file_path: item.file_path,
            file_size: item.file_size,
            version: item.version,
            submitted_by: item.submitted_by,
            submitted_at: item.submitted_at,
          }));
        
        console.log(`📊 submissions 조회 결과:`, {
          fiscalYear,
          fiscalQuarter,
          fiscalQuarterId,
          rawSubmissionsCount: (submissionsResult.data || []).length,
          filteredSubmissionsCount: submissionDocuments.length,
          rawSubmissions: (submissionsResult.data || []).map((s: any) => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
          filteredSubmissions: submissionDocuments.map(s => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
        });
        
        // Preliminary Sales/SG&A 데이터를 submissions 형식으로 변환
        // 각 subsidiary별로 데이터가 하나라도 있으면 제출된 것으로 간주
        const preliminarySalesSGAData = (preliminarySalesSGAResult.data || []) as any[];
        const preliminarySalesSubmissions = new Map<string, any>();
        
        preliminarySalesSGAData.forEach((item: any) => {
          const key = `${item.subsidiary_id}_preliminary-sales`;
          if (!preliminarySalesSubmissions.has(key)) {
            // 가장 최근 업데이트 시간을 찾기
            const sameSubsidiary = preliminarySalesSGAData.filter(
              (d: any) => d.subsidiary_id === item.subsidiary_id
            );
            const latestUpdate = sameSubsidiary.reduce((latest: string, current: any) => {
              return new Date(current.updated_at) > new Date(latest) ? current.updated_at : latest;
            }, item.updated_at);
            
            preliminarySalesSubmissions.set(key, {
              id: `preliminary-sales-${item.subsidiary_id}`,
              quarter_id: item.quarter_id || fiscalQuarterId,
              subsidiary_id: item.subsidiary_id,
              category: 'preliminary-sales',
              file_name: 'Preliminary Sales/SG&A',
              file_path: '',
              file_size: 0,
              version: 1,
              submitted_by: null,
              submitted_at: latestUpdate,
            });
          }
        });
        
        // 두 배열을 합치되, 같은 (subsidiary_id, category) 조합이면 submissions를 우선
        const mergedSubmissions = [...documentSubmissions];
        
        // submissions 추가
        submissionDocuments.forEach((sub) => {
          const existingIndex = mergedSubmissions.findIndex(
            (d) => d.subsidiary_id === sub.subsidiary_id && d.category === sub.category
          );
          if (existingIndex >= 0) {
            // submissions가 더 최신이면 교체
            if (new Date(sub.submitted_at) > new Date(mergedSubmissions[existingIndex].submitted_at)) {
              mergedSubmissions[existingIndex] = sub;
            }
          } else {
            mergedSubmissions.push(sub);
          }
        });
        
        // Preliminary Sales/SG&A 추가
        preliminarySalesSubmissions.forEach((sub) => {
          const existingIndex = mergedSubmissions.findIndex(
            (d) => d.subsidiary_id === sub.subsidiary_id && d.category === sub.category
          );
          if (existingIndex >= 0) {
            // preliminary-sales가 더 최신이면 교체
            if (new Date(sub.submitted_at) > new Date(mergedSubmissions[existingIndex].submitted_at)) {
              mergedSubmissions[existingIndex] = sub;
            }
          } else {
            mergedSubmissions.push(sub);
          }
        });
        
        console.log(`📊 최종 merged submissions:`, {
          totalCount: mergedSubmissions.length,
          fiscalYear,
          fiscalQuarter,
          fiscalQuarterId,
          quarterDataId: quarterData.id,
          submissions: mergedSubmissions.map(s => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
        });
        
        setSubmissions(mergedSubmissions);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error(`데이터 로딩 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // Quarter를 Supabase에 생성하는 헬퍼 함수
  const ensureQuarterExists = async (): Promise<string | null> => {
    console.log('🔍 ensureQuarterExists 시작:', quarter);
    
    if (!quarter) {
      console.error('❌ Quarter가 없습니다.');
      return null;
    }

    if (!quarter.id.startsWith('temp-') && !quarter.id.startsWith('custom-')) {
      console.log('✅ 실제 Quarter ID 사용:', quarter.id);
      return quarter.id;
    }

    console.log('⚠️ 임시 Quarter ID 감지, Supabase에서 확인/생성:', quarter.id);

    try {
      console.log('🔎 기존 Quarter 조회:', { year: quarter.year, quarter: quarter.quarter });
      
      const { data: existingQuarter, error: checkError } = await supabase
        .from('quarters')
        .select('id')
        .eq('year', quarter.year)
        .eq('quarter', quarter.quarter)
        .maybeSingle();

      if (checkError) {
        console.error('❌ Quarter 조회 중 에러:', checkError);
      }

      if (existingQuarter) {
        const quarterId = (existingQuarter as { id: string }).id;
        console.log('✅ Quarter 이미 존재:', quarterId);
        setQuarter({ ...quarter, id: quarterId });
        return quarterId;
      }

      console.log('➕ 새 Quarter 생성 시도:', {
        year: quarter.year,
        quarter: quarter.quarter,
        start_date: quarter.start_date,
        end_date: quarter.end_date,
      });

      // @ts-ignore - quarters 타입 정의 필요
      const { data: newQuarter, error: insertError } = await (supabase as any)
        .from('quarters')
        .insert({
          year: quarter.year,
          quarter: quarter.quarter,
          start_date: quarter.start_date,
          end_date: quarter.end_date,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Quarter 생성 실패:', insertError);
        toast.error(`분기 생성 실패: ${insertError.message}`);
        return null;
      }

      console.log('✅ Quarter 생성 성공:', newQuarter);
      const quarterId = (newQuarter as { id: string })?.id;
      if (quarterId) {
        setQuarter({ ...quarter, id: quarterId });
        return quarterId;
      }
      return null;
    } catch (error: any) {
      console.error('❌ ensureQuarterExists 예외:', error);
      toast.error('분기 데이터 확인 중 오류가 발생했습니다.');
      return null;
    }
  };

  // 카테고리 선택 핸들러
  const handleCategorySelect = (categoryId: string) => {
    console.log('📝 카테고리 상태 변경:', selectedCategory, '→', categoryId);
    const newCategory = selectedCategory === categoryId ? null : categoryId;
    setSelectedCategory(newCategory);
    saveState({
      selectedYear,
      selectedQuarter,
    });
  };


  // Entity 순서 변경 핸들러
  const handleEntityOrderChange = (newOrder: Subsidiary[]) => {
    setSubsidiaries(newOrder);
    saveEntityOrder(newOrder.map(s => s.id));
    toast.success('Entity 순서가 저장되었습니다.');
  };


  // 카테고리 드롭 핸들러
  const handleCategoryDrop = async (subsidiaryId: string, date: string, categoryId: string) => {
    console.log('🎯 카테고리 드롭:', { subsidiaryId, date, categoryId, quarter });
    
    if (!quarter) {
      toast.error('분기 정보가 없습니다.');
      return;
    }

    const existingItems = scheduleItems.filter(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        item.planned_date.startsWith(date) &&
        item.category === categoryId
    );

    if (existingItems.length > 0) {
      const existingItem = existingItems[0];
      if (existingItem.status === 'planned') {
        toast.info('Badge를 클릭하여 확정 날짜를 선택하세요.');
      } else {
        toast.info('이미 확정된 일정입니다.');
      }
      return;
    }

    const quarterId = await ensureQuarterExists();
    if (!quarterId) {
      toast.error('분기 데이터를 생성할 수 없습니다.');
      return;
    }

    const { error } = await (supabase as any)
      .from('schedule_items')
      .insert({
        quarter_id: quarterId,
        subsidiary_id: subsidiaryId,
        category: categoryId,
        planned_date: date,
        status: 'planned',
      } as any);

    if (error) {
      console.error('❌ Schedule item 추가 실패:', error);
      if (error.code === '23505') {
        toast.error('이미 해당 카테고리가 추가되어 있습니다.');
      } else {
        toast.error(`추가 실패: ${error.message}`);
      }
    } else {
      toast.success('일정이 추가되었습니다.');
      loadData();
    }
  };

  // 항목 삭제 핸들러
  const handleItemDelete = async (itemId: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) {
      return;
    }

    const { error } = await (supabase as any)
      .from('schedule_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error(`삭제 실패: ${error.message}`);
    } else {
      toast.success('일정이 삭제되었습니다.');
      loadData();
    }
  };

  // 항목 확정 핸들러
  const handleItemConfirm = async (itemId: string, confirmedDate: string) => {
    const { error } = await (supabase as any)
      .from('schedule_items')
      .update({
        status: 'confirmed',
        confirmed_date: confirmedDate,
      } as any)
      .eq('id', itemId);

    if (error) {
      toast.error(`확정 실패: ${error.message}`);
    } else {
      toast.success(`일정이 ${format(parseISO(confirmedDate), 'yyyy년 MM월 dd일')}에 확정되었습니다.`);
      loadData();
    }
  };

  // Calendar 탭용 엑셀 다운로드 핸들러
  const handleExportExcel = () => {
    if (!quarter || subsidiaries.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.');
      return;
    }

    const allDates = eachDayOfInterval({
      start: parseISO(quarter.start_date),
      end: parseISO(quarter.end_date),
    });

    const headers = ['Entity', ...allDates.map(date => format(date, 'MM/dd')), '성사율'];

    const rows = subsidiaries.map((subsidiary) => {
      const achievementRate = calculateAchievementRate(
        scheduleItems.filter(item => item.subsidiary_id === subsidiary.id)
      );
      
      const row: any[] = [subsidiary.name.replace('InBody ', '')];
      
      allDates.forEach((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const items = scheduleItems.filter(
          (item) =>
            item.subsidiary_id === subsidiary.id &&
            item.planned_date.startsWith(dateStr)
        );
        
        if (items.length > 0) {
          const categoryLabels = items.map(item => {
            const category = getCategoryById(item.category as any);
            const status = item.status === 'confirmed' ? '✓' : '○';
            return category ? `${status}${category.label}` : '';
          }).filter(Boolean);
          row.push(categoryLabels.join(', '));
        } else {
          row.push('');
        }
      });
      
      row.push(`${achievementRate}%`);
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    const colWidths = [
      { wch: 20 },
      ...allDates.map(() => ({ wch: 15 })),
      { wch: 10 },
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    
    const fileName = `Schedule_${quarter.year}Q${quarter.quarter}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success('엑셀 파일이 다운로드되었습니다.');
  };

  // Overview 탭용 엑셀 다운로드 핸들러
  const handleExportOverviewExcel = () => {
    if (!quarter || subsidiaries.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.');
      return;
    }
    
    // 헤더: Entity + 각 카테고리
    const headers = ['Entity', ...CLOSING_CATEGORIES.map((cat) => cat.label)];

    // 각 Entity별로 행 생성
    const rows = subsidiaries.map((subsidiary) => {
      const row: any[] = [subsidiary.name.replace('InBody ', '')];
      
      // 각 카테고리별로 스케줄 항목 존재 여부 확인
      CLOSING_CATEGORIES.forEach((category) => {
        const hasItem = scheduleItems.some(
          (item) =>
            item.subsidiary_id === subsidiary.id &&
            item.category === category.id &&
            item.quarter_id === quarter.id
        );
        row.push(hasItem ? 'O' : 'X');
      });
      
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    const colWidths = [
      { wch: 20 }, // Entity
      ...CLOSING_CATEGORIES.map(() => ({ wch: 15 })), // 각 카테고리
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Overview');
    
    const fileName = `Overview_${quarter.year}Q${quarter.quarter}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success('엑셀 파일이 다운로드되었습니다.');
  };

  // 엑셀 다운로드 통합 핸들러
  const handleExport = () => {
    if (activeTab === 'overview') {
      handleExportOverviewExcel();
    } else {
      handleExportExcel();
    }
  };

  // 셀 클릭 핸들러
  const handleCellClick = async (subsidiaryId: string, date: string) => {
    console.log('🖱️ 셀 클릭:', { subsidiaryId, date, selectedCategory, quarter });
    
    if (!quarter) {
      console.error('❌ Quarter가 없습니다.');
      toast.error('분기 정보가 없습니다.');
      return;
    }

    const existingItems = scheduleItems.filter(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        item.planned_date.startsWith(date)
    );

    console.log('📋 기존 항목:', existingItems);

    if (selectedCategory) {
      console.log('✅ 카테고리 선택됨:', selectedCategory);
      const existingCategoryItem = existingItems.find(
        (item) => item.category === selectedCategory
      );

      if (existingCategoryItem) {
        if (existingCategoryItem.status === 'planned') {
          toast.info('Badge를 클릭하여 확정 날짜를 선택하세요.');
        } else {
          if (confirm('확정된 일정을 삭제하시겠습니까?')) {
            const { error } = await (supabase as any)
              .from('schedule_items')
              .delete()
              .eq('id', existingCategoryItem.id);

            if (!error) {
              toast.success('일정이 삭제되었습니다.');
              loadData();
            } else {
              toast.error(`삭제 실패: ${error.message}`);
            }
          }
        }
      } else {
        console.log('🔄 Quarter 확인 시작...');
        const quarterId = await ensureQuarterExists();
        console.log('📌 Quarter ID:', quarterId);
        
        if (!quarterId) {
          console.error('❌ Quarter ID를 가져올 수 없습니다.');
          toast.error('분기 데이터를 생성할 수 없습니다.');
          return;
        }

        console.log('➕ Schedule item 추가 시도:', {
          quarter_id: quarterId,
          subsidiary_id: subsidiaryId,
          category: selectedCategory,
          planned_date: date,
          status: 'planned',
        });

        const { data: insertedData, error } = await (supabase as any)
          .from('schedule_items')
          .insert({
            quarter_id: quarterId,
            subsidiary_id: subsidiaryId,
            category: selectedCategory,
            planned_date: date,
            status: 'planned',
          } as any)
          .select();

        if (error) {
          console.error('❌ Schedule item 추가 실패:', error);
          if (error.code === '23505') {
            toast.error('이미 해당 카테고리가 추가되어 있습니다.');
          } else {
            toast.error(`추가 실패: ${error.message}`);
          }
        } else {
          console.log('✅ Schedule item 추가 성공:', insertedData);
          toast.success('일정이 추가되었습니다.');
          loadData();
        }
      }
    } else if (existingItems.length > 0) {
      console.log('ℹ️ 카테고리 미선택 (항목 있음)');
      toast.info('좌측에서 카테고리를 선택하여 일정을 추가하거나 수정하세요.');
    } else {
      console.log('ℹ️ 카테고리 미선택 (항목 없음)');
      toast.info('좌측에서 카테고리를 먼저 선택하세요.');
    }
  };

  // 상태 변경 시 저장
  useEffect(() => {
    saveState({
      selectedYear,
      selectedQuarter,
    });
  }, [selectedYear, selectedQuarter]);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [selectedYear, selectedQuarter]);

  // 필터링된 스케줄 항목
  const filteredScheduleItems = selectedCategory
    ? scheduleItems.filter((item) => item.category === selectedCategory)
    : scheduleItems;

  const achievementRate = calculateAchievementRate(filteredScheduleItems);

  // 업무 기간 계산 (귀속연도에서 다음 분기)
  const workPeriod = useMemo(() => {
    return calculateWorkPeriod(selectedYear, selectedQuarter);
  }, [selectedYear, selectedQuarter]);


  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#971B2F' }} />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Quarter 없을 때
  if (!quarter) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">분기 데이터를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* 메인 영역 */}
      <div className="flex-1 p-6 overflow-auto">
        {/* 상단 헤더 */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>
              {selectedCategory && (
                <p className="text-sm text-gray-600 mt-1">
                  필터: {getCategoryById(selectedCategory as any)?.label || selectedCategory}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-6 px-2 text-xs"
                    onClick={() => setSelectedCategory(null)}
                  >
                    필터 해제
                  </Button>
                </p>
              )}
            </div>

            {/* 전체 성사율 */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  {selectedCategory ? '필터된 성사율' : '전체 성사율'}
                </p>
                <p className="text-3xl font-bold" style={{ color: '#971B2F' }}>{achievementRate}%</p>
              </div>

              <Button 
                variant="outline" 
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* 귀속연도 선택 및 카테고리 (Overview 및 Calendar 탭 공통) */}
          <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-lg mb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">귀속연도:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => 2020 + i).map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1Q</SelectItem>
                  <SelectItem value="2">2Q</SelectItem>
                  <SelectItem value="3">3Q</SelectItem>
                  <SelectItem value="4">4Q</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* 카테고리 바 - Calendar 탭에서만 표시 */}
            {activeTab === 'calendar' && (
              <CategoryBar
                selectedCategory={selectedCategory}
                onCategorySelect={handleCategorySelect}
                onItemDelete={handleItemDelete}
              />
            )}
          </div>
        </div>

        {/* Overview / Calendar / Submissions 탭 */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'calendar' | 'submissions')}>
          <TabsList className="mb-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-6">
            {/* 제출 현황 필터 */}
            {submissions.length > 0 && (
              <div className="space-y-4">
                <SubmissionSummary 
                  submissions={submissions} 
                  subsidiaries={subsidiaries}
                  onEntityFilter={setSelectedEntityId}
                  onCategoryFilter={setSelectedCategory}
                  selectedEntityId={selectedEntityId}
                  selectedCategoryId={selectedCategory}
                />
                {/* 필터 초기화 버튼 */}
                {(selectedEntityId || selectedCategory) && (
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedEntityId(null);
                        setSelectedCategory(null);
                      }}
                    >
                      필터 초기화
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Overview 그리드 */}
            {quarter && (
              <div className="bg-white rounded-lg border p-4">
                <OverviewGrid
                  quarter={quarter}
                  subsidiaries={selectedEntityId 
                    ? subsidiaries.filter(s => s.id === selectedEntityId)
                    : subsidiaries}
                  scheduleItems={scheduleItems}
                  submissions={submissions}
                  selectedCategory={selectedCategory}
                  onEntityOrderChange={handleEntityOrderChange}
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            {/* 스케줄 그리드 */}
            <ScheduleGrid
              quarter={quarter}
              subsidiaries={subsidiaries}
              scheduleItems={filteredScheduleItems}
              submissions={submissions}
              selectedCategory={selectedCategory}
              onCellClick={handleCellClick}
              onCategoryDrop={handleCategoryDrop}
              onItemDelete={handleItemDelete}
              onItemConfirm={handleItemConfirm}
              onEntityOrderChange={handleEntityOrderChange}
            />
          </TabsContent>

          <TabsContent value="submissions" className="mt-0">
            {/* 제출 로그 테이블 */}
            <SubmissionLogTable
              selectedYear={selectedYear}
              selectedQuarter={selectedQuarter}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
