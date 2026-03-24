/**
 * GBS Calendar 서비스
 * Supabase를 통한 일정 CRUD 작업
 */

import { supabase } from '@/lib/supabase/client';
import type { GBSCalendarEvent } from '@/lib/types/gbs-calendar';

type GBSCalendarRow = {
  id: string;
  date: string;
  end_date: string | null;
  time: string | null;
  title: string;
  assignee: string | null;
  created_at: string;
  updated_at: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

const isTableMissingError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
  return (
    code === '42P01' ||
    message.includes('does not exist') ||
    message.includes('Could not find the table')
  );
};

/**
 * 모든 일정 조회
 */
export async function getGBSCalendarEvents(): Promise<GBSCalendarEvent[]> {
  try {
    const { data, error } = await supabase
      .from('gbs_calendar_events')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true, nullsFirst: false });

    if (error) {
      // 테이블이 없을 경우 빈 배열 반환
      if (
        error.code === '42P01' ||
        error.message?.includes('does not exist') ||
        error.message?.includes('Could not find the table')
      ) {
        console.warn('gbs_calendar_events 테이블이 존재하지 않습니다. Supabase SQL Editor에서 docs/gbs-calendar-schema.sql을 실행하세요.');
        return [];
      }
      throw error;
    }

    return ((data || []) as unknown as GBSCalendarRow[]).map((item) => ({
      id: item.id,
      date: item.date,
      end_date: item.end_date || undefined,
      time: item.time || undefined,
      title: item.title,
      assignee: item.assignee || undefined,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  } catch (error: unknown) {
    console.error('Error fetching calendar events:', getErrorMessage(error));
    // 테이블이 없을 경우 빈 배열 반환
    if (isTableMissingError(error)) {
      return [];
    }
    throw new Error(`일정 조회 실패: ${getErrorMessage(error)}`);
  }
}

/**
 * 일정 추가
 */
export async function createGBSCalendarEvent(
  event: Omit<GBSCalendarEvent, 'id' | 'created_at' | 'updated_at'>
): Promise<GBSCalendarEvent> {
  const { data, error } = await supabase
    .from('gbs_calendar_events')
    .insert({
      date: event.date,
      end_date: event.end_date || null,
      time: event.time || null,
      title: event.title,
      assignee: event.assignee || null,
    })
    .select()
    .single();

  if (error) {
    if (
      error.code === '42P01' ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find the table')
    ) {
      throw new Error(
        `데이터베이스 저장 실패: 'gbs_calendar_events' 테이블이 없습니다. Supabase SQL Editor에서 docs/gbs-calendar-schema.sql을 실행하여 스키마를 생성하세요.`
      );
    }
    throw new Error(`일정 추가 실패: ${error.message}`);
  }

  const created = data as unknown as GBSCalendarRow;
  return {
    id: created.id,
    date: created.date,
    end_date: created.end_date || undefined,
    time: created.time || undefined,
    title: created.title,
    assignee: created.assignee || undefined,
    created_at: created.created_at,
    updated_at: created.updated_at,
  };
}

/**
 * 일정 수정
 */
export async function updateGBSCalendarEvent(
  id: string,
  event: Partial<Omit<GBSCalendarEvent, 'id' | 'created_at' | 'updated_at'>>
): Promise<GBSCalendarEvent> {
  const { data, error } = await supabase
    .from('gbs_calendar_events')
    .update({
      date: event.date,
      end_date: event.end_date || null,
      time: event.time || null,
      title: event.title,
      assignee: event.assignee || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (
      error.code === '42P01' ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find the table')
    ) {
      throw new Error(
        `데이터베이스 저장 실패: 'gbs_calendar_events' 테이블이 없습니다. Supabase SQL Editor에서 docs/gbs-calendar-schema.sql을 실행하여 스키마를 생성하세요.`
      );
    }
    throw new Error(`일정 수정 실패: ${error.message}`);
  }

  const updated = data as unknown as GBSCalendarRow;
  return {
    id: updated.id,
    date: updated.date,
    end_date: updated.end_date || undefined,
    time: updated.time || undefined,
    title: updated.title,
    assignee: updated.assignee || undefined,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  };
}

/**
 * 일정 삭제
 */
export async function deleteGBSCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('gbs_calendar_events')
    .delete()
    .eq('id', id);

  if (error) {
    if (
      error.code === '42P01' ||
      error.message?.includes('does not exist') ||
      error.message?.includes('Could not find the table')
    ) {
      throw new Error(
        `데이터베이스 삭제 실패: 'gbs_calendar_events' 테이블이 없습니다. Supabase SQL Editor에서 docs/gbs-calendar-schema.sql을 실행하여 스키마를 생성하세요.`
      );
    }
    throw new Error(`일정 삭제 실패: ${error.message}`);
  }
}

/**
 * 모든 일정 삭제
 */
export async function deleteAllGBSCalendarEvents(): Promise<void> {
  // 모든 일정 조회 후 개별 삭제
  const { data, error: fetchError } = await supabase
    .from('gbs_calendar_events')
    .select('id');

  if (fetchError) {
    if (
      fetchError.code === '42P01' ||
      fetchError.message?.includes('does not exist') ||
      fetchError.message?.includes('Could not find the table')
    ) {
      // 테이블이 없으면 삭제할 것이 없으므로 성공으로 처리
      return;
    }
    throw new Error(`일정 조회 실패: ${fetchError.message}`);
  }

  if (!data || data.length === 0) {
    return; // 삭제할 일정이 없음
  }

  const ids = ((data || []) as unknown as Array<{ id: string }>).map((item) => item.id);
  const { error } = await supabase
    .from('gbs_calendar_events')
    .delete()
    .in('id', ids);

  if (error) {
    throw new Error(`전체 일정 삭제 실패: ${error.message}`);
  }
}
