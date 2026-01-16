'use client';

/**
 * GBS Calendar Grid 컴포넌트
 * 커스텀 달력 그리드와 일정 표시
 */

import { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { GBSCalendarEvent } from '@/lib/types/gbs-calendar';

interface CalendarGridProps {
  events?: GBSCalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: GBSCalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function CalendarGrid({
  events = [],
  onDateClick,
  onEventClick,
  onAddEvent,
}: CalendarGridProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // 달력에 표시할 날짜들 (이전/다음 달 일부 포함)
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
  
  const calendarEnd = new Date(monthEnd);
  const daysToAdd = 6 - monthEnd.getDay();
  calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateClick?.(date);
  };

  const handleYearChange = (year: string) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(parseInt(year));
    setCurrentMonth(newDate);
  };

  const handleMonthChange = (month: string) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(parseInt(month) - 1);
    setCurrentMonth(newDate);
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return events.filter((event) => {
      const eventStart = event.date;
      const eventEnd = event.end_date || event.date;
      
      // 기간 일정인 경우 시작일부터 종료일까지 포함
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = currentMonth.getMonth() + 1;
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-sm"
          >
            오늘
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={currentYear.toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[100px] h-8 text-sm border-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={currentMonthNum.toString()}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[80px] h-8 text-sm border-0 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    {month}월
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">일정</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-gray-600 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            const dayEvents = getEventsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const showMoreIndicator = dayEvents.length > 3;

            return (
              <div
                key={idx}
                className={cn(
                  'min-h-[100px] border border-gray-200 rounded p-1 cursor-pointer transition-colors',
                  !isCurrentMonth && 'bg-gray-50 opacity-50',
                  'hover:bg-gray-50'
                )}
                style={isSelected ? { borderColor: '#971B2F', borderWidth: '2px' } : undefined}
                onClick={() => handleDateClick(day)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#971B2F' }}></div>
                    )}
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isTodayDate && 'text-white rounded-full w-6 h-6 flex items-center justify-center',
                        isSelected && !isTodayDate && 'font-semibold',
                        !isCurrentMonth && 'text-gray-400'
                      )}
                      style={
                        isTodayDate
                          ? { backgroundColor: '#971B2F' }
                          : isSelected && !isTodayDate
                          ? { color: '#971B2F' }
                          : undefined
                      }
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  {isSelected && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:opacity-80"
                      style={{ color: '#971B2F' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddEvent?.(day);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: 'rgba(151, 27, 47, 0.1)', color: '#971B2F' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick?.(event);
                      }}
                      title={event.time ? `${event.time} ${event.title}` : event.title}
                    >
                      {event.time ? `${event.time} ` : ''}{event.title}
                    </div>
                  ))}
                  {showMoreIndicator && (
                    <div className="text-[10px] text-gray-500 px-1 font-medium">
                      +{dayEvents.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
