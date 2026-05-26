'use client';

/**
 * 결산 일정표 요약 카드 (5칸)
 */

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ClosingTaskView } from '@/lib/types/closing-task';

interface SummaryCardsProps {
  views: ClosingTaskView[];
}

export function SummaryCards({ views }: SummaryCardsProps) {
  const total = views.length;
  const done = views.filter((v) => v.status === 'done').length;
  const inprog = views.filter((v) => v.status === 'inprog').length;
  const todo = views.filter((v) => v.status === 'todo').length;
  const delay = views.filter((v) => v.status === 'delay').length;

  const rows = [
    { label: '총 Task', value: total, color: 'text-gray-900' },
    { label: '완료', value: done, color: 'text-emerald-600' },
    { label: '진행중', value: inprog, color: 'text-amber-600' },
    { label: '예정', value: todo, color: 'text-gray-600' },
    { label: '지연', value: delay, color: 'text-rose-600', danger: delay > 0 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {rows.map((r) => (
        <Card key={r.label} className={cn(r.danger && 'border-rose-300 bg-rose-50/40')}>
          <CardContent className="py-4 px-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">
              {r.label}
            </p>
            <p className={cn('text-2xl font-bold mt-1', r.color)}>{r.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
