/**
 * Supabase 데이터베이스 타입 정의
 * subsidiaries, financial_data 테이블의 타입 정의
 */

/**
 * 법인 기본 정보
 */
export interface Subsidiary {
  id: string;
  name: string;
  code: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  region: 'Americas' | 'Europe' | 'Asia-Pacific';
  created_at: string;
}

/**
 * 재무 데이터
 */
export interface FinancialData {
  id: string;
  subsidiary_id: string;
  fiscal_year: number;
  quarter: number;
  revenue_krw: number;
  operating_profit_krw: number | null;
  target_revenue_krw: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * 법인 정보와 재무 데이터 조인 결과
 */
export interface FinancialDataWithSubsidiary extends FinancialData {
  subsidiaries: Subsidiary;
}

/**
 * Supabase 데이터베이스 스키마
 */
export interface Database {
  public: {
    Tables: {
      subsidiaries: {
        Row: Subsidiary;
        Insert: Omit<Subsidiary, 'id' | 'created_at'>;
        Update: Partial<Omit<Subsidiary, 'id' | 'created_at'>>;
      };
      financial_data: {
        Row: FinancialData;
        Insert: Omit<FinancialData, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FinancialData, 'id' | 'created_at' | 'updated_at'>>;
      };
      quarters: {
        Row: any;
        Insert: any;
        Update: any;
      };
      schedule_items: {
        Row: any;
        Insert: any;
        Update: any;
      };
      document_submissions: {
        Row: any;
        Insert: any;
        Update: any;
      };
      closing_guides: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
  };
}

