/**
 * 업무분장표 파일 파싱 유틸리티
 * Excel 및 Word 파일에서 법인별/개인별 업무 분장 정보 추출
 */

import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface WorkAssignment {
  id: string;
  type: '법인별' | '개인별';
  name: string; // 법인명 또는 개인명
  assignments: string[]; // 담당 업무 목록
  department?: string; // 부서 (개인별인 경우)
  entity?: string; // 법인 코드 (법인별인 경우)
  sheetName?: string; // 엑셀 시트명 (유형 구분용)
  fileName?: string; // 파일명
}

/**
 * HTML에서 테이블 데이터 추출
 */
function parseTableFromHTML(html: string): any[][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tables = doc.querySelectorAll('table');
  const allData: any[][] = [];

  tables.forEach((table) => {
    const rows = table.querySelectorAll('tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('td, th');
      const rowData: any[] = [];
      cells.forEach((cell) => {
        rowData.push(cell.textContent?.trim() || '');
      });
      if (rowData.length > 0) {
        allData.push(rowData);
      }
    });
  });

  return allData;
}

/**
 * 테이블 데이터를 업무 분장 정보로 변환
 */
function parseTableData(data: any[][], debugName?: string): WorkAssignment[] {
  const assignments: WorkAssignment[] = [];

  if (!data || data.length === 0) {
    console.log(`[${debugName}] No data to parse`);
    return assignments;
  }

  console.log(`[${debugName}] Parsing table with ${data.length} rows`);
  console.log(`[${debugName}] Headers:`, data[0]);

  // 첫 번째 행을 헤더로 사용
  const headers = data[0] || [];
  
  // 법인명/개인명 컬럼 인덱스 찾기
  const nameColIndex = headers.findIndex((h: string) => 
    typeof h === 'string' && (
      h.includes('법인') || 
      h.includes('개인') || 
      h.includes('이름') || 
      h.includes('Name') ||
      h.includes('Entity') ||
      h.includes('담당자') ||
      h.toLowerCase().includes('name') ||
      h.toLowerCase().includes('person') ||
      h.toLowerCase().includes('entity')
    )
  );

  console.log(`[${debugName}] Name column index:`, nameColIndex, nameColIndex >= 0 ? `(${headers[nameColIndex]})` : 'NOT FOUND');

  // 업무 컬럼 인덱스 찾기
  const assignmentColIndices = headers
    .map((h: string, idx: number) => 
      typeof h === 'string' && (
        h.includes('업무') || 
        h.includes('담당') || 
        h.includes('Work') ||
        h.includes('Task') ||
        h.includes('역할') ||
        h.includes('Description') ||
        h.toLowerCase().includes('work') ||
        h.toLowerCase().includes('task') ||
        h.toLowerCase().includes('role') ||
        h.toLowerCase().includes('responsibility')
      ) ? idx : -1
    )
    .filter((idx: number) => idx !== -1);

  console.log(`[${debugName}] Assignment column indices:`, assignmentColIndices, assignmentColIndices.map(idx => headers[idx]));

  // 이름 컬럼을 찾지 못한 경우, 첫 번째 컬럼을 이름으로 사용
  const finalNameColIndex = nameColIndex >= 0 ? nameColIndex : 0;
  if (nameColIndex < 0) {
    console.log(`[${debugName}] Name column not found, using first column as name`);
  }

  // 업무 컬럼을 찾지 못한 경우, 두 번째 컬럼부터를 업무로 사용
  const finalAssignmentColIndices = assignmentColIndices.length > 0 
    ? assignmentColIndices 
    : headers.slice(1).map((_, idx) => idx + 1);
  
  if (assignmentColIndices.length === 0) {
    console.log(`[${debugName}] Assignment columns not found, using columns 1+ as assignments`);
  }

  // 부서 컬럼 인덱스 찾기
  const departmentColIndex = headers.findIndex((h: string) => 
    typeof h === 'string' && (
      h.includes('부서') || 
      h.includes('팀') || 
      h.includes('Department') ||
      h.includes('Team') ||
      h.toLowerCase().includes('department') ||
      h.toLowerCase().includes('team')
    )
  );

  // 법인 코드 컬럼 인덱스 찾기
  const entityColIndex = headers.findIndex((h: string) => 
    typeof h === 'string' && (
      h.includes('코드') || 
      h.includes('Code') ||
      h.includes('Entity Code') ||
      h.toLowerCase().includes('code')
    )
  );

  // 데이터 행 처리 (헤더 제외)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // 이름 추출
    const name = finalNameColIndex >= 0 && row[finalNameColIndex] 
      ? String(row[finalNameColIndex]).trim() 
      : null;

    if (!name || name === '') {
      console.log(`[${debugName}] Row ${i}: Skipping - no name found`);
      continue;
    }

    // 업무 목록 추출
    const assignmentList: string[] = [];
    finalAssignmentColIndices.forEach((colIdx: number) => {
      if (colIdx >= 0 && colIdx < row.length && row[colIdx]) {
        const assignment = String(row[colIdx]).trim();
        if (assignment && assignment !== '' && assignment !== name) {
          assignmentList.push(assignment);
        }
      }
    });

    // 업무가 없으면 건너뛰기
    if (assignmentList.length === 0) {
      console.log(`[${debugName}] Row ${i} (${name}): Skipping - no assignments found`);
      continue;
    }

    console.log(`[${debugName}] Row ${i}: ${name} - ${assignmentList.length} assignments`);

    // 부서 추출
    const department = departmentColIndex >= 0 && row[departmentColIndex]
      ? String(row[departmentColIndex]).trim()
      : undefined;

    // 법인 코드 추출
    const entity = entityColIndex >= 0 && row[entityColIndex]
      ? String(row[entityColIndex]).trim()
      : undefined;

    // 헤더를 보고 법인별/개인별 판단
    const isEntityType = headers.some((h: string) => 
      typeof h === 'string' && h.includes('법인')
    );

    assignments.push({
      id: `row-${i}`,
      type: isEntityType ? '법인별' : '개인별',
      name,
      assignments: assignmentList,
      department,
      entity,
      sheetName: undefined, // parseTableData에서는 시트명을 모름
    });
  }

  return assignments;
}

/**
 * Word 파일을 파싱하여 업무 분장 정보 추출
 */
async function parseWordFile(arrayBuffer: ArrayBuffer): Promise<WorkAssignment[]> {
  try {
    // mammoth.js로 HTML 변환
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;

    // HTML에서 테이블 추출
    const data = parseTableFromHTML(html);
    console.log('Word file: Found', data.length, 'rows in table');
    if (data.length === 0) {
      throw new Error('테이블을 찾을 수 없습니다.');
    }

    return parseTableData(data, 'Word file');
  } catch (error) {
    console.error('Word file parsing error:', error);
    throw new Error('Word 파일 파싱 실패');
  }
}

/**
 * Excel 파일을 파싱하여 업무 분장 정보 추출
 */
async function parseExcelFile(arrayBuffer: ArrayBuffer): Promise<WorkAssignment[]> {
  try {
    // Excel 파일 읽기
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const assignments: WorkAssignment[] = [];

    // 모든 시트 순회
    workbook.SheetNames.forEach((sheetName, sheetIndex) => {
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

      // 빈 시트 건너뛰기
      if (!data || data.length === 0) return;

      // 테이블 데이터 파싱
      const sheetAssignments = parseTableData(data, `Sheet: ${sheetName}`);
      
      // 시트명을 보고 법인별/개인별 판단
      const isEntityType = 
        sheetName.includes('법인') || 
        sheetName.includes('Entity');
      
      sheetAssignments.forEach((assignment, idx) => {
        if (isEntityType) {
          assignment.type = '법인별';
        }
        assignment.id = `${sheetIndex}-${idx}`;
        assignment.sheetName = sheetName; // 시트명 저장
      });

      assignments.push(...sheetAssignments);
    });

    return assignments;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Excel 파일 파싱 실패');
  }
}

/**
 * 파일을 파싱하여 업무 분장 정보 추출 (Excel 및 Word 지원)
 */
export async function parseWorkAssignmentFile(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<WorkAssignment[]> {
  try {
    let assignments: WorkAssignment[];
    if (fileName.endsWith('.xlsx')) {
      assignments = await parseExcelFile(arrayBuffer);
    } else if (fileName.endsWith('.docx')) {
      assignments = await parseWordFile(arrayBuffer);
      // Word 파일의 경우 파일명을 시트명으로 사용
      assignments.forEach(a => {
        a.sheetName = fileName.replace(/\.docx$/i, '');
      });
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. (.xlsx 또는 .docx만 지원)');
    }
    
    // 모든 assignment에 파일명 추가
    assignments.forEach(a => {
      a.fileName = fileName;
    });
    
    return assignments;
  } catch (error) {
    console.error('Error parsing work assignment file:', error);
    throw error instanceof Error ? error : new Error('업무분장표 파일 파싱 실패');
  }
}
