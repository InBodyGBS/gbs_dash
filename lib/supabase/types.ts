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
  contact_email: string | null;
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
  currency: string | null;
  revenue_fcy: number | null;
  operating_profit_fcy: number | null;
  sga_krw: number | null;
  sga_fcy: number | null;
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
 * Helper type for a permissive table entry that satisfies GenericTable
 */
type AnyTable = { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };

/**
 * Supabase 데이터베이스 스키마
 */
export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Tables: {
      subsidiaries: {
        Row: Subsidiary & { [key: string]: unknown };
        Insert: Omit<Subsidiary, 'id' | 'created_at'> & { [key: string]: unknown };
        Update: Partial<Omit<Subsidiary, 'id' | 'created_at'>> & { [key: string]: unknown };
        Relationships: [];
      };
      submissions: {
        Row: {
          id: string;
          quarter_id: string | null;
          subsidiary_id: string | null;
          fiscal_year: string | null;
          entity_name: string | null;
          category: string;
          file_name: string;
          file_path: string;
          file_size: number;
          version: number;
          submitted_by: string | null;
          submitted_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quarter_id?: string | null;
          subsidiary_id?: string | null;
          fiscal_year?: string | null;
          entity_name?: string | null;
          category: string;
          file_name: string;
          file_path: string;
          file_size: number;
          version?: number;
          submitted_by?: string | null;
          submitted_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quarter_id?: string | null;
          subsidiary_id?: string | null;
          fiscal_year?: string | null;
          entity_name?: string | null;
          category?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          version?: number;
          submitted_by?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      reminder_logs: {
        Row: {
          id: string;
          schedule_item_id: string;
          subsidiary_id: string;
          quarter_id: string;
          category: string;
          recipient_email: string;
          sent_at: string;
          email_id: string | null;
          status: 'sent' | 'failed';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_item_id: string;
          subsidiary_id: string;
          quarter_id: string;
          category: string;
          recipient_email: string;
          sent_at?: string;
          email_id?: string | null;
          status?: 'sent' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          schedule_item_id?: string;
          subsidiary_id?: string;
          quarter_id?: string;
          category?: string;
          recipient_email?: string;
          sent_at?: string;
          email_id?: string | null;
          status?: 'sent' | 'failed';
          error_message?: string | null;
        };
        Relationships: [];
      };
      financial_data: {
        Row: FinancialData & { [key: string]: unknown };
        Insert: Omit<FinancialData, 'id' | 'created_at' | 'updated_at'> & { [key: string]: unknown };
        Update: Partial<Omit<FinancialData, 'id' | 'created_at' | 'updated_at'>> & { [key: string]: unknown };
        Relationships: [];
      };
      quarters: {
        Row: {
          id: string;
          year: number;
          quarter: number;
          start_date: string;
          end_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          quarter: number;
          start_date: string;
          end_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          quarter?: number;
          start_date?: string;
          end_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      schedule_items: {
        Row: {
          id: string;
          quarter_id: string;
          subsidiary_id: string;
          category: string;
          planned_date: string;
          confirmed_date: string | null;
          status: 'planned' | 'confirmed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quarter_id: string;
          subsidiary_id: string;
          category: string;
          planned_date: string;
          confirmed_date?: string | null;
          status?: 'planned' | 'confirmed' | 'submitted';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quarter_id?: string;
          subsidiary_id?: string;
          category?: string;
          planned_date?: string;
          confirmed_date?: string | null;
          status?: 'planned' | 'confirmed' | 'submitted';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_submissions: {
        Row: {
          id: string;
          quarter_id: string;
          subsidiary_id: string;
          category: string;
          file_name: string;
          file_path: string;
          file_size: number;
          version: number;
          submitted_by: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          quarter_id: string;
          subsidiary_id: string;
          category: string;
          file_name: string;
          file_path: string;
          file_size: number;
          version?: number;
          submitted_by?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          quarter_id?: string;
          subsidiary_id?: string;
          category?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number;
          version?: number;
          submitted_by?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      closing_guides: {
        Row: {
          id: string;
          title: string;
          category: string;
          icon: string | null;
          summary: string | null;
          content: string;
          attachments: Record<string, unknown> | null;
          tags: string[] | null;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category: string;
          icon?: string | null;
          summary?: string | null;
          content: string;
          attachments?: Record<string, unknown> | null;
          tags?: string[] | null;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          icon?: string | null;
          summary?: string | null;
          content?: string;
          attachments?: Record<string, unknown> | null;
          tags?: string[] | null;
          view_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // Additional tables used in the application
      accounting_standards: AnyTable;
      card_categories: AnyTable;
      card_news_full: AnyTable;
      card_references: AnyTable;
      practical_tips: AnyTable;
      arap_submissions: AnyTable;
      arap_submission_details: AnyTable;
      bs_results: AnyTable;
      closing_questions: AnyTable;
      closing_topics: AnyTable;
      coa_mapping: AnyTable;
      financial_result_data: AnyTable;
      financial_result_files: AnyTable;
      gbs_calendar_events: AnyTable;
      issues: AnyTable;
      monthly_review_statuses: AnyTable;
      monthly_submissions: AnyTable;
      pl_results: AnyTable;
      preliminary_sales_sga: AnyTable;
      processes: AnyTable;
      projects: AnyTable;
      question_views: AnyTable;
      std_bs_master: AnyTable;
      std_pl_master: AnyTable;
      submission_comments: AnyTable;
      systems: AnyTable;
      task_histories: AnyTable;
      tasks: AnyTable;
      tb_raw_data: AnyTable;
      tb_uploads: AnyTable;
      user_profiles: AnyTable;
      work_manuals: AnyTable;
    };
  };
}

