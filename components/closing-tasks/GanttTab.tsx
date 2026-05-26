'use client';

/**
 * 결산 일정표 — Gantt 차트 탭
 *  - 좌측: task 식별 (id · 카테고리 · 이름 · 담당자 · 상태)
 *  - 우측: D-day 축 가로 막대 (계획 옅음 + 실제 진함)
 *  - 오늘 컬럼 빨강 강조, 주말/공휴일 옅음
 */

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  CLOSING_TASK_CAT_COLORS,
  CLOSING_TASK_STATUS_LABEL,
} from '@/lib/types/closing-task';
import type { ClosingTaskView, ClosingTaskStatus } from '@/lib/types/closing-task';
import { addDays, toIsoDate } from '@/lib/services/closingTaskService';
import { Check } from 'lucide-react';

interface GanttTabProps {
  views: ClosingTaskView[];
  baseDate: Date;
  holidaySet: Set<string>;
  onStatusToggle: (taskId: number, current: ClosingTaskStatus) => Promise<void>;
}

const DAYS_BEFORE = 5; // D-5
const DAYS_AFTER = 12; // D+12

export function GanttTab({ views, baseDate, holidaySet, onStatusToggle }: GanttTabProps) {
  // 축 날짜 배열 생성: D-5 ~ D+12 (calendar 일 기준 — 영업일 환산은 D-day 해석 시점에서만)
  const axisDates = useMemo(() => {
    const arr: Date[] = [];
    for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
      arr.push(addDays(baseDate, i));
    }
    return arr;
  }, [baseDate]);

  const todayIso = toIsoDate(new Date());

  if (views.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-gray-400">
          표시할 task 가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <table className="border-collapse text-sm" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="text-xs text-gray-500">
              <th
                className="sticky left-0 z-10 bg-white border-b-2 border-gray-200 text-left py-2 px-3 w-12"
                style={{ minWidth: 48 }}
              >
                #
              </th>
              <th
                className="sticky bg-white border-b-2 border-gray-200 text-left py-2 px-2 w-20"
                style={{ left: 48, zIndex: 10, minWidth: 64 }}
              >
                카테고리
              </th>
              <th
                className="sticky bg-white border-b-2 border-gray-200 text-left py-2 px-3"
                style={{ left: 112, zIndex: 10, minWidth: 280, width: 280 }}
              >
                Task
              </th>
              <th
                className="sticky bg-white border-b-2 border-gray-200 text-left py-2 px-3 w-24"
                style={{ left: 392, zIndex: 10, minWidth: 80 }}
              >
                담당자
              </th>
              <th
                className="sticky bg-white border-b-2 border-gray-200 text-center py-2 px-2 w-20"
                style={{ left: 472, zIndex: 10, minWidth: 80 }}
              >
                상태
              </th>
              {/* D-day 축 */}
              {axisDates.map((d, i) => {
                const dayOffset = i - DAYS_BEFORE;
                const isoDate = toIsoDate(d);
                const isToday = isoDate === todayIso;
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isHoliday = holidaySet.has(isoDate);
                return (
                  <th
                    key={isoDate}
                    className={cn(
                      'border-b-2 border-gray-200 text-center py-2 px-0',
                      isToday && 'bg-rose-50 text-rose-700 font-bold',
                      (isWeekend || isHoliday) && !isToday && 'text-gray-300',
                    )}
                    style={{ minWidth: 32, width: 32 }}
                  >
                    <div className="text-[10px] leading-tight">
                      {dayOffset === 0 ? 'D' : dayOffset > 0 ? `+${dayOffset}` : `${dayOffset}`}
                    </div>
                    <div className="text-[10px] leading-tight">
                      {d.getMonth() + 1}/{d.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {views.map((v) => {
              const m = v.master;
              const color = CLOSING_TASK_CAT_COLORS[m.cat] || '#67767F';
              const psIdx = v.plannedStart ? indexOfDate(v.plannedStart, axisDates) : -1;
              const peIdx = v.plannedEnd ? indexOfDate(v.plannedEnd, axisDates) : -1;
              const asIdx = v.actualStart ? indexOfDate(v.actualStart, axisDates) : -1;
              const aeIdx = v.actualEnd ? indexOfDate(v.actualEnd, axisDates) : -1;

              return (
                <tr
                  key={m.id}
                  className={cn(
                    'border-b border-gray-100',
                    v.status === 'done' && 'bg-emerald-50/30',
                    v.status === 'delay' && 'bg-rose-50/30',
                  )}
                >
                  <td
                    className="sticky left-0 bg-white py-2 px-3 font-mono text-xs text-gray-500"
                    style={{ minWidth: 48 }}
                  >
                    #{m.id}
                  </td>
                  <td
                    className="sticky bg-white py-2 px-2"
                    style={{ left: 48, minWidth: 64 }}
                  >
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] text-white font-semibold"
                      style={{ backgroundColor: color }}
                    >
                      {m.cat}
                    </span>
                  </td>
                  <td
                    className="sticky bg-white py-2 px-3 text-gray-800"
                    style={{ left: 112, minWidth: 280, width: 280 }}
                  >
                    <div className="truncate" title={m.name}>
                      {m.name}
                    </div>
                    {m.sub && (
                      <div className="text-[10px] text-gray-400">{m.sub}</div>
                    )}
                  </td>
                  <td
                    className="sticky bg-white py-2 px-3 text-gray-700 text-xs"
                    style={{ left: 392, minWidth: 80 }}
                  >
                    {m.assignee || '-'}
                  </td>
                  <td
                    className="sticky bg-white py-2 px-2 text-center"
                    style={{ left: 472, minWidth: 80 }}
                  >
                    <button
                      type="button"
                      onClick={() => void onStatusToggle(m.id, v.status)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition',
                        v.status === 'done' &&
                          'bg-emerald-500 text-white hover:bg-emerald-600',
                        v.status === 'inprog' && 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                        v.status === 'delay' && 'bg-rose-100 text-rose-700 hover:bg-rose-200',
                        v.status === 'todo' && 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                      )}
                      title="클릭하여 완료 토글"
                    >
                      {v.status === 'done' && <Check className="h-3 w-3" />}
                      {CLOSING_TASK_STATUS_LABEL[v.status]}
                    </button>
                  </td>
                  {/* 가로 막대 영역 */}
                  {axisDates.map((d, i) => {
                    const isoDate = toIsoDate(d);
                    const isToday = isoDate === todayIso;
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isHoliday = holidaySet.has(isoDate);

                    // 계획 바 표시 영역인지
                    const inPlan = psIdx >= 0 && peIdx >= 0 && i >= psIdx && i <= peIdx;
                    const planLeft = psIdx === i;
                    const planRight = peIdx === i;
                    // 실제 바
                    const inActual = asIdx >= 0 && aeIdx >= 0 && i >= asIdx && i <= aeIdx;
                    const actualLeft = asIdx === i;
                    const actualRight = aeIdx === i;

                    return (
                      <td
                        key={isoDate}
                        className={cn(
                          'relative',
                          isToday && 'bg-rose-50/50',
                          (isWeekend || isHoliday) && !isToday && 'bg-gray-50',
                        )}
                        style={{ minWidth: 32, width: 32, height: 36, padding: 0 }}
                      >
                        {inPlan && (
                          <div
                            className="absolute inset-x-0.5"
                            style={{
                              top: '6px',
                              height: '8px',
                              background: color,
                              opacity: 0.25,
                              borderTopLeftRadius: planLeft ? 4 : 0,
                              borderBottomLeftRadius: planLeft ? 4 : 0,
                              borderTopRightRadius: planRight ? 4 : 0,
                              borderBottomRightRadius: planRight ? 4 : 0,
                            }}
                          />
                        )}
                        {inActual && (
                          <div
                            className="absolute inset-x-0.5"
                            style={{
                              top: '20px',
                              height: '10px',
                              background:
                                v.status === 'delay'
                                  ? '#CC1F38'
                                  : v.status === 'done'
                                    ? '#01BA65'
                                    : color,
                              borderTopLeftRadius: actualLeft ? 4 : 0,
                              borderBottomLeftRadius: actualLeft ? 4 : 0,
                              borderTopRightRadius: actualRight ? 4 : 0,
                              borderBottomRightRadius: actualRight ? 4 : 0,
                            }}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Legend */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-5 text-xs text-gray-500 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 bg-gray-400 opacity-25 rounded" />
            계획 (Plan)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 bg-gray-700 rounded" />
            실제 (Actual)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 rounded" style={{ background: '#01BA65' }} />
            완료
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 rounded" style={{ background: '#CC1F38' }} />
            지연
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 bg-rose-50 border border-rose-200 rounded-sm" />
            오늘 (D 기준일)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function indexOfDate(d: Date, arr: Date[]): number {
  const iso = toIsoDate(d);
  return arr.findIndex((x) => toIsoDate(x) === iso);
}
