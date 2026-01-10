/**
 * Excel 파일 생성 및 다운로드 유틸리티
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Issue } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';

/**
 * 이슈 목록을 Excel 파일로 다운로드
 */
export function exportIssuesToExcel(
  issues: Issue[],
  subsidiaries: Subsidiary[],
  filename?: string
) {
  // 법인 정보 매핑
  const subsidiaryMap = new Map(subsidiaries.map((s) => [s.id, s]));

  // Excel 데이터 생성
  const excelData = issues.map((issue, index) => {
    const subsidiary = subsidiaryMap.get(issue.entity_id);
    
    return {
      '순번': index + 1,
      '제목': issue.title,
      '카테고리': issue.category,
      'Entity': subsidiary?.name || 'Unknown',
      '상태': issue.status,
      '설명': issue.description,
      '대응 내용': issue.response || '-',
      '작성자': issue.created_by,
      '생성일': format(new Date(issue.created_at), 'yyyy-MM-dd HH:mm'),
      '수정일': format(new Date(issue.updated_at), 'yyyy-MM-dd HH:mm'),
      '완료일': issue.completed_at ? format(new Date(issue.completed_at), 'yyyy-MM-dd HH:mm') : '-',
    };
  });

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Issues');

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 5 },   // 순번
    { wch: 40 },  // 제목
    { wch: 15 },  // 카테고리
    { wch: 20 },  // Entity
    { wch: 10 },  // 상태
    { wch: 50 },  // 설명
    { wch: 50 },  // 대응 내용
    { wch: 10 },  // 작성자
    { wch: 18 },  // 생성일
    { wch: 18 },  // 수정일
    { wch: 18 },  // 완료일
  ];
  worksheet['!cols'] = columnWidths;

  // 파일 다운로드
  const fileName = filename || `Issues_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

