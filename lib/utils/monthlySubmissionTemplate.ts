/**
 * Monthly Closing 제출 템플릿 생성 유틸리티
 */

import type { MonthlyClosingCategoryId } from '@/lib/constants/monthly-closing-categories';
import { MONTHLY_CLOSING_CATEGORIES } from '@/lib/constants/monthly-closing-categories';

type TemplateCell = string | number;
type TemplateData = TemplateCell[][];

function getTemplateData(categoryId: MonthlyClosingCategoryId): TemplateData {
  const category = MONTHLY_CLOSING_CATEGORIES.find((cat) => cat.id === categoryId);
  const categoryLabel = category?.label || categoryId;

  const template: TemplateData = [
    ['Monthly Closing Template', '', '', ''],
    ['Category', categoryLabel, '', ''],
    ['Submission Date', '', '', ''],
    ['', '', '', ''],
    ['Item', 'Description', 'Amount', 'Notes'],
    ['Sample Item 1', 'Description here', 0, 'Notes here'],
    ['Sample Item 2', 'Description here', 0, 'Notes here'],
    ['Sample Item 3', 'Description here', 0, 'Notes here'],
  ];

  return template;
}

export async function downloadMonthlySubmissionTemplate(categoryId: MonthlyClosingCategoryId) {
  const XLSX = await import('xlsx');
  const category = MONTHLY_CLOSING_CATEGORIES.find((cat) => cat.id === categoryId);
  const categoryLabel = category?.label || categoryId;

  const templateData = getTemplateData(categoryId);
  const worksheet = XLSX.utils.aoa_to_sheet(templateData);

  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // 제목 행 병합
    { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }, // 카테고리 행 병합
    { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } }, // 제출일 행 병합
  ];

  worksheet['!cols'] = [
    { wch: 20 }, // Item
    { wch: 40 }, // Description
    { wch: 15 }, // Amount
    { wch: 30 }, // Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  const fileName = `Monthly_Closing_Template_${categoryLabel.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

