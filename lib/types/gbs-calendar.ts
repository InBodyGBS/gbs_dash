/**
 * GBS Calendar 타입 정의
 */

export interface GBSCalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD (시작일)
  end_date?: string; // YYYY-MM-DD (종료일, 기간 일정인 경우)
  time?: string; // HH:mm (선택적)
  title: string;
  assignee?: string; // 담당자
  created_at?: string;
  updated_at?: string;
}
