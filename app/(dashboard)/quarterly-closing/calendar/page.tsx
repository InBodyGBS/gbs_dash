/**
 * 구 `/quarterly-closing/calendar` — Financial 탭 제거 후 Financial (T)로 이동
 */
import { redirect } from 'next/navigation';

export default function QuarterlyClosingCalendarRedirectPage() {
  redirect('/quarterly-closing/calendar-t');
}
