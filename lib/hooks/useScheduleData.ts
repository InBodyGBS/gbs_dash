'use client';

/**
 * useScheduleData
 * Shared data-loading hook for the Calendar and Overview pages.
 * Extracted from app/(dashboard)/quarterly-closing/schedule/page.tsx
 */

import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { calculateAchievementRate } from '@/lib/utils/achievement-rate';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import {
  getCategoryById,
  getClosingCategoriesForMonth,
} from '@/lib/constants/closing-categories';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem, DocumentSubmission } from '@/lib/types/quarterly-closing';

const STORAGE_KEY = 'quarterly-closing-schedule-state';
const ENTITY_ORDER_KEY = 'quarterly-closing-entity-order';

// ---------------------------------------------------------------------------
// Helper: persist / restore selected year+month from localStorage
// ---------------------------------------------------------------------------
const loadSavedState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as {
        selectedYear?: string;
        selectedMonth?: string;
        selectedQuarter?: string;
      };
      let selectedMonth = parsed.selectedMonth;
      if (selectedMonth == null && parsed.selectedQuarter != null) {
        const q = parseInt(String(parsed.selectedQuarter), 10);
        const endMonthByQ: Record<number, string> = { 1: '3', 2: '6', 3: '9', 4: '12' };
        selectedMonth = endMonthByQ[q] || String(new Date().getMonth() + 1);
      }
      return {
        selectedYear: parsed.selectedYear || '2025',
        selectedMonth: selectedMonth || String(new Date().getMonth() + 1),
      };
    }
  } catch (error) {
    console.error('Failed to load saved state:', error);
  }
  return null;
};

const saveState = (state: { selectedYear: string; selectedMonth: string }) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedYear: state.selectedYear,
      selectedMonth: state.selectedMonth,
    }));
  } catch (error) {
    console.error('Failed to save state:', error);
  }
};

// ---------------------------------------------------------------------------
// Helper: entity order
// ---------------------------------------------------------------------------
const applyEntityOrder = (subs: Subsidiary[]): Subsidiary[] => {
  if (typeof window === 'undefined') return subs;
  try {
    const savedOrder = localStorage.getItem(ENTITY_ORDER_KEY);
    if (savedOrder) {
      const order: string[] = JSON.parse(savedOrder);
      return [...subs].sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
  } catch (error) {
    console.error('Failed to load entity order:', error);
  }
  return subs;
};

const saveEntityOrder = (order: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ENTITY_ORDER_KEY, JSON.stringify(order));
  } catch (error) {
    console.error('Failed to save entity order:', error);
  }
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useScheduleData() {
  const savedState = loadSavedState();

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(savedState?.selectedYear || '2025');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    savedState?.selectedMonth || String(new Date().getMonth() + 1),
  );

  // Data state
  const [quarter, setQuarter] = useState<Quarter | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [submissions, setSubmissions] = useState<DocumentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------------------------
  // ensureQuarterExists
  // -------------------------------------------------------------------------
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

      const { data: newQuarter, error: insertError } = await supabase
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
        console.error('Quarter 생성 실패:', insertError);
        toast.error(`분기 생성 실패: ${insertError.message}`);
        return null;
      }

      const quarterId = newQuarter?.id;
      if (quarterId) {
        setQuarter({ ...quarter, id: quarterId });
        return quarterId;
      }
      return null;
    } catch (error) {
      console.error('❌ ensureQuarterExists 예외:', error);
      toast.error('분기 데이터 확인 중 오류가 발생했습니다.');
      return null;
    }
  };

  // -------------------------------------------------------------------------
  // loadData
  // -------------------------------------------------------------------------
  const loadData = async () => {
    setLoading(true);
    try {
      const fiscalYear = parseInt(selectedYear, 10);
      const attributionMonth = parseInt(selectedMonth, 10) || 1;
      const calendarQuarter = Math.min(4, Math.max(1, Math.ceil(attributionMonth / 3)));

      console.log('🔍 데이터 로딩 시작...', {
        fiscalPeriod: `${selectedYear}년 ${attributionMonth}월`,
        quartersRow: `${fiscalYear}년 ${calendarQuarter}Q (DB 분기 행)`,
      });

      let quarterData: Quarter | null = null;

      const { data, error: quarterError } = await supabase
        .from('quarters')
        .select('*')
        .eq('year', fiscalYear)
        .eq('quarter', calendarQuarter)
        .maybeSingle();

      if (data) {
        quarterData = data;
        console.log('✅ 분기 데이터 조회 성공:', quarterData);
      } else {
        const quarterStartDate = new Date(fiscalYear, (calendarQuarter - 1) * 3, 1);
        const quarterEndDate = new Date(fiscalYear, calendarQuarter * 3, 0);

        quarterData = {
          id: `temp-${fiscalYear}-${calendarQuarter}`,
          year: fiscalYear,
          quarter: calendarQuarter,
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
        console.error('❌ quarterData가 생성되지 않음', {
          selectedYear,
          selectedMonth,
          fiscalYear,
          calendarQuarter,
        });
        throw new Error('날짜 범위를 선택해주세요.');
      }

      console.log('✅ 최종 quarterData:', quarterData);
      setQuarter(quarterData);

      // Subsidiaries
      const { data: subsData, error: subsError } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');

      if (subsError) throw subsError;

      const orderedSubsidiaries = applyEntityOrder(subsData || []);
      setSubsidiaries(orderedSubsidiaries);

      // Quarter id used by submissions (same calendar quarter row as schedule)
      let fiscalQuarterId: string | null = null;

      const { data: fiscalQuarterData } = await supabase
        .from('quarters')
        .select('id')
        .eq('year', fiscalYear)
        .eq('quarter', calendarQuarter)
        .maybeSingle();

      if (fiscalQuarterData) {
        fiscalQuarterId = (fiscalQuarterData as { id: string }).id;
        console.log(`✅ Quarter 조회 성공:`, { fiscalYear, calendarQuarter, fiscalQuarterId });
      } else {
        console.log(`⚠️ ${fiscalYear}년 ${calendarQuarter}Q quarter가 없습니다. 생성 시도...`);
        const quarterStartDate = new Date(fiscalYear, (calendarQuarter - 1) * 3, 1);
        const quarterEndDate = new Date(fiscalYear, calendarQuarter * 3, 0);

        const { data: newFiscalQuarter, error: insertError } = await supabase
          .from('quarters')
          .insert({
            year: fiscalYear,
            quarter: calendarQuarter,
            start_date: format(quarterStartDate, 'yyyy-MM-dd'),
            end_date: format(quarterEndDate, 'yyyy-MM-dd'),
          })
          .select('id')
          .single();

        if (insertError) {
          console.warn('Quarter 생성 실패:', insertError);
        } else {
          fiscalQuarterId = (newFiscalQuarter as { id?: string } | null)?.id ?? null;
          console.log(`✅ Quarter 생성 성공: ${fiscalQuarterId}`);
        }
      }

      // Build submissions query — fiscalQuarterId 없으면 조회 생략 (null 행 오염 방지)
      const submissionsQuery = fiscalQuarterId
        ? supabase.from('submissions').select('*').eq('quarter_id', fiscalQuarterId)
        : null;

      const preliminarySalesSGAQuery = fiscalQuarterId
        ? supabase.from('preliminary_sales_sga').select('*').eq('quarter_id', fiscalQuarterId)
        : null;

      // -----------------------------------------------------------------------
      // Branch: temp quarter vs real quarter
      // -----------------------------------------------------------------------
      if (quarterData.id.startsWith('temp-') || quarterData.id.startsWith('custom-')) {
        setScheduleItems([]);

        if (!submissionsQuery || !preliminarySalesSGAQuery) {
          setSubmissions([]);
          return;
        }

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

        type RawSubmissionRow = {
          id: string;
          quarter_id: string | null;
          subsidiary_id: string;
          category: string;
          file_name: string;
          file_path: string | null;
          file_size: number | null;
          version: number | null;
          submitted_by: string | null;
          submitted_at: string | null;
        };

        type RawPreliminarySalesSGARow = {
          subsidiary_id: string;
          quarter_id: string | null;
          updated_at: string;
        };

        const normalizeSubmission = (
          row: RawSubmissionRow,
          fallbackQuarterId: string,
        ): DocumentSubmission => ({
          id: row.id,
          quarter_id: row.quarter_id || fallbackQuarterId,
          subsidiary_id: row.subsidiary_id,
          category: row.category,
          file_name: row.file_name,
          file_path: row.file_path ?? '',
          file_size: row.file_size ?? 0,
          version: row.version ?? 1,
          submitted_by: row.submitted_by,
          submitted_at: row.submitted_at ?? '',
        });

        const submissionRows = (submissionsResult.data || []) as unknown as RawSubmissionRow[];
        const submissionDocuments = submissionRows
          .filter((item) => {
            if (!item.quarter_id) return !fiscalQuarterId;
            return item.quarter_id === fiscalQuarterId;
          })
          .map((item) => normalizeSubmission(item, fiscalQuarterId ?? ''));

        const preliminarySalesSGAData = (preliminarySalesSGAResult.data || []) as unknown as RawPreliminarySalesSGARow[];
        const preliminarySalesSubmissions = new Map<string, DocumentSubmission>();

        preliminarySalesSGAData.forEach((item) => {
          const key = `${item.subsidiary_id}_preliminary-sales`;
          if (!preliminarySalesSubmissions.has(key)) {
            const sameSubsidiary = preliminarySalesSGAData.filter((d) => d.subsidiary_id === item.subsidiary_id);
            const latestUpdate = sameSubsidiary.reduce(
              (latest, current) =>
                new Date(current.updated_at) > new Date(latest) ? current.updated_at : latest,
              item.updated_at,
            );

            preliminarySalesSubmissions.set(key, {
              id: `preliminary-sales-${item.subsidiary_id}`,
              quarter_id: item.quarter_id || (fiscalQuarterId ?? ''),
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
            (d) => d.subsidiary_id === sub.subsidiary_id && d.category === sub.category,
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
          calendarQuarter,
          fiscalQuarterId,
          submissions: mergedSubmissions.map((s) => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
        });

        setSubmissions(mergedSubmissions);
      } else {
        const [itemsResult, documentSubmissionsResult, submissionsResult, preliminarySalesSGAResult] =
          await Promise.all([
            supabase.from('schedule_items').select('*').eq('quarter_id', quarterData.id),
            supabase.from('document_submissions').select('*').eq('quarter_id', quarterData.id),
            submissionsQuery ?? Promise.resolve({ data: [], error: null }),
            preliminarySalesSGAQuery ?? Promise.resolve({ data: [], error: null }),
          ]);

        if (itemsResult.error) throw itemsResult.error;
        if (documentSubmissionsResult.error) throw documentSubmissionsResult.error;
        if (submissionsResult.error) {
          console.warn('submissions 테이블 조회 실패 (무시):', submissionsResult.error);
        }
        if (preliminarySalesSGAResult.error) {
          console.warn('preliminary_sales_sga 테이블 조회 실패 (무시):', preliminarySalesSGAResult.error);
        }

        const scheduleItemsData = (itemsResult.data || []) as unknown as ScheduleItem[];

        type RawSubmissionRow = {
          id: string;
          quarter_id: string | null;
          subsidiary_id: string;
          category: string;
          file_name: string;
          file_path: string | null;
          file_size: number | null;
          version: number | null;
          submitted_by: string | null;
          submitted_at: string | null;
        };

        type RawPreliminarySalesSGARow = {
          subsidiary_id: string;
          quarter_id: string | null;
          updated_at: string;
        };

        const normalizeSubmission = (
          row: RawSubmissionRow,
          fallbackQuarterId: string,
        ): DocumentSubmission => ({
          id: row.id,
          quarter_id: row.quarter_id || fallbackQuarterId,
          subsidiary_id: row.subsidiary_id,
          category: row.category,
          file_name: row.file_name,
          file_path: row.file_path ?? '',
          file_size: row.file_size ?? 0,
          version: row.version ?? 1,
          submitted_by: row.submitted_by,
          submitted_at: row.submitted_at ?? '',
        });

        const documentSubmissionsRows = (documentSubmissionsResult.data || []) as unknown as RawSubmissionRow[];
        const documentSubmissions = documentSubmissionsRows.map((item) =>
          normalizeSubmission(item, fiscalQuarterId ?? ''),
        );

        const submissionRows = (submissionsResult.data || []) as unknown as RawSubmissionRow[];
        const submissionDocuments = submissionRows
          .filter((item) => {
            if (!item.quarter_id) return !fiscalQuarterId;
            return item.quarter_id === fiscalQuarterId;
          })
          .map((item) => normalizeSubmission(item, fiscalQuarterId ?? ''));

        console.log(`📊 submissions 조회 결과:`, {
          fiscalYear,
          calendarQuarter,
          fiscalQuarterId,
          rawSubmissionsCount: submissionRows.length,
          filteredSubmissionsCount: submissionDocuments.length,
          rawSubmissions: submissionRows.map((s) => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
          filteredSubmissions: submissionDocuments.map((s) => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
        });

        const preliminarySalesSGAData = (preliminarySalesSGAResult.data || []) as unknown as RawPreliminarySalesSGARow[];
        const preliminarySalesSubmissions = new Map<string, DocumentSubmission>();

        preliminarySalesSGAData.forEach((item) => {
          const key = `${item.subsidiary_id}_preliminary-sales`;
          if (!preliminarySalesSubmissions.has(key)) {
            const sameSubsidiary = preliminarySalesSGAData.filter(
              (d) => d.subsidiary_id === item.subsidiary_id,
            );
            const latestUpdate = sameSubsidiary.reduce(
              (latest, current) =>
                new Date(current.updated_at) > new Date(latest) ? current.updated_at : latest,
              item.updated_at,
            );

            preliminarySalesSubmissions.set(key, {
              id: `preliminary-sales-${item.subsidiary_id}`,
              quarter_id: item.quarter_id || (fiscalQuarterId ?? ''),
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

        const mergedSubmissions = [...documentSubmissions];

        submissionDocuments.forEach((sub) => {
          const existingIndex = mergedSubmissions.findIndex(
            (d) => d.subsidiary_id === sub.subsidiary_id && d.category === sub.category,
          );
          if (existingIndex >= 0) {
            if (new Date(sub.submitted_at) > new Date(mergedSubmissions[existingIndex].submitted_at)) {
              mergedSubmissions[existingIndex] = sub;
            }
          } else {
            mergedSubmissions.push(sub);
          }
        });

        preliminarySalesSubmissions.forEach((sub) => {
          const existingIndex = mergedSubmissions.findIndex(
            (d) => d.subsidiary_id === sub.subsidiary_id && d.category === sub.category,
          );
          if (existingIndex >= 0) {
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
          calendarQuarter,
          fiscalQuarterId,
          quarterDataId: quarterData.id,
          submissions: mergedSubmissions.map((s) => ({
            id: s.id,
            category: s.category,
            subsidiary_id: s.subsidiary_id,
            quarter_id: s.quarter_id,
            file_name: s.file_name,
          })),
        });

        // Submissions → Schedule 반영
        console.log(`🔄 Submissions → Schedule 반영 시작:`, {
          scheduleItemsCount: scheduleItemsData.length,
          submissionsCount: mergedSubmissions.length,
          scheduleItems: scheduleItemsData.map((item) => ({
            id: item.id,
            quarter_id: item.quarter_id,
            subsidiary_id: item.subsidiary_id,
            category: item.category,
            status: item.status,
          })),
          submissions: mergedSubmissions.map((sub) => ({
            id: sub.id,
            quarter_id: sub.quarter_id,
            subsidiary_id: sub.subsidiary_id,
            category: sub.category,
          })),
        });

        // 1. Update existing items
        const updatedScheduleItems = scheduleItemsData.map((item: ScheduleItem) => {
          const matchingSubmissions = mergedSubmissions.filter(
            (sub) => sub.subsidiary_id === item.subsidiary_id && sub.category === item.category,
          );
          const hasSubmission = matchingSubmissions.length > 0;

          if (hasSubmission && item.status === 'planned') {
            console.log(`🔄 ScheduleItem 자동 확정:`, {
              itemId: item.id,
              quarter_id: item.quarter_id,
              subsidiary_id: item.subsidiary_id,
              category: item.category,
              previousStatus: item.status,
              matchingSubmissions: matchingSubmissions.map((s) => ({ id: s.id, quarter_id: s.quarter_id })),
            });
            return {
              ...item,
              status: 'confirmed' as const,
              confirmed_date: item.confirmed_date || new Date().toISOString().split('T')[0],
            };
          }
          return item;
        });

        // 2. Create missing items
        const itemsToCreate: Array<{
          quarter_id: string;
          subsidiary_id: string;
          category: string;
          planned_date: string;
          status: 'confirmed';
          confirmed_date: string;
        }> = [];

        mergedSubmissions.forEach((sub) => {
          const hasScheduleItem = updatedScheduleItems.some(
            (item) => item.subsidiary_id === sub.subsidiary_id && item.category === sub.category,
          );

          if (!hasScheduleItem) {
            const plannedDate = sub.submitted_at
              ? new Date(sub.submitted_at).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0];

            itemsToCreate.push({
              quarter_id: quarterData.id,
              subsidiary_id: sub.subsidiary_id,
              category: sub.category,
              planned_date: plannedDate,
              status: 'confirmed',
              confirmed_date: plannedDate,
            });
          }
        });

        // 3. DB updates
        const itemsToUpdate = updatedScheduleItems.filter(
          (item, index) => item.status !== scheduleItemsData[index]?.status,
        );

        if (itemsToUpdate.length > 0) {
          console.log(`💾 ${itemsToUpdate.length}개의 ScheduleItem을 confirmed로 업데이트합니다.`);
          try {
            const updatePromises = itemsToUpdate.map((item) =>
              supabase
                .from('schedule_items')
                .update({
                  status: 'confirmed',
                  confirmed_date: item.confirmed_date || new Date().toISOString().split('T')[0],
                })
                .eq('id', item.id),
            );
            const updateResults = await Promise.all(updatePromises);
            const errors = updateResults.filter((result) => result.error);
            if (errors.length > 0) {
              console.warn('⚠️ 일부 ScheduleItem 업데이트 실패:', errors);
            } else {
              console.log(`✅ ${itemsToUpdate.length}개의 ScheduleItem이 성공적으로 업데이트되었습니다.`);
            }
          } catch (error) {
            console.error('❌ ScheduleItem 업데이트 중 오류:', error);
          }
        }

        // 4. DB inserts
        if (itemsToCreate.length > 0) {
          console.log(`➕ ${itemsToCreate.length}개의 ScheduleItem을 자동 생성합니다.`, itemsToCreate);
          try {
            const { data: createdItems, error: createError } = await supabase
              .from('schedule_items')
              .insert(itemsToCreate)
              .select();

            if (createError) {
              console.error('❌ ScheduleItem 생성 실패:', createError);
              if (createError.code !== '23505') {
                console.warn('⚠️ ScheduleItem 생성 중 오류:', createError);
              }
            } else {
              console.log(`✅ ${createdItems?.length || 0}개의 ScheduleItem이 성공적으로 생성되었습니다.`, {
                createdItems: createdItems?.map((item) => ({
                  id: item.id,
                  quarter_id: item.quarter_id,
                  subsidiary_id: item.subsidiary_id,
                  category: item.category,
                  status: item.status,
                })),
              });
              if (createdItems) {
                updatedScheduleItems.push(...(createdItems as ScheduleItem[]));
              }
            }
          } catch (error) {
            console.error('❌ ScheduleItem 생성 중 오류:', error);
          }
        }

        console.log(`📋 최종 ScheduleItems 상태:`, {
          totalCount: updatedScheduleItems.length,
          confirmedCount: updatedScheduleItems.filter((item) => item.status === 'confirmed').length,
          plannedCount: updatedScheduleItems.filter((item) => item.status === 'planned').length,
          employeeJdItems: updatedScheduleItems
            .filter((item) => item.category === 'employee-jd')
            .map((item) => ({
              id: item.id,
              quarter_id: item.quarter_id,
              subsidiary_id: item.subsidiary_id,
              category: item.category,
              status: item.status,
            })),
        });

        setScheduleItems(updatedScheduleItems);
        setSubmissions(mergedSubmissions);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`데이터 로딩 실패: ${message || '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleCategorySelect = (categoryId: string) => {
    console.log('📝 카테고리 상태 변경:', selectedCategory, '→', categoryId);
    const newCategory = selectedCategory === categoryId ? null : categoryId;
    setSelectedCategory(newCategory);
    saveState({ selectedYear, selectedMonth });
  };

  const handleEntityOrderChange = (newOrder: Subsidiary[]) => {
    setSubsidiaries(newOrder);
    saveEntityOrder(newOrder.map((s) => s.id));
    toast.success('Entity 순서가 저장되었습니다.');
  };

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
        item.category === categoryId,
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

    const { error } = await supabase
      .from('schedule_items')
      .insert({
        quarter_id: quarterId,
        subsidiary_id: subsidiaryId,
        category: categoryId,
        planned_date: date,
        status: 'planned',
      });

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

  const handleItemDelete = async (itemId: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return;

    const { error } = await supabase
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

  const handleItemConfirm = async (itemId: string, confirmedDate: string) => {
    const { error } = await supabase
      .from('schedule_items')
      .update({ status: 'confirmed', confirmed_date: confirmedDate })
      .eq('id', itemId);

    if (error) {
      toast.error(`확정 실패: ${error.message}`);
    } else {
      toast.success(`일정이 ${format(parseISO(confirmedDate), 'yyyy년 MM월 dd일')}에 확정되었습니다.`);
      loadData();
    }
  };

  const handleCellClick = async (subsidiaryId: string, date: string) => {
    console.log('🖱️ 셀 클릭:', { subsidiaryId, date, selectedCategory, quarter });

    if (!quarter) {
      console.error('❌ Quarter가 없습니다.');
      toast.error('분기 정보가 없습니다.');
      return;
    }

    const existingItems = scheduleItems.filter(
      (item) => item.subsidiary_id === subsidiaryId && item.planned_date.startsWith(date),
    );

    console.log('📋 기존 항목:', existingItems);

    if (selectedCategory) {
      console.log('✅ 카테고리 선택됨:', selectedCategory);
      const existingCategoryItem = existingItems.find((item) => item.category === selectedCategory);

      if (existingCategoryItem) {
        if (existingCategoryItem.status === 'planned') {
          toast.info('Badge를 클릭하여 확정 날짜를 선택하세요.');
        } else {
          if (confirm('확정된 일정을 삭제하시겠습니까?')) {
            const { error } = await supabase
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

        const { data: insertedData, error } = await supabase
          .from('schedule_items')
          .insert({
            quarter_id: quarterId,
            subsidiary_id: subsidiaryId,
            category: selectedCategory,
            planned_date: date,
            status: 'planned',
          })
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

  // -------------------------------------------------------------------------
  // Excel exports
  // -------------------------------------------------------------------------
  const handleExportExcel = () => {
    if (!quarter || subsidiaries.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.');
      return;
    }

    const fy = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10) || 1;
    const monthStart = new Date(fy, monthNum - 1, 1);
    const monthEnd = new Date(fy, monthNum, 0);
    const allDates = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const ymPrefix = `${fy}-${String(monthNum).padStart(2, '0')}`;
    const activeIds = new Set(
      getClosingCategoriesForMonth(monthNum).map((c) => c.id),
    );

    const headers = ['Entity', ...allDates.map((date) => format(date, 'MM/dd')), '성사율'];

    const rows = subsidiaries.map((subsidiary) => {
      const subItems = scheduleItems.filter(
        (item) =>
          item.subsidiary_id === subsidiary.id &&
          activeIds.has(item.category) &&
          item.planned_date.startsWith(ymPrefix),
      );
      const rate = calculateAchievementRate(subItems);

      const row: string[] = [subsidiary.name.replace('InBody ', '')];

      allDates.forEach((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const items = subItems.filter((item) => item.planned_date.startsWith(dateStr));

        if (items.length > 0) {
          const categoryLabels = items
            .map((item) => {
              const category = getCategoryById(item.category);
              const status = item.status === 'confirmed' ? '✓' : '○';
              return category ? `${status}${category.label}` : '';
            })
            .filter(Boolean);
          row.push(categoryLabels.join(', '));
        } else {
          row.push('');
        }
      });

      row.push(`${rate}%`);
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 20 }, ...allDates.map(() => ({ wch: 15 })), { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

    const fileName = `Schedule_${fy}_${String(monthNum).padStart(2, '0')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('엑셀 파일이 다운로드되었습니다.');
  };

  const handleExportOverviewExcel = () => {
    if (!quarter || subsidiaries.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.');
      return;
    }

    const fy = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10) || 1;
    const ymPrefix = `${fy}-${String(monthNum).padStart(2, '0')}`;
    const activeCats = getClosingCategoriesForMonth(monthNum);
    const activeIds = new Set(activeCats.map((c) => c.id));

    const headers = ['Entity', ...activeCats.map((cat) => cat.label)];

    const rows = subsidiaries.map((subsidiary) => {
      const row: string[] = [subsidiary.name.replace('InBody ', '')];
      activeCats.forEach((category) => {
        const hasItem = scheduleItems.some(
          (item) =>
            item.subsidiary_id === subsidiary.id &&
            item.category === category.id &&
            activeIds.has(item.category) &&
            item.planned_date.startsWith(ymPrefix),
        );
        row.push(hasItem ? 'O' : 'X');
      });
      return row;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 20 }, ...activeCats.map(() => ({ wch: 15 }))];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Overview');

    const fileName = `Overview_${fy}_${String(monthNum).padStart(2, '0')}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('엑셀 파일이 다운로드되었습니다.');
  };

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------
  useEffect(() => {
    saveState({ selectedYear, selectedMonth });
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth]);

  // -------------------------------------------------------------------------
  // Computed values
  // -------------------------------------------------------------------------
  const activeClosingCategories = useMemo(
    () => getClosingCategoriesForMonth(parseInt(selectedMonth, 10) || 1),
    [selectedMonth],
  );

  const scheduleItemsScopedToMonth = useMemo(() => {
    const fy = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10) || 1;
    const ymPrefix = `${fy}-${String(monthNum).padStart(2, '0')}`;
    const activeIds = new Set(activeClosingCategories.map((c) => c.id));
    return scheduleItems.filter(
      (item) => activeIds.has(item.category) && item.planned_date.startsWith(ymPrefix),
    );
  }, [scheduleItems, selectedYear, selectedMonth, activeClosingCategories]);

  const submissionsScopedToMonth = useMemo(() => {
    const fy = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10) || 1;
    const ymPrefix = `${fy}-${String(monthNum).padStart(2, '0')}`;
    const activeIds = new Set(activeClosingCategories.map((c) => c.id));
    return submissions.filter((sub) => {
      if (!activeIds.has(sub.category)) return false;
      const dateStr = (sub.submitted_at || '').split('T')[0];
      return dateStr.startsWith(ymPrefix);
    });
  }, [submissions, selectedYear, selectedMonth, activeClosingCategories]);

  const filteredScheduleItems = selectedCategory
    ? scheduleItemsScopedToMonth.filter((item) => item.category === selectedCategory)
    : scheduleItemsScopedToMonth;

  const filteredSubmissions = selectedCategory
    ? submissionsScopedToMonth.filter((sub) => sub.category === selectedCategory)
    : submissionsScopedToMonth;

  const achievementRate = calculateAchievementRate(filteredScheduleItems);

  return {
    // state
    quarter,
    subsidiaries,
    scheduleItems,
    submissions,
    loading,
    selectedYear,
    selectedMonth,
    activeClosingCategories,
    selectedCategory,
    selectedEntityId,
    // setters
    setSelectedYear,
    setSelectedMonth,
    setSelectedCategory,
    setSelectedEntityId,
    // handlers
    handleCategorySelect,
    handleEntityOrderChange,
    handleCategoryDrop,
    handleItemDelete,
    handleItemConfirm,
    handleCellClick,
    refetch: loadData,
    // excel
    handleExportExcel,
    handleExportOverviewExcel,
    // computed
    filteredScheduleItems,
    filteredSubmissions,
    submissionsScopedToMonth,
    achievementRate,
  };
}
