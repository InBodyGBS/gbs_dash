import { format } from 'date-fns';
import type { SubmissionCommentExportRow } from '@/lib/services/submissionService';

export function submissionCommentsExcelFilename(prefix = 'submission-comments'): string {
  return `${prefix}-${format(new Date(), 'yyyyMMdd-HHmmss')}.xlsx`;
}

export async function downloadSubmissionCommentsExcel(
  rows: SubmissionCommentExportRow[],
  filename?: string,
): Promise<void> {
  const XLSX = await import('xlsx');
  const excelData = rows.map((r) => ({
    법인: r.entity,
    연도: r.year,
    월: r.month,
    카테고리: r.category_label,
    메모: r.comment,
    작성일시: format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
    작성자: r.author,
    파일명: r.file_name,
    '카테고리ID(참고)': r.category_id,
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '메모');

  const colWidths = [
    { wch: 28 },
    { wch: 8 },
    { wch: 6 },
    { wch: 22 },
    { wch: 50 },
    { wch: 20 },
    { wch: 18 },
    { wch: 36 },
    { wch: 18 },
  ];
  ws['!cols'] = colWidths;

  const name = filename ?? submissionCommentsExcelFilename();
  XLSX.writeFile(wb, name);
}
