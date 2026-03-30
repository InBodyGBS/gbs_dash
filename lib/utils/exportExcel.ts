/**
 * Excel 파일 생성 및 다운로드 유틸리티
 */
 
import { format } from 'date-fns';
import type { Issue } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';
import type { System, SystemCategory, Task, Project, TaskHistory } from '@/lib/types/system';
 
/**
 * 이슈 목록을 Excel 파일로 다운로드
 */
export async function exportIssuesToExcel(
  issues: Issue[],
  subsidiaries: Subsidiary[],
  filename?: string
) {
  const XLSX = await import('xlsx');
 
  const subsidiaryMap = new Map(subsidiaries.map((s) => [s.id, s]));
 
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
 
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Issues');
 
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 15 },
    { wch: 20 },
    { wch: 10 },
    { wch: 50 },
    { wch: 50 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];
 
  const fileName = filename || `Issues_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
 
/**
 * 시스템 현황을 Excel 파일로 다운로드
 */
export async function exportSystemsToExcel(
  subsidiaries: Subsidiary[],
  systems: System[],
  categories: SystemCategory[],
  filename?: string
) {
  const XLSX = await import('xlsx');
 
  const systemsMap = new Map<string, System>();
  systems.forEach((system) => {
    const key = `${system.entity_id}_${system.category}`;
    systemsMap.set(key, system);
  });
 
  const excelData = subsidiaries.map((subsidiary) => {
    const row: Record<string, string> = {
      'Entity': subsidiary.name,
      'Code': subsidiary.code,
      'Country': subsidiary.country,
      'Region': subsidiary.region,
    };
    categories.forEach((category) => {
      const key = `${subsidiary.id}_${category}`;
      const system = systemsMap.get(key);
      row[category] = system?.system_name || '-';
    });
    return row;
  });
 
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Systems');
 
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    ...categories.map(() => ({ wch: 20 })),
  ];
 
  const fileName = filename || `Systems_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
 
/**
 * WBS (Task 리스트)를 Excel 파일로 다운로드
 */
export async function exportWBSToExcel(
  project: Project,
  tasks: Task[],
  filename?: string
) {
  const XLSX = await import('xlsx');
 
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
 
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
 
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
 
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 40 },
    { wch: 50 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ];
 
  const fileName = filename || `WBS_${project.title}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
 
/**
 * Task 히스토리를 Excel 파일로 다운로드
 */
export async function exportTaskHistoriesToExcel(
  task: Task,
  histories: TaskHistory[],
  filename?: string
) {
  const XLSX = await import('xlsx');
 
  const excelData = histories.map((history, index) => ({
    '순번': index + 1,
    '요청일자': history.request_date ? format(new Date(history.request_date), 'yyyy-MM-dd') : '-',
    '회신일자': history.response_date ? format(new Date(history.response_date), 'yyyy-MM-dd') : '-',
    '완료일자': history.completion_date ? format(new Date(history.completion_date), 'yyyy-MM-dd') : '-',
    '설명': history.description || '-',
    '생성일': format(new Date(history.created_at), 'yyyy-MM-dd HH:mm'),
    '수정일': format(new Date(history.updated_at), 'yyyy-MM-dd HH:mm'),
  }));
 
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
 
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
 
  worksheet['!cols'] = [
    { wch: 5 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 50 },
    { wch: 18 },
    { wch: 18 },
  ];
 
  const fileName = filename || `Task_History_${task.task_number}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}