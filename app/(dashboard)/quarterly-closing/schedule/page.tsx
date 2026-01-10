'use client';

/**
 * Quarterly Closing - Schedule 페이지
 * 분기별 결산 일정 관리 및 성사율 추적
 */

import { useState, useEffect } from 'react';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { CategorySidebar } from '@/components/quarterly-closing/CategorySidebar';
import { ScheduleGrid } from '@/components/quarterly-closing/ScheduleGrid';
import { calculateAchievementRate } from '@/lib/utils/achievement-rate';
import { format, addDays, differenceInDays, eachDayOfInterval, parseISO } from 'date-fns';
import { getCategoryById } from '@/lib/constants/closing-categories';
import { cn } from '@/lib/utils';
import type { Subsidiary } from '@/lib/supabase/types';
import type { Quarter, ScheduleItem } from '@/lib/types/quarterly-closing';
import type { DateRange } from 'react-day-picker';

export default function SchedulePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 카테고리 선택 핸들러 (디버깅용 로그 추가)
  const handleCategorySelect = (categoryId: string) => {
    console.log('📝 카테고리 상태 변경:', selectedCategory, '→', categoryId);
    setSelectedCategory(categoryId);
  };
  
  // 필터 상태
  const [selectedYear, setSelectedYear] = useState<string>('2025');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('1');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filterMode, setFilterMode] = useState<'quarter' | 'custom'>('quarter');
  
  const [quarter, setQuarter] = useState<Quarter | null>(null);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, [selectedYear, selectedQuarter, dateRange, filterMode]);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔍 데이터 로딩 시작...', { filterMode, selectedYear, selectedQuarter, dateRange });

      let quarterData: Quarter | null = null;

      if (filterMode === 'quarter') {
        // Quarter 모드: Supabase에서 분기 데이터 조회
        const { data, error: quarterError } = await supabase
          .from('quarters')
          .select('*')
          .eq('year', parseInt(selectedYear))
          .eq('quarter', parseInt(selectedQuarter))
          .maybeSingle();

        if (data) {
          // Supabase에 분기 데이터가 있으면 사용
          quarterData = data;
          console.log('✅ 분기 데이터 조회 성공:', quarterData);
        } else {
          // 분기 데이터가 없으면 자동 생성
          const quarterStartDate = new Date(parseInt(selectedYear), (parseInt(selectedQuarter) - 1) * 3, 1);
          const quarterEndDate = new Date(parseInt(selectedYear), parseInt(selectedQuarter) * 3, 0);
          
          quarterData = {
            id: `temp-${selectedYear}-${selectedQuarter}`,
            year: parseInt(selectedYear),
            quarter: parseInt(selectedQuarter),
            start_date: format(quarterStartDate, 'yyyy-MM-dd'),
            end_date: format(quarterEndDate, 'yyyy-MM-dd'),
            created_at: new Date().toISOString(),
          };
          console.log('⚠️ 분기 데이터 없음, 임시 생성:', quarterData);
          
          if (quarterError) {
            console.warn('Supabase 조회 에러 (임시 데이터 사용):', quarterError);
          }
        }
      } else if (filterMode === 'custom' && dateRange?.from) {
        // Custom 모드: Date Range 사용
        const startDate = dateRange.from;
        const endDate = dateRange.to || startDate;
        
        quarterData = {
          id: `custom-${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}`,
          year: startDate.getFullYear(),
          quarter: Math.floor(startDate.getMonth() / 3) + 1,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          created_at: new Date().toISOString(),
        };
        console.log('✅ Custom Date Range:', quarterData);
      }

      if (!quarterData) {
        console.error('❌ quarterData가 생성되지 않음', { filterMode, selectedYear, selectedQuarter, dateRange });
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
      setSubsidiaries(subsData || []);

      // 스케줄 항목 (quarter_id가 실제로 존재하는 경우만)
      if (quarterData.id.startsWith('temp-') || quarterData.id.startsWith('custom-')) {
        // 임시 또는 커스텀 quarter는 스케줄 항목 없음
        setScheduleItems([]);
      } else {
        const { data: itemsData, error: itemsError } = await supabase
          .from('schedule_items')
          .select('*')
          .eq('quarter_id', quarterData.id);

        if (itemsError) throw itemsError;
        setScheduleItems(itemsData || []);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error(`데이터 로딩 실패: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // Date Range 변경 핸들러
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (!range?.from) {
      setDateRange(undefined);
      return;
    }

    // 시작일만 선택된 경우
    if (!range.to) {
      setDateRange(range);
      // 시작일 기준으로 Quarter 자동 선택
      const quarter = Math.floor(range.from.getMonth() / 3) + 1;
      setSelectedQuarter(quarter.toString());
      return;
    }

    // 60일 제한 검사
    const daysDiff = differenceInDays(range.to, range.from);
    if (daysDiff > 60) {
      toast.error('날짜 범위는 최대 60일까지 선택 가능합니다.');
      // 시작일로부터 60일로 제한
      const limitedEndDate = addDays(range.from, 60);
      setDateRange({ from: range.from, to: limitedEndDate });
    } else {
      setDateRange(range);
    }

    // 시작일 기준으로 Quarter 자동 선택
    const quarter = Math.floor(range.from.getMonth() / 3) + 1;
    setSelectedQuarter(quarter.toString());
  };

  // Quarter를 Supabase에 생성하는 헬퍼 함수
  const ensureQuarterExists = async (): Promise<string | null> => {
    console.log('🔍 ensureQuarterExists 시작:', quarter);
    
    if (!quarter) {
      console.error('❌ Quarter가 없습니다.');
      return null;
    }

    // 이미 실제 quarter ID가 있으면 그대로 사용
    if (!quarter.id.startsWith('temp-') && !quarter.id.startsWith('custom-')) {
      console.log('✅ 실제 Quarter ID 사용:', quarter.id);
      return quarter.id;
    }

    console.log('⚠️ 임시 Quarter ID 감지, Supabase에서 확인/생성:', quarter.id);

    // 임시 quarter인 경우 Supabase에 생성
    try {
      console.log('🔎 기존 Quarter 조회:', { year: quarter.year, quarter: quarter.quarter });
      
      // @ts-ignore - quarters 타입 정의 필요
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
        // 이미 존재하면 ID 반환
        const quarterId = (existingQuarter as { id: string }).id;
        console.log('✅ Quarter 이미 존재:', quarterId);
        // State 업데이트
        setQuarter({ ...quarter, id: quarterId });
        return quarterId;
      }

      console.log('➕ 새 Quarter 생성 시도:', {
        year: quarter.year,
        quarter: quarter.quarter,
        start_date: quarter.start_date,
        end_date: quarter.end_date,
      });

      // 존재하지 않으면 생성
      const { data: newQuarter, error: insertError } = await supabase
        .from('quarters')
        // @ts-ignore - quarters 타입 정의 필요
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
        console.error('에러 코드:', insertError.code);
        console.error('에러 상세:', insertError.details);
        console.error('에러 메시지:', insertError.message);
        toast.error(`분기 생성 실패: ${insertError.message}`);
        return null;
      }

      console.log('✅ Quarter 생성 성공:', newQuarter);
      // 생성된 quarter로 업데이트
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

  // 카테고리 드롭 핸들러
  const handleCategoryDrop = async (subsidiaryId: string, date: string, categoryId: string) => {
    console.log('🎯 카테고리 드롭:', { subsidiaryId, date, categoryId, quarter });
    
    if (!quarter) {
      toast.error('분기 정보가 없습니다.');
      return;
    }

    // 해당 셀의 기존 항목들 찾기
    const existingItems = scheduleItems.filter(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        item.planned_date.startsWith(date) &&
        item.category === categoryId
    );

    // 이미 존재하면 토글
    if (existingItems.length > 0) {
      const existingItem = existingItems[0];
      if (existingItem.status === 'planned') {
        // 확정 날짜 선택 다이얼로그는 ScheduleGrid에서 처리
        // 여기서는 바로 확정하지 않고, 사용자가 날짜를 선택할 수 있도록 함
        // 실제로는 ScheduleGrid의 handleBadgeClick에서 처리됨
        toast.info('Badge를 클릭하여 확정 날짜를 선택하세요.');
      } else {
        toast.info('이미 확정된 일정입니다.');
      }
      return;
    }

    // 새 항목 추가
    const quarterId = await ensureQuarterExists();
    if (!quarterId) {
      toast.error('분기 데이터를 생성할 수 없습니다.');
      return;
    }

    // @ts-ignore - schedule_items 타입 정의 필요
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

    // @ts-ignore - schedule_items 타입 정의 필요
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

  // 항목 확정 핸들러 (확정 날짜 포함)
  const handleItemConfirm = async (itemId: string, confirmedDate: string) => {
    // @ts-ignore - schedule_items 타입 정의 필요
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

  // 엑셀 다운로드 핸들러
  const handleExportExcel = () => {
    if (!quarter || subsidiaries.length === 0) {
      toast.error('다운로드할 데이터가 없습니다.');
      return;
    }

    // 전체 분기 기간의 모든 날짜
    const allDates = eachDayOfInterval({
      start: parseISO(quarter.start_date),
      end: parseISO(quarter.end_date),
    });

    // 헤더 행 생성
    const headers = ['Entity', ...allDates.map(date => format(date, 'MM/dd')), '성사율'];

    // 데이터 행 생성
    const rows = subsidiaries.map((subsidiary) => {
      const achievementRate = calculateAchievementRate(
        scheduleItems.filter(item => item.subsidiary_id === subsidiary.id)
      );
      
      const row: any[] = [subsidiary.name.replace('InBody ', '')];
      
      // 각 날짜별로 카테고리 정보 수집
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

    // 워크북 생성
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // 열 너비 설정
    const colWidths = [
      { wch: 20 }, // Entity
      ...allDates.map(() => ({ wch: 15 })), // 날짜 열들
      { wch: 10 }, // 성사율
    ];
    ws['!cols'] = colWidths;

    // 워크북 생성 및 다운로드
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    
    const fileName = `Schedule_${quarter.year}Q${quarter.quarter}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success('엑셀 파일이 다운로드되었습니다.');
  };

  // 셀 클릭 핸들러
  const handleCellClick = async (subsidiaryId: string, date: string) => {
    console.log('🖱️ 셀 클릭:', { subsidiaryId, date, selectedCategory, quarter });
    
    if (!quarter) {
      console.error('❌ Quarter가 없습니다.');
      toast.error('분기 정보가 없습니다.');
      return;
    }

    // 해당 셀의 기존 항목들 찾기 (여러 개 가능)
    const existingItems = scheduleItems.filter(
      (item) =>
        item.subsidiary_id === subsidiaryId &&
        item.planned_date.startsWith(date)
    );

    console.log('📋 기존 항목:', existingItems);

    // 카테고리가 선택되어 있으면 새 항목 추가 또는 기존 항목 토글
    if (selectedCategory) {
      console.log('✅ 카테고리 선택됨:', selectedCategory);
      // 해당 카테고리가 이미 존재하는지 확인
      const existingCategoryItem = existingItems.find(
        (item) => item.category === selectedCategory
      );

      if (existingCategoryItem) {
        // 기존 항목이 있으면 상태 토글
        if (existingCategoryItem.status === 'planned') {
          // 확정 날짜 선택 다이얼로그는 ScheduleGrid에서 처리
          // 여기서는 바로 확정하지 않고, 사용자가 날짜를 선택할 수 있도록 함
          toast.info('Badge를 클릭하여 확정 날짜를 선택하세요.');
        } else {
          // 확정된 항목 삭제
          if (confirm('확정된 일정을 삭제하시겠습니까?')) {
            // @ts-ignore - schedule_items 타입 정의 필요
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
        // 새 항목 추가 - 먼저 quarter가 존재하는지 확인
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

        // @ts-ignore - schedule_items 타입 정의 필요
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
          console.error('에러 코드:', error.code);
          console.error('에러 상세:', error.details);
          console.error('에러 힌트:', error.hint);
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
      // 카테고리가 선택되지 않았지만 항목이 있는 경우
      console.log('ℹ️ 카테고리 미선택 (항목 있음)');
      toast.info('좌측에서 카테고리를 선택하여 일정을 추가하거나 수정하세요.');
    } else {
      // 카테고리도 선택 안 되고 항목도 없음
      console.log('ℹ️ 카테고리 미선택 (항목 없음)');
      toast.info('좌측에서 카테고리를 먼저 선택하세요.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!quarter) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">분기 데이터를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const achievementRate = calculateAchievementRate(scheduleItems);

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      {/* 좌측 사이드바 */}
      <CategorySidebar
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
        onItemDelete={handleItemDelete}
      />

      {/* 메인 영역 */}
      <div className="flex-1 p-6 overflow-auto">
        {/* 상단 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Schedule</h2>

            {/* 전체 성사율 */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">전체 성사율</p>
                <p className="text-3xl font-bold text-blue-600">{achievementRate}%</p>
              </div>

              <Button 
                variant="outline" 
                onClick={handleExportExcel}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* 필터 영역 */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            {/* Year 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2028">2028</SelectItem>
                  <SelectItem value="2029">2029</SelectItem>
                  <SelectItem value="2030">2030</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quarter 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Quarter</label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-24">
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

            {/* Date Range 선택 */}
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm font-medium text-gray-700">Date Range</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'justify-start text-left font-normal flex-1 max-w-md',
                      !dateRange && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'yyyy-MM-dd')} -{' '}
                          {format(dateRange.to, 'yyyy-MM-dd')}
                        </>
                      ) : (
                        format(dateRange.from, 'yyyy-MM-dd')
                      )
                    ) : (
                      <span>시작일 ~ 종료일 선택 (최대 60일)</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={handleDateRangeChange}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date() || date < new Date('2025-01-01')}
                  />
                </PopoverContent>
              </Popover>
              
              {/* 필터 모드 전환 버튼 */}
              <Button
                variant={filterMode === 'quarter' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('quarter')}
              >
                Quarter
              </Button>
              <Button
                variant={filterMode === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('custom')}
                disabled={!dateRange?.from}
              >
                Custom
              </Button>
            </div>
          </div>
        </div>

        {/* 스케줄 그리드 */}
        <ScheduleGrid
          quarter={quarter}
          subsidiaries={subsidiaries}
          scheduleItems={scheduleItems}
          selectedCategory={selectedCategory}
          onCellClick={handleCellClick}
          onCategoryDrop={handleCategoryDrop}
          onItemDelete={handleItemDelete}
          onItemConfirm={handleItemConfirm}
        />
      </div>
    </div>
  );
}

