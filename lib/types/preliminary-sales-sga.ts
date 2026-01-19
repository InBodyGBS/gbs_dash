/**
 * Preliminary Sales/SG&A 관련 타입 정의
 */

export interface PreliminarySalesSGA {
  id: string;
  quarter_id: string | null;
  subsidiary_id: string | null;
  period: '1Q' | '2Q' | '3Q' | '4Q';
  sales: number | null;
  sga: number | null;
  created_at: string;
  updated_at: string;
}

export interface PreliminarySalesSGAFormData {
  quarter_id?: string | null;
  subsidiary_id?: string | null;
  data: {
    period: '1Q' | '2Q' | '3Q' | '4Q';
    sales: number | null;
    sga: number | null;
  }[];
}
