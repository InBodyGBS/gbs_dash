'use client';

/**
 * 결산 일정표 (Closing Task Master)
 *  - 결산월 선택 → master + 해당 사이클 record + 공휴일 로드
 *  - D-day → 절대일 환산해 Gantt / Task list 에 사용
 *  - Tab 1: 결산 현황 (Gantt)
 *  - Tab 2: Task 목록 (마스터 CRUD + record 상태 토글)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { CalendarDays, Plus, RefreshCw } from 'lucide-react';
import {
  getClosingTaskMasters,
  getClosingTaskRecords,
  getClosingHolidays,
  getBaseDate,
  resolveDDay,
  upsertClosingTaskRecord,
  toIsoDate,
} from '@/lib/services/closingTaskService';
import type {
  ClosingTaskMaster,
  ClosingTaskRecord,
  ClosingHoliday,
  ClosingTaskStatus,
  ClosingTaskView,
} from '@/lib/types/closing-task';
import { TaskListTab } from '@/components/closing-tasks/TaskListTab';
import { GanttTab } from '@/components/closing-tasks/GanttTab';
import { SummaryCards } from '@/components/closing-tasks/SummaryCards';
import { getIsAdminUser } from '@/lib/auth/admin';

type ActiveTab = 'gantt' | 'list';

export default function ClosingTasksPage() {
  const now = new Date();
  // 기본: 직전월 결산 (현재 month - 1, 1월이면 작년 12월)
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [cmYear, setCmYear] = useState<number>(defaultYear);
  const [cmMonth, setCmMonth] = useState<number>(defaultMonth);

  const [masters, setMasters] = useState<ClosingTaskMaster[]>([]);
  const [records, setRecords] = useState<ClosingTaskRecord[]>([]);
  const [holidays, setHolidays] = useState<ClosingHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('gantt');
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  // 권한 체크
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await getIsAdminUser();
      if (!cancelled) {
        setIsAdmin(ok);
        setAccessChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [mRows, rRows, hRows] = await Promise.all([
        getClosingTaskMasters(),
        getClosingTaskRecords(cmYear, cmMonth),
        getClosingHolidays(),
      ]);
      setMasters(mRows);
      setRecords(rRows);
      setHolidays(hRows);
    } catch (e: unknown) {
      toast.error(`로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [cmYear, cmMonth]);

  useEffect(() => {
    if (!accessChecked || !isAdmin) return;
    void loadAll();
  }, [accessChecked, isAdmin, loadAll]);

  // 공휴일 Set (O(1) lookup)
  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => h.holiday_date)),
    [holidays],
  );

  // 결산 기준일 (D-0)
  const baseDate = useMemo(
    () => getBaseDate(cmYear, cmMonth, holidaySet),
    [cmYear, cmMonth, holidaySet],
  );

  // master → ClosingTaskView (record + 절대일 합성)
  const views: ClosingTaskView[] = useMemo(() => {
    // 분기 task 는 분기 마지막 달(3/6/9/12)에만 노출
    const isQuarterEndMonth = [3, 6, 9, 12].includes(cmMonth);

    return masters
      .filter((m) => {
        if (m.freq === '분기' && !isQuarterEndMonth) return false;
        return true;
      })
      .map((m) => {
        const rec = records.find((r) => r.task_id === m.id) ?? null;
        const plannedStart = resolveDDay(m.ps, baseDate, holidaySet);
        const plannedEnd = resolveDDay(m.pe, baseDate, holidaySet);
        const actualStart = rec?.as_date ? new Date(rec.as_date) : null;
        const actualEnd = rec?.ae_date ? new Date(rec.ae_date) : null;
        // delay 자동 판정: 계획 종료일 < 오늘 && 미완료
        let status: ClosingTaskStatus = rec?.status ?? 'todo';
        if (status !== 'done' && plannedEnd && plannedEnd < startOfToday()) {
          status = 'delay';
        }
        return {
          master: m,
          record: rec,
          plannedStart,
          plannedEnd,
          actualStart,
          actualEnd,
          status,
        };
      });
  }, [masters, records, baseDate, holidaySet, cmMonth]);

  // 상태 토글 (체크박스 클릭 시)
  const handleStatusToggle = useCallback(
    async (taskId: number, currentStatus: ClosingTaskStatus) => {
      // todo → done → todo 순환
      const nextStatus: ClosingTaskStatus = currentStatus === 'done' ? 'todo' : 'done';
      const today = toIsoDate(new Date());
      try {
        await upsertClosingTaskRecord({
          taskId,
          cmYear,
          cmMonth,
          status: nextStatus,
          aeDate: nextStatus === 'done' ? today : null,
        });
        await loadAll();
      } catch (e: unknown) {
        toast.error(`상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [cmYear, cmMonth, loadAll],
  );

  // 빠른 상태 변경 (drop-down)
  const handleStatusChange = useCallback(
    async (taskId: number, newStatus: ClosingTaskStatus) => {
      const today = toIsoDate(new Date());
      try {
        await upsertClosingTaskRecord({
          taskId,
          cmYear,
          cmMonth,
          status: newStatus,
          aeDate: newStatus === 'done' ? today : null,
        });
        await loadAll();
      } catch (e: unknown) {
        toast.error(`상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [cmYear, cmMonth, loadAll],
  );

  // 권한 미달
  if (accessChecked && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardContent className="py-12 px-8 text-center text-gray-500">
            결산 일정표는 관리자만 접근 가능합니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => defaultYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="h-6 w-6" style={{ color: '#971B2F' }} />
              결산 일정표
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              결산월 기준일({baseDate.getFullYear()}.{String(baseDate.getMonth() + 1).padStart(2, '0')}.
              {String(baseDate.getDate()).padStart(2, '0')} = D-0) 으로 일정 자동 환산
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">결산월</Label>
              <Select value={String(cmYear)} onValueChange={(v) => setCmYear(parseInt(v, 10))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(cmMonth)} onValueChange={(v) => setCmMonth(parseInt(v, 10))}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards views={views} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
          <TabsList>
            <TabsTrigger value="gantt">📊 결산 현황</TabsTrigger>
            <TabsTrigger value="list">📋 Task 목록</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tab content */}
        {loading ? (
          <Card>
            <CardContent className="py-20 text-center text-gray-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3" />
              로드 중...
            </CardContent>
          </Card>
        ) : masters.length === 0 ? (
          <Card>
            <CardContent className="py-12 px-8 text-center space-y-3">
              <p className="text-lg font-semibold text-gray-800">
                아직 등록된 Task 가 없습니다.
              </p>
              <p className="text-sm text-gray-500">
                상단의{' '}
                <span className="font-medium text-gray-700">
                  📋 Task 목록 탭 → + Task 추가
                </span>{' '}
                버튼으로 결산 task 를 등록해 주세요.
              </p>
              <p className="text-xs text-gray-400 pt-2">
                Tip — SQL 마이그레이션이 아직이라면{' '}
                <span className="font-mono">docs/closing-task-master-schema.sql</span> 을 먼저
                실행, 예시 task 가 필요하면{' '}
                <span className="font-mono">
                  docs/closing-task-master-seed-example.sql
                </span>{' '}
                을 참고하세요.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('list')}
                  disabled={activeTab === 'list'}
                >
                  Task 목록 탭으로 이동
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : activeTab === 'gantt' ? (
          <GanttTab
            views={views}
            baseDate={baseDate}
            holidaySet={holidaySet}
            onStatusToggle={handleStatusToggle}
          />
        ) : (
          <TaskListTab
            views={views}
            cmYear={cmYear}
            cmMonth={cmMonth}
            onChanged={loadAll}
            onStatusToggle={handleStatusToggle}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}

function startOfToday(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
