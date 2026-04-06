'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import {
  CLOSING_CATEGORIES,
  getClosingQuarterContextForCalendarMonth,
} from '@/lib/constants/closing-categories';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

/** 수기 추가 이벤트 (Supabase `custom_calendar_events`; 날짜는 `date` 필드로 'yyyy-MM-dd') */
interface CustomCalendarEvent {
  id: string;
  title: string;
  date: string;       // 'yyyy-MM-dd'
  color: string;
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

type CategoryAgg = {
  category: string;
  categoryLabel: string;
  categoryColor: string;
  subsidiaryNames: string[]; // grouped by category within the same date
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EXCLUDED = ['Germany', 'UK', 'Singapore'];
/** 예전 localStorage 키 — 최초 로드 시 DB로 일회 마이그레이션 후 제거 */
const LEGACY_CUSTOM_EVENTS_KEY = 'dashboard-custom-calendar-events';

const EVENT_COLORS = [
  { label: 'Blue',   value: '#3B82F6' },
  { label: 'Green',  value: '#10B981' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Orange', value: '#F59E0B' },
  { label: 'Pink',   value: '#EC4899' },
];

function mapCustomCalendarRow(row: {
  id: string;
  title: string;
  event_date: string;
  color: string;
}): CustomCalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.event_date,
    color: row.color,
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('does not exist')) ||
    Boolean(error.message?.includes('Could not find the table'))
  );
}

export function ScheduleCalendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ date: string; x: number; y: number } | null>(null);

  /* ── 수기 이벤트 state ── */
  const [customEvents, setCustomEvents] = useState<CustomCalendarEvent[]>([]);
  const [addDialog, setAddDialog] = useState<{ date: string } | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState(EVENT_COLORS[0].value);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const legacyCustomEventsMigrated = useRef(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  /* ── 수기 이벤트: Supabase 조회 (뷰 범위), 예전 localStorage 1회 마이그레이션 ── */
  useEffect(() => {
    let cancelled = false;

    const loadCustomEvents = async () => {
      if (!legacyCustomEventsMigrated.current) {
        legacyCustomEventsMigrated.current = true;
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem(LEGACY_CUSTOM_EVENTS_KEY) : null;
          if (raw) {
            const legacy = JSON.parse(raw) as CustomCalendarEvent[];
            for (const ev of legacy) {
              await supabase.from('custom_calendar_events').insert({
                title: ev.title,
                event_date: ev.date,
                color: ev.color || EVENT_COLORS[0].value,
              });
            }
            localStorage.removeItem(LEGACY_CUSTOM_EVENTS_KEY);
          }
        } catch {
          /* ignore migration errors */
        }
      }

      const startDate =
        viewMode === 'yearly'
          ? `${year}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate =
        viewMode === 'yearly'
          ? `${year}-12-31`
          : new Date(year, month + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('custom_calendar_events')
        .select('id, title, event_date, color')
        .gte('event_date', startDate)
        .lte('event_date', endDate)
        .order('event_date', { ascending: true });

      if (cancelled) return;

      if (error) {
        if (isMissingTableError(error)) {
          console.warn(
            'custom_calendar_events 테이블이 없습니다. Supabase에서 docs/custom-calendar-events-schema.sql을 실행하세요.',
          );
        } else {
          console.error(error);
        }
        setCustomEvents([]);
        return;
      }

      setCustomEvents(((data ?? []) as { id: string; title: string; event_date: string; color: string }[]).map(mapCustomCalendarRow));
    };

    loadCustomEvents();
    return () => {
      cancelled = true;
    };
  }, [year, month, viewMode]);

  /* ── dialog 열릴 때 인풋 포커스 ── */
  useEffect(() => {
    if (addDialog) {
      const t = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [addDialog]);

  /* ── 스케줄 데이터 로드 (planned + confirmed; 분기는 FC와 동일 규칙) ── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const startDate = viewMode === 'yearly'
        ? `${year}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = viewMode === 'yearly'
        ? `${year}-12-31`
        : new Date(year, month + 1, 0).toISOString().split('T')[0];

      let quarterIds: string[] = [];

      if (viewMode === 'monthly') {
        const calMonth = month + 1;
        const { attributionYear, calendarQuarter } = getClosingQuarterContextForCalendarMonth(
          year,
          calMonth,
        );
        const { data: closingQuarter } = await supabase
          .from('quarters')
          .select('id')
          .eq('year', attributionYear)
          .eq('quarter', calendarQuarter)
          .maybeSingle();
        if (closingQuarter?.id) quarterIds = [closingQuarter.id];
      } else {
        const { data: yearQuarters } = await supabase
          .from('quarters')
          .select('id')
          .eq('year', year);
        quarterIds = [...new Set((yearQuarters ?? []).map((q: { id: string }) => q.id))];
      }

      if (quarterIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      let scheduleQuery = supabase
        .from('schedule_items')
        .select('*')
        .gte('planned_date', startDate)
        .lte('planned_date', endDate)
        .in('status', ['planned', 'confirmed'])
        .order('planned_date', { ascending: true });

      if (quarterIds.length === 1) {
        scheduleQuery = scheduleQuery.eq('quarter_id', quarterIds[0]);
      } else if (quarterIds.length > 1) {
        scheduleQuery = scheduleQuery.in('quarter_id', quarterIds);
      }

      const [scheduleResult, subsResult] = await Promise.all([
        scheduleQuery,
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

  /* ── 수기 이벤트 저장 ── */
  const handleAddEvent = async () => {
    const title = newTitle.trim();
    if (!title || !addDialog) return;

    const { data, error } = await supabase
      .from('custom_calendar_events')
      .insert({ title, event_date: addDialog.date, color: newColor })
      .select('id, title, event_date, color')
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          'custom_calendar_events 테이블이 없습니다. Supabase에서 docs/custom-calendar-events-schema.sql을 실행하세요.',
        );
      } else {
        console.error(error);
      }
      return;
    }

    const event = mapCustomCalendarRow(data);
    setCustomEvents((prev) =>
      [...prev, event].sort((a, b) => a.date.localeCompare(b.date)),
    );
    setNewTitle('');
    setAddDialog(null);
  };

  /* ── 수기 이벤트 삭제 ── */
  const handleDeleteEvent = async (id: string) => {
    const { error } = await supabase.from('custom_calendar_events').delete().eq('id', id);

    if (error) {
      if (isMissingTableError(error)) {
        console.warn(
          'custom_calendar_events 테이블이 없습니다. Supabase에서 docs/custom-calendar-events-schema.sql을 실행하세요.',
        );
      } else {
        console.error(error);
      }
      return;
    }

    setCustomEvents((prev) => prev.filter((e) => e.id !== id));
  };

  /* ── 날짜 → 카테고리 집계 맵 ──
   * 같은 날짜에 같은 카테고리가 여러 법인으로 생성될 수 있으나,
   * 메인 캘린더에서는 “카테고리 1개만” 보이도록 그룹핑한다.
   */
  const categoryByDate = useMemo(() => {
    const dateMap = new Map<
      string,
      Map<
        string,
        {
          categoryLabel: string;
          categoryColor: string;
          subsidiaryNamesSet: Set<string>;
        }
      >
    >();

    for (const item of items) {
      if (!dateMap.has(item.planned_date)) {
        dateMap.set(item.planned_date, new Map());
      }
      const catMap = dateMap.get(item.planned_date)!;

      if (!catMap.has(item.category)) {
        catMap.set(item.category, {
          categoryLabel: item.categoryLabel,
          categoryColor: item.categoryColor,
          subsidiaryNamesSet: new Set<string>(),
        });
      }

      const agg = catMap.get(item.category)!;
      if (item.subsidiaryName) agg.subsidiaryNamesSet.add(item.subsidiaryName);
    }

    const result = new Map<string, CategoryAgg[]>();
    for (const [date, catMap] of dateMap.entries()) {
      const arr: CategoryAgg[] = Array.from(catMap.entries()).map(([category, v]) => ({
        category,
        categoryLabel: v.categoryLabel,
        categoryColor: v.categoryColor,
        subsidiaryNames: Array.from(v.subsidiaryNamesSet).filter(Boolean),
      }));
      result.set(date, arr);
    }

    return result;
  }, [items]);

  /* ── 날짜 → 커스텀 이벤트 맵 ── */
  const customByDate = useMemo(() => {
    const map = new Map<string, CustomCalendarEvent[]>();
    customEvents.forEach((ev) => {
      const list = map.get(ev.date) || [];
      list.push(ev);
      map.set(ev.date, list);
    });
    return map;
  }, [customEvents]);

  /* ── Monthly Grid ── */
  const monthlyGrid = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
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
            const dayItems = categoryByDate.get(dateStr) || [];
            const customDayItems = customByDate.get(dateStr) || [];
            const hasAny = dayItems.length > 0 || customDayItems.length > 0;
            const isToday = dateStr === today;
            return (
              <div
                key={i}
                className={cn(
                  'relative flex items-center justify-center text-[10px] h-5 w-full rounded cursor-default',
                  isToday && 'bg-red-100 font-bold text-red-600',
                  hasAny && !isToday && 'font-semibold text-gray-800'
                )}
                onMouseEnter={(e) => {
                  if (hasAny) setTooltip({ date: dateStr, x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {day}
                {hasAny && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: customDayItems[0]?.color ?? dayItems[0]?.categoryColor }}
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = new Date(currentDate);
              if (viewMode === 'monthly') d.setMonth(d.getMonth() - 1);
              else d.setFullYear(d.getFullYear() - 1);
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
              if (viewMode === 'monthly') d.setMonth(d.getMonth() + 1);
              else d.setFullYear(d.getFullYear() + 1);
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
              const dayItems = categoryByDate.get(dateStr) || [];
              const customDayItems = customByDate.get(dateStr) || [];
              const isToday = dateStr === today;
              return (
                <div
                  key={i}
                  className={cn(
                    'bg-white p-1 min-h-[72px] flex flex-col group cursor-pointer',
                    isToday && 'bg-red-50'
                  )}
                  onClick={() => {
                    setNewTitle('');
                    setNewColor(EVENT_COLORS[0].value);
                    setAddDialog({ date: dateStr });
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={cn(
                        'text-xs w-5 h-5 flex items-center justify-center rounded-full font-medium',
                        isToday ? 'bg-red-500 text-white' : 'text-gray-700'
                      )}
                    >
                      {day}
                    </span>
                    {/* + 버튼: hover 시 표시 — TODO: 관리자 권한 체크로 대체 */}
                    <Plus className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {/* 스케줄 아이템 (계획) */}
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.category}
                        className="text-[9px] leading-tight px-1 py-0.5 rounded truncate text-white"
                        style={{ backgroundColor: item.categoryColor }}
                        title={`${item.categoryLabel} — ${item.subsidiaryNames.join(', ')}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {item.categoryLabel}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] text-gray-400 px-1">+{dayItems.length - 3} more</div>
                    )}
                    {/* 수기 이벤트 */}
                    {customDayItems.map((ev) => (
                      <div
                        key={ev.id}
                        className="text-[9px] leading-tight px-1 py-0.5 rounded truncate flex items-center justify-between gap-0.5 group/ev"
                        style={{ border: `1px solid ${ev.color}`, color: ev.color }}
                        onClick={(e) => e.stopPropagation()}
                        title={ev.title}
                      >
                        <span className="truncate">{ev.title}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                          className="opacity-0 group-hover/ev:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      </div>
                    ))}
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
      {tooltip &&
        ((categoryByDate.get(tooltip.date) || []).length > 0 || (customByDate.get(tooltip.date) || []).length > 0) && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-xl pointer-events-none max-w-[200px]"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <p className="font-semibold mb-1 text-gray-300">{tooltip.date}</p>
          {(categoryByDate.get(tooltip.date) || []).map((item) => {
            const subsidiaryText = item.subsidiaryNames.join(', ');
            return (
              <div key={item.category} className="flex items-center gap-1.5 py-0.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.categoryColor }} />
                <span className="truncate">{item.categoryLabel}</span>
                <span
                  className="text-gray-400 truncate"
                  title={subsidiaryText}
                >
                  · {subsidiaryText}
                </span>
              </div>
            );
          })}
          {(customByDate.get(tooltip.date) || []).map((ev) => (
            <div key={ev.id} className="flex items-center gap-1.5 py-0.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
              <span className="truncate">{ev.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* 수기 이벤트 추가 Dialog
          TODO: 관리자 권한 체크 후 addDialog를 열도록 변경
          예) if (!isAdmin) return;
      */}
      {addDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setAddDialog(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 w-72"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">이벤트 추가</h3>
              <span className="text-xs text-gray-400">{addDialog.date}</span>
            </div>

            <div className="space-y-3">
              <Input
                ref={titleInputRef}
                placeholder="이벤트 이름"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddEvent(); }}
                className="text-sm"
              />

              <div>
                <p className="text-xs text-gray-500 mb-1.5">색상</p>
                <div className="flex gap-2">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewColor(c.value)}
                      className={cn(
                        'w-6 h-6 rounded-full transition-transform',
                        newColor === c.value && 'ring-2 ring-offset-1 ring-gray-400 scale-110'
                      )}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setAddDialog(null)}
              >
                취소
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleAddEvent}
                disabled={!newTitle.trim()}
              >
                추가
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
