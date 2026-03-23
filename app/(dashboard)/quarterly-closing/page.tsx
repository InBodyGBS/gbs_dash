/**
 * Quarterly Closing 메인 페이지
 * /calendar로 자동 리다이렉트
 */

import { redirect } from 'next/navigation';

export default function QuarterlyClosingPage() {
  redirect('/quarterly-closing/calendar');
}
