'use client';

/**
 * GBS - Calendar 페이지
 * GBS 일정 관리 및 캘린더
 */

import { useState, useEffect } from 'react';
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
import {
  getGBSCalendarEvents,
  createGBSCalendarEvent,
  updateGBSCalendarEvent,
  deleteGBSCalendarEvent,
  deleteAllGBSCalendarEvents,
} from '@/lib/services/gbsCalendarService';
import { toast } from 'sonner';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export default function GBSCalendarPage() {
  const [events, setEvents] = useState<GBSCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<GBSCalendarEvent | null>(null);

  // 페이지 로드 시 일정 불러오기
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await getGBSCalendarEvents();
      setEvents(data);
      
      // 테이블이 없을 경우 콘솔에 안내 메시지 표시 (사용자에게는 빈 캘린더 표시)
      if (data.length === 0) {
        console.info('일정이 없습니다. 일정을 추가하려면 Supabase SQL Editor에서 docs/gbs-calendar-schema.sql을 실행하여 테이블을 생성하세요.');
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Failed to load calendar events:', errorMessage);
      
      // 테이블이 없는 경우 사용자에게 안내
      if (errorMessage.includes('테이블이 없습니다') || errorMessage.includes('Could not find the table')) {
        toast.error('데이터베이스 테이블이 없습니다', {
          description: 'Supabase SQL Editor에서 docs/gbs-calendar-schema.sql을 실행하여 테이블을 생성하세요.',
          duration: 10000,
        });
      } else {
        toast.error('일정 로드 실패', {
          description: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

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

  const handleSaveEvent = async (eventData: Omit<GBSCalendarEvent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (selectedEvent) {
        // 수정
        const updatedEvent = await updateGBSCalendarEvent(selectedEvent.id, eventData);
        setEvents(events.map((e) => (e.id === selectedEvent.id ? updatedEvent : e)));
        toast.success('일정 수정 완료', {
          description: '일정이 성공적으로 수정되었습니다.',
        });
      } else {
        // 추가
        const newEvent = await createGBSCalendarEvent(eventData);
        setEvents([...events, newEvent]);
        toast.success('일정 추가 완료', {
          description: '일정이 성공적으로 추가되었습니다.',
        });
      }
    } catch (error: unknown) {
      console.error('Failed to save event:', getErrorMessage(error));
      toast.error('일정 저장 실패', {
        description: getErrorMessage(error),
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteGBSCalendarEvent(eventId);
      setEvents(events.filter((e) => e.id !== eventId));
      toast.success('일정 삭제 완료', {
        description: '일정이 성공적으로 삭제되었습니다.',
      });
    } catch (error: unknown) {
      console.error('Failed to delete event:', getErrorMessage(error));
      toast.error('일정 삭제 실패', {
        description: getErrorMessage(error),
      });
    }
  };

  const handleDeleteAllEvents = async () => {
    try {
      await deleteAllGBSCalendarEvents();
      setEvents([]);
      toast.success('전체 일정 삭제 완료', {
        description: '모든 일정이 성공적으로 삭제되었습니다.',
      });
    } catch (error: unknown) {
      console.error('Failed to delete all events:', getErrorMessage(error));
      toast.error('전체 일정 삭제 실패', {
        description: getErrorMessage(error),
      });
    }
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
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#971B2F' }}></div>
              <p className="text-gray-600">일정을 불러오는 중...</p>
            </div>
          </div>
        ) : (
          <CalendarGrid
            events={events}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onAddEvent={handleAddEvent}
          />
        )}
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
