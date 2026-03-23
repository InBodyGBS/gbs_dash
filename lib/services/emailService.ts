/**
 * Email service — 서버 전용 (Resend API)
 * API 라우트 또는 서버 컴포넌트에서만 import 할 것
 */
import { Resend } from 'resend';

export interface ReminderEmailPayload {
  to: string;
  subsidiaryName: string;
  category: string;
  plannedDate: string;
  fiscalYear: number;
  fiscalQuarter: number;
  daysOverdue: number;
}

export async function sendReminderEmail(
  payload: ReminderEmailPayload
): Promise<{ id: string } | { error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Resend 미설정 시 발송 건너뜀 (나중에 활성화 가능)
    return { error: 'RESEND_API_KEY not configured' };
  }
  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  const { data, error } = await resend.emails.send({
    from: 'GBS Dashboard <onboarding@resend.dev>',
    to: [payload.to],
    subject: `[Reminder] ${payload.subsidiaryName} — ${payload.category} (${payload.daysOverdue}일 초과)`,
    html: buildReminderHtml(payload, appUrl),
  });

  if (error) return { error: error.message };
  return { id: data!.id };
}

function buildReminderHtml(p: ReminderEmailPayload, appUrl: string): string {
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #971B2F;">Quarterly Closing 제출 독촉</h2>
      <p>안녕하세요,</p>
      <p>아래 항목의 제출 기한이 초과되었습니다. 빠른 시일 내에 제출 부탁드립니다.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px 12px; font-weight: bold; width: 40%;">법인</td>
          <td style="padding: 8px 12px;">${p.subsidiaryName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold;">카테고리</td>
          <td style="padding: 8px 12px;">${p.category}</td>
        </tr>
        <tr style="background: #f3f4f6;">
          <td style="padding: 8px 12px; font-weight: bold;">회계 기간</td>
          <td style="padding: 8px 12px;">${p.fiscalYear} Q${p.fiscalQuarter}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; font-weight: bold;">요청 완료 기한</td>
          <td style="padding: 8px 12px;">${p.plannedDate}</td>
        </tr>
        <tr style="background: #fee2e2;">
          <td style="padding: 8px 12px; font-weight: bold; color: #dc2626;">초과 일수</td>
          <td style="padding: 8px 12px; color: #dc2626; font-weight: bold;">${p.daysOverdue}일 초과</td>
        </tr>
      </table>
      ${appUrl ? `<p><a href="${appUrl}/quarterly-closing/submission" style="background: #971B2F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">제출 페이지로 이동</a></p>` : ''}
      <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af;">이 메일은 GBS Dashboard에서 자동으로 발송되었습니다.</p>
    </body>
    </html>
  `;
}
