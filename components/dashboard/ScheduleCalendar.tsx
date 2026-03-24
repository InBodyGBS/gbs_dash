'use client';

import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { cn } from '@/lib/utils';

interface CalendarItem {
  id: string;
  planned_date: string;
  subsidiary_id: string;
  category: string;
  status: string;
  subsidiaryName: string;
  categoryLabel: string;
  categoryColor: string;
}

type SubsidiaryLite = { id: string; name: string };
type ScheduleItemLite = {
  id: string;
  planned_date: string;
  subsidiary_id: string;
  category: string;
  status: string;
};

type ViewMode = 'monthly' | 'yearly';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EXCLUDED = ['Germany', 'UK', 'Singapore'];

export function ScheduleCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // 연도별: 1/1 ~ 12/31 / 월별: 해당 월 전체
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const startDate = viewMode === 'yearly'
        ? `${year}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = viewMode === 'yearly'
        ? `${year}-12-31`
        : new Date(year, month + 1, 0).toISOString().split('T')[0];

      const [scheduleResult, subsResult] = await Promise.all([
        supabase
          .from('schedule_items')
          .select('*')
          .gte('planned_date', startDate)
          .lte('planned_date', endDate)
          .order('planned_date', { ascending: true }),
        supabase.from('subsidiaries').select('id, name'),
      ]);

      const subsMap = new Map<string, string>(
        ((subsResult.data || []) as SubsidiaryLite[])
          .filter((s) => !EXCLUDED.some((ex) => s.name.includes(ex)))
          .map((s) => [s.id, s.name])
      );

      const mapped: CalendarItem[] = ((scheduleResult.data || []) as ScheduleItemLite[])
        .filter((item) => subsMap.has(item.subsidiary_id))
        .map((item) => {
          const cat = CLOSING_CATEGORIES.find((c) => c.id === item.category);
          return {
            ...item,
            subsidiaryName: subsMap.get(item.subsidiary_id) || '',
            categoryLabel: cat?.label || item.category,
            categoryColor: cat?.color || '#9CA3AF',
          };
        });

      setItems(mapped);
      setLoading(false);
    };
    load();
  }, [year, month, viewMode]);

  // 날짜 → 아이템 맵
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    items.forEach((item) => {
      const list = map.get(item.planned_date) || [];
      list.push(item);
      map.set(item.planned_date, list);
    });
    return map;
  }, [items]);

  /* ── Monthly View ── */
  const monthlyGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    // 6주 채우기
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const today = new Date().toISOString().split('T')[0];

  const formatDate = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  /* ── Yearly mini-month ── */
  function MiniMonth({ m }: { m: number }) {
    const firstDay = new Date(year, m, 1).getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-xs font-semibold text-gray-700 mb-2 text-center">{MONTHS[m]}</p>
        <div className="grid grid-cols-7 gap-0">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-[9px] text-gray-400 pb-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = formatDate(year, m, day);
            const dayItems = itemsByDate.get(dateStr) || [];
            const isToday = dateStr === today;
            return (
              <div
                key={i}
                className={cn(
                  'relative flex items-center justify-center text-[10px] h-5 w-full rounded cursor-default',
                  isToday && 'bg-red-100 font-bold text-red-600',
                  dayItems.length > 0 && !isToday && 'font-semibold text-gray-800'
                )}
                onMouseEnter={(e) => {
                  if (dayItems.length > 0) {
                    setTooltip({ date: dateStr, x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {day}
                {dayItems.length > 0 && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: dayItems[0].categoryColor }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        {/* 뷰 토글 */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          <button
            onClick={() => setViewMode('monthly')}
            className={cn(
              'px-3 py-1.5 font-medium transition-colors',
              viewMode === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={cn(
              'px-3 py-1.5 font-medium transition-colors',
              viewMode === 'yearly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            Yearly
          </button>
        </div>

        {/* 네비게이션 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (viewMode === 'monthly') {
                d.setMonth(d.getMonth() - 1);
              } else {
                d.setFullYear(d.getFullYear() - 1);
              }
              setCurrentDate(d);
            }}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 w-28 text-center">
            {viewMode === 'monthly' ? `${year}. ${String(month + 1).padStart(2, '0')}` : year}
          </span>
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (viewMode === 'monthly') {
                d.setMonth(d.getMonth() + 1);
              } else {
                d.setFullYear(d.getFullYear() + 1);
              }
              setCurrentDate(d);
            }}
            className="p-1 rounded hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-2" />
          로딩 중...
        </div>
      ) : viewMode === 'monthly' ? (
        /* ── Monthly Grid ── */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {monthlyGrid.map((day, i) => {
              if (!day) return <div key={i} className="bg-gray-50" />;
              const dateStr = formatDate(year, month, day);
              const dayItems = itemsByDate.get(dateStr) || [];
              const isToday = dateStr === today;
              return (
                <div
                  key={i}
                  className={cn(
                    'bg-white p-1 min-h-[72px] flex flex-col',
                    isToday && 'bg-red-50'
                  )}
                >
                  <span
                    className={cn(
                      'text-xs w-5 h-5 flex items-center justify-center rounded-full mb-0.5 font-medium',
                      isToday ? 'bg-red-500 text-white' : 'text-gray-700'
                    )}
                  >
                    {day}
                  </span>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="text-[9px] leading-tight px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: item.categoryColor }}
                        title={`${item.subsidiaryName} - ${item.categoryLabel}`}
                      >
                        {item.subsidiaryName}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] text-gray-400 px-1">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── Yearly Grid ── */
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 12 }, (_, m) => (
              <MiniMonth key={m} m={m} />
            ))}
          </div>
        </div>
      )}

      {/* 툴팁 */}
      {tooltip && itemsByDate.get(tooltip.date) && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-xl pointer-events-none max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-semibold mb-1 text-gray-300">{tooltip.date}</p>
          {(itemsByDate.get(tooltip.date) || []).map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 py-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.categoryColor }} />
              <span className="truncate">{item.subsidiaryName}</span>
              <span className="text-gray-400 truncate">· {item.categoryLabel}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
