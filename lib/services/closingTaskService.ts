/**
 * 결산 일정표 서비스
 *
 *  - master / records / holidays CRUD
 *  - D-day(예: 'D-3', 'D+4') → 절대일 환산
 *  - 결산 기준일 = (cm_year, cm_month) 다음 달 첫 영업일 = D-0
 *
 * 권한: gbs_admin 만 — RLS 로 차단됨. 클라이언트는 RLS 신뢰.
 */

import { supabase } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import type {
  ClosingTaskMaster,
  ClosingTaskRecord,
  ClosingHoliday,
  ClosingTaskMasterFormData,
  ClosingTaskStatus,
} from '@/lib/types/closing-task';

const BUCKET = 'closing-task-files';

// ============================================================
// Master
// ============================================================

/** 테이블 미존재 (42P01) / schema cache miss 를 일관되게 처리 */
function isMissingTable(error: { code?: string; message?: string }): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const msg = error.message || '';
  return (
    msg.includes('Could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

export async function getClosingTaskMasters(): Promise<ClosingTaskMaster[]> {
  const { data, error } = await supabase
    .from('closing_task_master' as never)
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      console.warn(
        '[closing-tasks] 테이블 미생성 — docs/closing-task-master-schema.sql 을 먼저 실행해 주세요.',
      );
      return [];
    }
    throw new Error(`Task master 조회 실패: ${error.message}`);
  }
  return (data || []) as unknown as ClosingTaskMaster[];
}

export async function upsertClosingTaskMaster(
  form: ClosingTaskMasterFormData,
): Promise<ClosingTaskMaster> {
  const payload = {
    ...form,
    sub: form.sub ?? null,
    assignee: form.assignee ?? null,
    ps: form.ps ?? null,
    pe: form.pe ?? null,
    output: form.output ?? null,
    predecessors: form.predecessors ?? [],
    successors: form.successors ?? [],
    active: form.active ?? true,
  };
  if (payload.id !== undefined) {
    const { data, error } = await supabase
      .from('closing_task_master' as never)
      .update(payload as never)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw new Error(`Task master 저장 실패: ${error.message}`);
    return data as unknown as ClosingTaskMaster;
  }
  // 새 ID — 현재 max + 1
  const { data: maxRow } = await supabase
    .from('closing_task_master' as never)
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const newId = ((maxRow as { id?: number } | null)?.id ?? 0) + 1;
  const { data, error } = await supabase
    .from('closing_task_master' as never)
    .insert({ ...payload, id: newId } as never)
    .select()
    .single();
  if (error) throw new Error(`Task master 생성 실패: ${error.message}`);
  return data as unknown as ClosingTaskMaster;
}

export async function deleteClosingTaskMaster(id: number): Promise<void> {
  const { error } = await supabase
    .from('closing_task_master' as never)
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Task master 삭제 실패: ${error.message}`);
}

// ============================================================
// Records — 결산월별 실행 기록
// ============================================================

export async function getClosingTaskRecords(
  cmYear: number,
  cmMonth: number,
): Promise<ClosingTaskRecord[]> {
  const { data, error } = await supabase
    .from('closing_task_records' as never)
    .select('*')
    .eq('cm_year', cmYear)
    .eq('cm_month', cmMonth);
  if (error) {
    if (isMissingTable(error)) {
      console.warn(
        '[closing-tasks] closing_task_records 미생성 — SQL 마이그레이션 필요.',
      );
      return [];
    }
    throw new Error(`Task record 조회 실패: ${error.message}`);
  }
  return (data || []) as unknown as ClosingTaskRecord[];
}

export async function upsertClosingTaskRecord(params: {
  taskId: number;
  cmYear: number;
  cmMonth: number;
  status?: ClosingTaskStatus;
  asDate?: string | null;
  aeDate?: string | null;
  note?: string | null;
  files?: Array<{ name: string; url: string; path?: string }>;
  completedBy?: string | null;
}): Promise<ClosingTaskRecord> {
  const payload: Record<string, unknown> = {
    task_id: params.taskId,
    cm_year: params.cmYear,
    cm_month: params.cmMonth,
  };
  if (params.status !== undefined) payload.status = params.status;
  if (params.asDate !== undefined) payload.as_date = params.asDate;
  if (params.aeDate !== undefined) payload.ae_date = params.aeDate;
  if (params.note !== undefined) payload.note = params.note;
  if (params.files !== undefined) payload.files = params.files;
  if (params.completedBy !== undefined) payload.completed_by = params.completedBy;
  if (params.status === 'done') {
    payload.completed_at = new Date().toISOString();
  } else if (params.status && params.status !== 'done') {
    payload.completed_at = null;
  }

  const { data, error } = await supabase
    .from('closing_task_records' as never)
    .upsert(payload as never, { onConflict: 'task_id,cm_year,cm_month' })
    .select()
    .single();
  if (error) throw new Error(`Task record 저장 실패: ${error.message}`);
  return data as unknown as ClosingTaskRecord;
}

export async function deleteClosingTaskRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('closing_task_records' as never)
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Task record 삭제 실패: ${error.message}`);
}

// ============================================================
// Holidays
// ============================================================

export async function getClosingHolidays(): Promise<ClosingHoliday[]> {
  const { data, error } = await supabase
    .from('closing_holidays' as never)
    .select('*')
    .order('holiday_date', { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(`공휴일 조회 실패: ${error.message}`);
  }
  return (data || []) as unknown as ClosingHoliday[];
}

export async function addClosingHoliday(date: string, name?: string): Promise<void> {
  const { error } = await supabase
    .from('closing_holidays' as never)
    .upsert({ holiday_date: date, name: name ?? null } as never, {
      onConflict: 'holiday_date',
    });
  if (error) throw new Error(`공휴일 추가 실패: ${error.message}`);
}

export async function deleteClosingHoliday(date: string): Promise<void> {
  const { error } = await supabase
    .from('closing_holidays' as never)
    .delete()
    .eq('holiday_date', date);
  if (error) throw new Error(`공휴일 삭제 실패: ${error.message}`);
}

// ============================================================
// 파일 업로드 (Supabase Storage)
// ============================================================

export async function uploadTaskFile(file: File, taskId: number): Promise<{
  name: string;
  url: string;
  path: string;
}> {
  const ext = file.name.split('.').pop() || '';
  const safeName = file.name.replace(/[^\w.\-가-힣 ]+/g, '_');
  const path = `task-${taskId}/${uuidv4()}-${safeName}${ext ? '' : ''}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`파일 업로드 실패: ${error.message}`);
  // private 버킷이라 signed URL 으로 (1년)
  const { data: signed, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365);
  if (sErr || !signed) throw new Error(`파일 URL 생성 실패: ${sErr?.message}`);
  return { name: file.name, url: signed.signedUrl, path };
}

export async function deleteTaskFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`파일 삭제 실패: ${error.message}`);
}

// ============================================================
// D-day → 절대일 환산
// ============================================================

/**
 * 결산 기준일 (D-0) 계산.
 * (cm_year, cm_month) 다음 달의 **첫 영업일** (주말·공휴일 제외)
 * 예: 4월 결산 → 5월 1일에서 출발, 주말이면 5월 2~3일로 이동
 */
export function getBaseDate(cmYear: number, cmMonth: number, holidays: Set<string>): Date {
  // 다음 달 1일
  const nextMonth0 = cmMonth + 1;
  const yr = nextMonth0 > 12 ? cmYear + 1 : cmYear;
  const mn = nextMonth0 > 12 ? 1 : nextMonth0;
  let d = new Date(yr, mn - 1, 1);
  // 영업일까지 전진
  while (!isBusinessDay(d, holidays)) {
    d = addDays(d, 1);
  }
  return d;
}

function isBusinessDay(d: Date, holidays: Set<string>): boolean {
  const day = d.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  if (holidays.has(toIsoDate(d))) return false;
  return true;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 'D-3', 'D+4', 'D+0', 'D-0' 등을 영업일 기준 절대일로 변환.
 * 부호와 절댓값을 추출해 영업일 단위로 ± N 일.
 * 'D-0' 또는 'D+0' = baseDate 그대로.
 */
export function resolveDDay(
  ddayExpr: string | null | undefined,
  baseDate: Date,
  holidays: Set<string>,
): Date | null {
  if (!ddayExpr) return null;
  const m = ddayExpr.trim().match(/^D\s*([+-])\s*(\d+)$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const n = parseInt(m[2], 10);
  if (n === 0) return new Date(baseDate);
  // 영업일 단위로 ± N
  let d = new Date(baseDate);
  let remain = n;
  while (remain > 0) {
    d = addDays(d, sign);
    if (isBusinessDay(d, holidays)) remain -= 1;
  }
  return d;
}

export { toIsoDate, isBusinessDay, addDays };
