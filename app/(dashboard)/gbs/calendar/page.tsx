'use client';

/**
 * GBS - Calendar 페이지
 * GBS 일정 관리 및 캘린더
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CalendarGrid } from '@/components/gbs/CalendarGrid';
import { EventDialog } from '@/components/gbs/EventDialog';
import type { GBSCalendarEvent } from '@/lib/types/gbs-calendar';

export default function GBSCalendarPage() {
  const [events, setEvents] = useState<GBSCalendarEvent[]>([
    // 샘플 데이터 (이미지 참고)
    { id: '1', date: '2025-12-29', time: '10:00', title: '베트는' },
    { id: '2', date: '2025-12-29', time: '10:00', title: '과제' },
    { id: '3', date: '2025-12-29', time: '10:30', title: 'IVI' },
    { id: '4', date: '2025-12-30', time: '10:00', title: '베트는' },
    { id: '5', date: '2025-12-30', time: '16:00', title: '터키 A' },
    { id: '6', date: '2025-12-31', time: '10:00', title: '베트는' },
    { id: '7', date: '2026-01-02', time: '09:00', title: 'InBc' },
    { id: '8', date: '2026-01-08', time: '10:30', title: '터' },
    { id: '9', date: '2026-01-08', time: '16:00', title: '터키 미' },
    { id: '10', date: '2026-01-09', time: '09:00', title: 'BWA_' },
    { id: '11', date: '2026-01-09', time: '16:30', title: '미팅' },
    { id: '12', date: '2026-01-09', time: '16:30', title: '방우' },
    { id: '13', date: '2026-01-12', time: '13:00', title: 'GBD고' },
    { id: '14', date: '2026-01-12', time: '16:00', title: 'GBD과' },
    { id: '15', date: '2026-01-13', time: '14:00', title: '업무 논' },
    { id: '16', date: '2026-01-15', time: '10:00', title: '(제목' },
    { id: '17', date: '2026-01-15', time: '14:30', title: 'Indi' },
  ]);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<GBSCalendarEvent | null>(null);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddEvent = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const handleAddEventFromButton = () => {
    setSelectedDate(new Date());
    setSelectedEvent(null);
    setEventDialogOpen(true);
  };

  const handleEventClick = (event: GBSCalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(new Date(event.date));
    setEventDialogOpen(true);
  };

  const handleSaveEvent = (eventData: Omit<GBSCalendarEvent, 'id' | 'created_at' | 'updated_at'>) => {
    if (selectedEvent) {
      // 수정
      setEvents(events.map((e) => (e.id === selectedEvent.id ? { ...selectedEvent, ...eventData } : e)));
    } else {
      // 추가
      const newEvent: GBSCalendarEvent = {
        ...eventData,
        id: Date.now().toString(),
      };
      setEvents([...events, newEvent]);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId));
  };

  const handleDeleteAllEvents = () => {
    setEvents([]);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Calendar
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleAddEventFromButton} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              일정 추가
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="flex items-center gap-2"
                  disabled={events.length === 0}
                >
                  <Trash2 className="h-4 w-4" />
                  전체 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>전체 일정 삭제</AlertDialogTitle>
                  <AlertDialogDescription>
                    모든 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                    <br />
                    <span className="font-semibold text-red-600">
                      총 {events.length}개의 일정이 삭제됩니다.
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAllEvents}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        <CalendarGrid
          events={events}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
          onAddEvent={handleAddEvent}
        />
      </div>

      {/* Event Dialog */}
      <EventDialog
        open={eventDialogOpen}
        onClose={() => {
          setEventDialogOpen(false);
          setSelectedEvent(null);
        }}
        date={selectedDate}
        event={selectedEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />
    </div>
  );
}
