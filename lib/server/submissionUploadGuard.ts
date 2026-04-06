import type { SupabaseClient } from '@supabase/supabase-js';

export class SubmissionBlockedByOverviewError extends Error {
  constructor() {
    super('OVERVIEW_CONFIRMED');
    this.name = 'SubmissionBlockedByOverviewError';
  }
}

/**
 * Overview에서 확정된 법인·카테고리·귀속월이면 업로드 거부 (DB와 동일 규칙).
 */
export async function assertSubmissionUploadAllowedByOverview(
  supabase: SupabaseClient,
  params: {
    quarterId: string | null;
    subsidiaryId: string | null;
    category: string;
    fiscalYear: string | null;
    /** Overview 상단과 동일한 귀속 월 1–12 */
    closingMonth: string | null;
  },
): Promise<void> {
  const { quarterId, subsidiaryId, category, fiscalYear, closingMonth } = params;

  if (!quarterId || quarterId.startsWith('temp-') || quarterId.startsWith('custom-')) return;
  if (!subsidiaryId) return;

  const { data: reviewRow, error: reviewErr } = await supabase
    .from('category_review_status')
    .select('status')
    .eq('quarter_id', quarterId)
    .eq('subsidiary_id', subsidiaryId)
    .eq('category', category)
    .maybeSingle();

  if (reviewErr && reviewErr.code !== 'PGRST116') {
    console.warn('category_review_status 조회 실패:', reviewErr.message);
  }

  const status = (reviewRow as { status?: string } | null)?.status;
  if (status === 'confirmed') {
    throw new SubmissionBlockedByOverviewError();
  }

  if (fiscalYear && closingMonth) {
    const fy = parseInt(fiscalYear, 10);
    const m = parseInt(closingMonth, 10);
    if (!Number.isNaN(fy) && !Number.isNaN(m) && m >= 1 && m <= 12) {
      const ymPrefix = `${fy}-${String(m).padStart(2, '0')}`;
      const { data: schedRows, error: schedErr } = await supabase
        .from('schedule_items')
        .select('id')
        .eq('quarter_id', quarterId)
        .eq('subsidiary_id', subsidiaryId)
        .eq('category', category)
        .eq('status', 'confirmed')
        .like('planned_date', `${ymPrefix}%`);

      if (schedErr) {
        console.warn('schedule_items 확정 조회 실패:', schedErr.message);
        return;
      }
      if (schedRows && schedRows.length > 0) {
        throw new SubmissionBlockedByOverviewError();
      }
    }
  }
}
