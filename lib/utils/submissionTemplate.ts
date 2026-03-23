/**
 * Submission 템플릿 생성 유틸리티
 */

import * as XLSX from 'xlsx';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';

/**
 * 카테고리별 템플릿 데이터 생성
 */
type TemplateCell = string | number;
type TemplateData = TemplateCell[][];

function getTemplateData(categoryId: ClosingCategoryId): TemplateData {
  const category = CLOSING_CATEGORIES.find((cat) => cat.id === categoryId);
  const categoryLabel = category?.label || categoryId;

  // 기본 템플릿 구조 (카테고리에 따라 다를 수 있음)
  const template: TemplateData = [
    // 헤더
    ['Quarterly Report Template', '', '', ''],
    ['Category', categoryLabel, '', ''],
    ['Submission Date', '', '', ''],
    ['', '', '', ''],
    // 데이터 헤더 (예시)
    ['Item', 'Description', 'Amount', 'Notes'],
    // 샘플 데이터 행
    ['Sample Item 1', 'Description here', 0, 'Notes here'],
    ['Sample Item 2', 'Description here', 0, 'Notes here'],
    ['Sample Item 3', 'Description here', 0, 'Notes here'],
  ];

  return template;
}

/**
 * 카테고리별 Excel 템플릿 다운로드
 */
export function downloadSubmissionTemplate(categoryId: ClosingCategoryId) {
  const category = CLOSING_CATEGORIES.find((cat) => cat.id === categoryId);
  const categoryLabel = category?.label || categoryId;

  // 템플릿 데이터 생성
  const templateData = getTemplateData(categoryId);

  // 워크시트 생성
  const worksheet = XLSX.utils.aoa_to_sheet(templateData);

  // 스타일 설정 (헤더 행 스타일링)
  // 첫 번째 행 (제목) 병합 및 스타일
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // 제목 행 병합
    { s: { r: 1, c: 1 }, e: { r: 1, c: 3 } }, // 카테고리 행 병합
    { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } }, // 제출일 행 병합
  ];

  // 컬럼 너비 설정
  worksheet['!cols'] = [
    { wch: 20 }, // Item
    { wch: 40 }, // Description
    { wch: 15 }, // Amount
    { wch: 30 }, // Notes
  ];

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  // 파일명 생성
  const fileName = `Quarterly_Report_Template_${categoryLabel.replace(/\s+/g, '_')}.xlsx`;

  // 파일 다운로드
  XLSX.writeFile(workbook, fileName);
}
