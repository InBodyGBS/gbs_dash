'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { GripVertical } from 'lucide-react';
import type { Subsidiary } from '@/lib/supabase/types';
import { MONTHLY_CLOSING_CATEGORIES } from '@/lib/constants/monthly-closing-categories';
import type { MonthlyReviewStatus, MonthlySubmission } from '@/lib/types/monthly-closing-submissions';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MonthlyOverviewGridProps {
  periodYear: number;
  periodMonth: number;
  subsidiaries: Subsidiary[];
  submissions: MonthlySubmission[];
  reviewStatuses: MonthlyReviewStatus[];
  onReviewToggle: (
    subsidiaryId: string,
    patch: { reviewing?: boolean; confirm?: boolean }
  ) => Promise<void>;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export function MonthlyOverviewGrid({
  subsidiaries,
  submissions,
  reviewStatuses,
  onReviewToggle,
}: MonthlyOverviewGridProps) {
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  // submissions: submitted_at desc 로 내려오게 가져오므로 "첫 번째"가 최신
  const latestSubmissionMap = useMemo(() => {
    const map = new Map<string, MonthlySubmission>();
    submissions.forEach((sub) => {
      if (!sub.subsidiary_id) return;
      const key = `${sub.subsidiary_id}::${sub.category}`;
      if (!map.has(key)) map.set(key, sub);
    });
    return map;
  }, [submissions]);

  const reviewStatusMap = useMemo(() => {
    const map = new Map<string, MonthlyReviewStatus>();
    reviewStatuses.forEach((s) => {
      if (!s.subsidiary_id) return;
      map.set(s.subsidiary_id, s);
    });
    return map;
  }, [reviewStatuses]);

  const handleToggle = async (subsidiaryId: string, field: 'reviewing' | 'confirm', value: boolean) => {
    const key = `${subsidiaryId}::${field}`;
    setUpdatingKey(key);
    try {
      const existing = reviewStatusMap.get(subsidiaryId);
      await onReviewToggle(subsidiaryId, {
        reviewing: field === 'reviewing' ? value : existing?.reviewing ?? false,
        confirm: field === 'confirm' ? value : existing?.confirm ?? false,
      });
    } catch (error: unknown) {
      toast.error('저장 실패', { description: getErrorMessage(error) });
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div className="overflow-auto">
      <div className="min-w-full inline-block">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900 min-w-[220px]">
                Entity
              </th>
              {MONTHLY_CLOSING_CATEGORIES.map((category) => (
                <th
                  key={category.id}
                  className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 min-w-[150px]"
                >
                  {category.label}
                </th>
              ))}
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 min-w-[140px]">
                Reviewing
              </th>
              <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900 min-w-[140px]">
                Confirm
              </th>
            </tr>
          </thead>

          <tbody>
            {subsidiaries.map((subsidiary) => {
              const status = reviewStatusMap.get(subsidiary.id);

              return (
                <tr key={subsidiary.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 z-10 bg-white border border-gray-300 px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span>{subsidiary.name}</span>
                    </div>
                  </td>

                  {MONTHLY_CLOSING_CATEGORIES.map((category) => {
                    const key = `${subsidiary.id}::${category.id}`;
                    const latest = latestSubmissionMap.get(key);
                    const isSubmitted = !!latest;

                    const stamp = latest?.submitted_at
                      ? format(new Date(latest.submitted_at), 'yyyy-MM-dd')
                      : '';

                    return (
                      <td key={category.id} className="border border-gray-300 px-4 py-3 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <div
                            className={cn('w-4 h-4 rounded-full', isSubmitted ? '' : 'bg-gray-300')}
                            style={{
                              backgroundColor: isSubmitted ? category.color : undefined,
                            }}
                            title={isSubmitted ? `${category.label} - Stamp: ${stamp}` : `${category.label} - 미제출`}
                          />
                          <div className="text-[11px] text-gray-600">
                            {isSubmitted ? stamp : '—'}
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={status?.reviewing ?? false}
                        disabled={updatingKey === `${subsidiary.id}::reviewing`}
                        onCheckedChange={(v) => handleToggle(subsidiary.id, 'reviewing', !!v)}
                        aria-label="Reviewing"
                      />
                    </div>
                  </td>

                  <td className="border border-gray-300 px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={status?.confirm ?? false}
                        disabled={updatingKey === `${subsidiary.id}::confirm`}
                        onCheckedChange={(v) => handleToggle(subsidiary.id, 'confirm', !!v)}
                        aria-label="Confirm"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

