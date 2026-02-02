/**
 * Financial Result 관련 타입 정의
 */

export interface FinancialResultFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  fiscal_year: number;
  quarter: number;
  uploaded_by: string | null;
  uploaded_at: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialResultData {
  id: string;
  file_id: string;
  entity: string;
  subsidiary_id: string | null; // subsidiaries 테이블 참조 (nullable - 연결조정 등은 NULL)
  period: string; // "20254Q" 형식
  rev_account: string; // "매출", "매출원가", "판관비" 등
  amount_krw: number;
  created_at: string;
}

export interface FinancialResultDataWithFile extends FinancialResultData {
  financial_result_files: FinancialResultFile;
}

export interface FinancialResultDataWithSubsidiary extends FinancialResultData {
  subsidiaries: {
    id: string;
    name: string;
    code: string;
  } | null;
}

/**
 * 분기별 증감 분석 데이터
 */
export interface QuarterComparison {
  period: string; // "20254Q"
  fiscalYear: number;
  quarter: number;
  entity: string;
  subsidiaryName: string | null; // subsidiaries.name (subsidiary_id가 있는 경우)
  revAccount: string;
  currentAmount: number; // 현재 분기 금액
  previousAmount: number | null; // 전 분기 금액 (QoQ)
  previousYearAmount: number | null; // 전년 동분기 금액 (YoY)
  qoqChange: number | null; // 전 분기 대비 증감
  qoqChangePercent: number | null; // 전 분기 대비 증감률 (%)
  yoyChange: number | null; // 전년 동분기 대비 증감
  yoyChangePercent: number | null; // 전년 동분기 대비 증감률 (%)
}

/**
 * Rev Account 목록 (정의된 순서)
 */
export const REV_ACCOUNT_ORDER = [
  '매출',
  '매출원가',
  '인건비',
  '복리후생비',
  '광고선전비',
  '지급수수료',
  '운반비',
  '경상연구개발비',
  '판매수수료',
  '여비교통비',
  '대손상각비',
  '감가상각비',
  '사용권자산상각비',
  '기타',
  '영업외수익',
  '영업외비용',
  '금융수익',
  '금융비용',
  '지분법손익',
  '법인세비용',
  '세후중단영업손익',
  '당기순이익',
  '포괄손익',
  '총포괄손익',
] as const;

export type RevAccount = typeof REV_ACCOUNT_ORDER[number];
