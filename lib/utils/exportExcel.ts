/**
 * Excel 파일 생성 및 다운로드 유틸리티
 */

import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Issue } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';
import type { System, SystemCategory, Task, Project, TaskHistory } from '@/lib/types/system';

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

/**
 * 시스템 현황을 Excel 파일로 다운로드
 */
export function exportSystemsToExcel(
  subsidiaries: Subsidiary[],
  systems: System[],
  categories: SystemCategory[],
  filename?: string
) {
  // 법인 정보 매핑
  const subsidiaryMap = new Map(subsidiaries.map((s) => [s.id, s]));
  
  // 시스템 데이터를 맵으로 변환
  const systemsMap = new Map<string, System>();
  systems.forEach((system) => {
    const key = `${system.entity_id}_${system.category}`;
    systemsMap.set(key, system);
  });

  // Excel 데이터 생성 (법인별 행)
  const excelData = subsidiaries.map((subsidiary) => {
    const row: Record<string, any> = {
      'Entity': subsidiary.name,
      'Code': subsidiary.code,
      'Country': subsidiary.country,
      'Region': subsidiary.region,
    };

    // 각 카테고리별 시스템명 추가
    categories.forEach((category) => {
      const key = `${subsidiary.id}_${category}`;
      const system = systemsMap.get(key);
      row[category] = system?.system_name || '-';
    });

    return row;
  });

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Systems');

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 20 },  // Entity
    { wch: 10 },  // Code
    { wch: 15 },  // Country
    { wch: 15 },  // Region
    ...categories.map(() => ({ wch: 20 })), // 각 카테고리
  ];
  worksheet['!cols'] = columnWidths;

  // 파일 다운로드
  const fileName = filename || `Systems_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * WBS (Task 리스트)를 Excel 파일로 다운로드
 */
export function exportWBSToExcel(
  project: Project,
  tasks: Task[],
  filename?: string
) {
  // Excel 데이터 생성
  const excelData = tasks.map((task, index) => {
    const dDay = task.due_date
      ? Math.floor((new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const dDayText = dDay !== null 
      ? (dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day' : `D+${Math.abs(dDay)}`)
      : '-';

    return {
      '순번': index + 1,
      'Task 번호': task.task_number,
      'Task 명': task.title,
      '상세 설명': task.description || '-',
      '담당자': task.assignee,
      '상태': task.status,
      '진행률 (%)': task.progress,
      'Due Date': task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '-',
      'D-DAY': dDayText,
      '예상 공수 (시간)': task.estimated_hours || '-',
      '완료일': task.completed_date ? format(new Date(task.completed_date), 'yyyy-MM-dd') : '-',
      '생성일': format(new Date(task.created_at), 'yyyy-MM-dd'),
      '수정일': format(new Date(task.updated_at), 'yyyy-MM-dd'),
    };
  });

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  
  // 프로젝트 정보 시트 추가
  const projectInfo = [
    { 항목: '프로젝트명', 내용: project.title },
    { 항목: '카테고리', 내용: project.category },
    { 항목: '상태', 내용: project.status },
    { 항목: 'PM', 내용: project.pm },
    { 항목: '시작일', 내용: project.start_date ? format(new Date(project.start_date), 'yyyy-MM-dd') : '-' },
    { 항목: 'Due Date', 내용: project.due_date ? format(new Date(project.due_date), 'yyyy-MM-dd') : '-' },
    { 항목: '진행률 (%)', 내용: `${project.progress}%` },
    { 항목: '완료일', 내용: project.completion_date ? format(new Date(project.completion_date), 'yyyy-MM-dd') : '-' },
    { 항목: '설명', 내용: project.description || '-' },
  ];
  const infoSheet = XLSX.utils.json_to_sheet(projectInfo);
  
  XLSX.utils.book_append_sheet(workbook, infoSheet, '프로젝트 정보');
  XLSX.utils.book_append_sheet(workbook, worksheet, 'WBS');

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 5 },   // 순번
    { wch: 12 },  // Task 번호
    { wch: 40 },  // Task 명
    { wch: 50 },  // 상세 설명
    { wch: 12 },  // 담당자
    { wch: 10 },  // 상태
    { wch: 10 },  // 진행률
    { wch: 12 },  // Due Date
    { wch: 10 },  // D-DAY
    { wch: 15 },  // 예상 공수
    { wch: 12 },  // 완료일
    { wch: 12 },  // 생성일
    { wch: 12 },  // 수정일
  ];
  worksheet['!cols'] = columnWidths;

  // 파일 다운로드
  const fileName = filename || `WBS_${project.title}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Task 히스토리를 Excel 파일로 다운로드
 */
export function exportTaskHistoriesToExcel(
  task: Task,
  histories: TaskHistory[],
  filename?: string
) {
  // Excel 데이터 생성
  const excelData = histories.map((history, index) => {
    return {
      '순번': index + 1,
      '요청일자': history.request_date ? format(new Date(history.request_date), 'yyyy-MM-dd') : '-',
      '회신일자': history.response_date ? format(new Date(history.response_date), 'yyyy-MM-dd') : '-',
      '완료일자': history.completion_date ? format(new Date(history.completion_date), 'yyyy-MM-dd') : '-',
      '설명': history.description || '-',
      '생성일': format(new Date(history.created_at), 'yyyy-MM-dd HH:mm'),
      '수정일': format(new Date(history.updated_at), 'yyyy-MM-dd HH:mm'),
    };
  });

  // 워크북 생성
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  
  // Task 정보 시트 추가
  const taskInfo = [
    { 항목: 'Task 번호', 내용: task.task_number },
    { 항목: 'Task 명', 내용: task.title },
    { 항목: '담당자', 내용: task.assignee },
    { 항목: '상태', 내용: task.status },
    { 항목: 'Due Date', 내용: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '-' },
    { 항목: '완료일', 내용: task.completed_date ? format(new Date(task.completed_date), 'yyyy-MM-dd') : '-' },
    { 항목: '진행률 (%)', 내용: `${task.progress}%` },
    { 항목: '상세 설명', 내용: task.description || '-' },
  ];
  const infoSheet = XLSX.utils.json_to_sheet(taskInfo);
  
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Task 정보');
  XLSX.utils.book_append_sheet(workbook, worksheet, '히스토리');

  // 컬럼 너비 설정
  const columnWidths = [
    { wch: 5 },   // 순번
    { wch: 12 },  // 요청일자
    { wch: 12 },  // 회신일자
    { wch: 12 },  // 완료일자
    { wch: 50 },  // 설명
    { wch: 18 },  // 생성일
    { wch: 18 },  // 수정일
  ];
  worksheet['!cols'] = columnWidths;

  // 파일 다운로드
  const fileName = filename || `Task_History_${task.task_number}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
