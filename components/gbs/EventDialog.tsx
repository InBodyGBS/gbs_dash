'use client';

/**
 * 일정 추가/수정 다이얼로그
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GBSCalendarEvent } from '@/lib/types/gbs-calendar';

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  date: Date | null;
  event?: GBSCalendarEvent | null;
  onSave: (event: Omit<GBSCalendarEvent, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (eventId: string) => void;
}

export function EventDialog({ open, onClose, date, event, onSave, onDelete }: EventDialogProps) {
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [selectedDate, setSelectedDate] = useState<Date | null>(date);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');

  useEffect(() => {
    Promise.resolve().then(() => {
      if (event) {
        if (event.end_date) {
          // 기간 일정
          setDateMode('range');
          setSelectedDate(new Date(event.date));
          setDateRange({
            from: new Date(event.date),
            to: new Date(event.end_date),
          });
        } else {
          // 단일 일정
          setDateMode('single');
          setSelectedDate(new Date(event.date));
          setDateRange(undefined);
        }
        setTitle(event.title);
        setAssignee(event.assignee || '');
      } else {
        setDateMode('single');
        setSelectedDate(date);
        setDateRange(undefined);
        setTitle('');
        setAssignee('');
      }
    });
  }, [event, date, open]);

  const handleSave = () => {
    if (dateMode === 'single') {
      if (!selectedDate || !title.trim()) return;
      onSave({
        date: format(selectedDate, 'yyyy-MM-dd'),
        title: title.trim(),
        assignee: assignee.trim() || undefined,
      });
    } else {
      if (!dateRange?.from || !title.trim()) return;
      onSave({
        date: format(dateRange.from, 'yyyy-MM-dd'),
        end_date: dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
        title: title.trim(),
        assignee: assignee.trim() || undefined,
      });
    }

    setTitle('');
    setAssignee('');
    setSelectedDate(null);
    setDateRange(undefined);
    onClose();
  };

  const handleDelete = () => {
    if (event && onDelete) {
      onDelete(event.id);
      onClose();
    }
  };

  const isSaveDisabled = () => {
    if (!title.trim()) return true;
    if (dateMode === 'single') {
      return !selectedDate;
    } else {
      return !dateRange?.from;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {event ? '일정 수정' : '일정 추가'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>일자 선택 방식</Label>
            <Tabs value={dateMode} onValueChange={(value) => setDateMode(value as 'single' | 'range')} className="mt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">특정 날짜</TabsTrigger>
                <TabsTrigger value="range">기간 선택</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div>
            <Label>일자</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal mt-1',
                    (dateMode === 'single' ? !selectedDate : !dateRange?.from) && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateMode === 'single' ? (
                    selectedDate ? format(selectedDate, 'yyyy년 MM월 dd일') : '날짜를 선택하세요'
                  ) : (
                    dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'yyyy년 MM월 dd일')} - {format(dateRange.to, 'yyyy년 MM월 dd일')}
                        </>
                      ) : (
                        format(dateRange.from, 'yyyy년 MM월 dd일')
                      )
                    ) : (
                      '기간을 선택하세요'
                    )
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                {dateMode === 'single' ? (
                  <Calendar
                    mode="single"
                    selected={selectedDate || undefined}
                    onSelect={(date) => setSelectedDate(date || null)}
                    initialFocus
                  />
                ) : (
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    initialFocus
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>제목</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              className="mt-1"
            />
          </div>
          <div>
            <Label>담당자</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="담당자를 입력하세요"
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          {event && onDelete && (
            <Button variant="destructive" onClick={handleDelete} className="mr-auto">
              삭제
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaveDisabled()}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
