/**
 * 회계기준 카드뉴스 타입 정의
 */

export interface AccountingStandard {
  id: string;
  standard_code: string;
  standard_name: string;
  country: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardCategory {
  id: string;
  standard_id: string;
  category_name: string;
  category_name_en: string | null;
  display_order: number;
  icon: string | null;
  color: string | null;
  created_at: string;
}

export interface CardNews {
  id: string;
  category_id: string;
  card_number: number;
  title: string;
  title_en: string | null;
  subtitle: string | null;
  content: string;
  content_en: string | null;
  key_points: string[] | null;
  examples: Record<string, unknown> | unknown[] | string | number | boolean | null;
  visual_data: VisualData | null;
  tags: string[] | null;
  is_important: boolean;
  created_at: string;
  updated_at: string;
}

export interface CardReference {
  id: string;
  card_id: string;
  reference_type: string;
  reference_name: string;
  reference_url: string | null;
  description: string | null;
  created_at: string;
}

export interface PracticalTip {
  id: string;
  card_id: string;
  tip_content: string;
  tip_type: 'warning' | 'info' | 'best_practice' | null;
  display_order: number | null;
  created_at: string;
}

/**
 * 카드뉴스 전체 정보 (뷰 사용)
 */
export interface CardNewsFull {
  id: string;
  card_number: number;
  title: string;
  title_en: string | null;
  subtitle: string | null;
  content: string;
  content_en: string | null;
  key_points: string[] | null;
  examples: Record<string, unknown> | unknown[] | string | number | boolean | null;
  visual_data: VisualData | null;
  tags: string[] | null;
  is_important: boolean;
  category_name: string;
  category_name_en: string | null;
  category_icon: string | null;
  category_color: string | null;
  standard_code: string;
  standard_name: string;
  country: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 카드뉴스 상세 정보 (참고자료 및 실무팁 포함)
 */
export interface CardNewsDetail extends CardNewsFull {
  references?: CardReference[];
  practical_tips?: PracticalTip[];
}

/**
 * 시각 데이터 타입
 */
export interface VisualData {
  type: 'table' | 'chart';
  data: {
    headers?: string[];
    rows?: unknown[][];
    labels?: string[];
    values?: number[];
    [key: string]: unknown;
  };
}
