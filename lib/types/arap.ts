/**
 * Intercompany AR-AP Balance Reconciliation System
 * 타입 정의
 */

export type AccountType = 'AR' | 'AP' | 'Others';
export type SubmissionType = 'file' | 'manual';
export type MatchStatus = 'pending' | 'matched' | 'mismatched' | 'no_data';

/**
 * Entity 정보 (subsidiaries 테이블과 동일한 ID 사용)
 */
export interface ArapEntity {
  id: string;
  entity_name: string;
  entity_code: string;
  password_hash?: string;
  is_admin: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Submission (제출 정보)
 */
export interface ArapSubmission {
  id: string;
  entity_id: string;
  fiscal_year: number;
  fiscal_month: number;
  submission_type: SubmissionType;
  submission_date: string;
  file_path: string | null;
  total_items: number;
  match_status: MatchStatus;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Submission Detail (제출 상세 내역)
 */
export interface ArapSubmissionDetail {
  id: string;
  submission_id: string;
  invoice_date: string | null;
  counterparty_entity_id: string;
  account_type: AccountType;
  invoice_no: string | null;
  currency: string;
  amount: number;
  description: string | null;
  created_at: string;
}

/**
 * Submission with Details (제출 정보 + 상세 내역)
 */
export interface ArapSubmissionWithDetails extends ArapSubmission {
  submission_details: ArapSubmissionDetail[];
  entity?: ArapEntity;
}

/**
 * Submission Form Data (제출 폼 데이터)
 */
export interface ArapSubmissionFormData {
  fiscal_year: number;
  fiscal_month: number;
  submission_type: SubmissionType;
  items: ArapSubmissionDetailInput[];
  file?: File;
}

/**
 * Submission Detail Input (제출 상세 입력)
 */
export interface ArapSubmissionDetailInput {
  invoice_date?: string | null;
  counterparty_entity_id: string;
  account_type: AccountType;
  invoice_no?: string | null;
  currency: string;
  amount: number;
  description?: string | null;
}

/**
 * Match Status Summary (매칭 상태 요약)
 */
export interface MatchStatusSummary {
  entity_a_id: string;
  entity_b_id: string;
  entity_a_name: string;
  entity_b_name: string;
  fiscal_year: number;
  fiscal_month: number;
  status: MatchStatus;
  entity_a_ar: number; // A가 B에 대한 AR
  entity_a_ap: number; // A가 B에 대한 AP
  entity_b_ar: number; // B가 A에 대한 AR
  entity_b_ap: number; // B가 A에 대한 AP
  difference: number; // 차이 금액
  currency_breakdown?: CurrencyMatchBreakdown[]; // 통화별 상세 정보
}

/**
 * Currency Match Breakdown (통화별 매칭 상세)
 */
export interface CurrencyMatchBreakdown {
  currency: string;
  entity_a_ar: number;
  entity_a_ap: number;
  entity_b_ar: number;
  entity_b_ap: number;
  status: MatchStatus;
  difference: number;
}

/**
 * Monthly Status (월별 상태)
 */
export interface MonthlyStatus {
  entity_id: string;
  entity_name: string;
  fiscal_year: number;
  fiscal_month: number;
  status: MatchStatus;
  submission_count: number;
}

/**
 * Entity Match Matrix (Entity 매칭 매트릭스)
 */
export interface EntityMatchMatrix {
  entity_a_id: string;
  entity_a_name: string;
  entity_b_id: string;
  entity_b_name: string;
  status: MatchStatus;
}
