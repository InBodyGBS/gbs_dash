/**
 * Financial Closing 메인 페이지
 * Financial (T) 일정 화면으로 이동
 */

import { redirect } from 'next/navigation';

export default function QuarterlyClosingPage() {
  redirect('/quarterly-closing/calendar-t');
}
