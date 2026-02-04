/**
 * 회계기준 카드뉴스 서비스
 * Supabase에서 회계기준 카드뉴스 데이터를 조회하는 함수들
 */

import { supabase } from '@/lib/supabase/client';
import type {
  AccountingStandard,
  CardCategory,
  CardNewsFull,
  CardNewsDetail,
  CardReference,
  PracticalTip,
} from '@/lib/types/accounting-standards';

/**
 * 모든 회계기준 조회
 */
export async function getAccountingStandards(): Promise<AccountingStandard[]> {
  try {
    const { data, error } = await supabase
      .from('accounting_standards')
      .select('*')
      .order('standard_code');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching accounting standards:', error);
    return [];
  }
}

/**
 * 특정 회계기준의 카테고리 조회
 */
export async function getCardCategories(
  standardCode: string
): Promise<CardCategory[]> {
  try {
    // 먼저 standard_id를 찾기
    const { data: standard, error: standardError } = await supabase
      .from('accounting_standards')
      .select('id')
      .eq('standard_code', standardCode)
      .single();

    if (standardError) throw standardError;
    if (!standard) return [];

    // standard_id로 카테고리 조회
    const { data, error } = await supabase
      .from('card_categories')
      .select('*')
      .eq('standard_id', standard.id)
      .order('display_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching card categories:', error);
    return [];
  }
}

/**
 * 카드뉴스 조회 (뷰 사용)
 * @param standardCode - 회계기준 코드 ('IFRS', 'DUTCH_GAAP' 등)
 * @param categoryName - 카테고리 이름 (선택사항)
 * @param searchQuery - 검색어 (제목, 본문, 태그 검색)
 */
export async function getCardNews(
  standardCode: string,
  categoryName?: string,
  searchQuery?: string
): Promise<CardNewsFull[]> {
  try {
    let query = supabase
      .from('card_news_full')
      .select('*')
      .eq('standard_code', standardCode)
      .order('card_number');

    if (categoryName) {
      query = query.eq('category_name', categoryName);
    }

    if (searchQuery && searchQuery.trim()) {
      // Supabase의 텍스트 검색은 ilike를 사용하거나, 별도로 필터링
      const searchLower = searchQuery.toLowerCase();
      const { data, error } = await query;
      
      if (error) throw error;
      
      // 클라이언트 사이드 필터링 (태그 검색 포함)
      const filtered = (data || []).filter((card) => {
        const titleMatch = card.title?.toLowerCase().includes(searchLower);
        const contentMatch = card.content?.toLowerCase().includes(searchLower);
        const tagMatch = card.tags?.some((tag) => 
          tag.toLowerCase().includes(searchLower)
        );
        return titleMatch || contentMatch || tagMatch;
      });
      
      return filtered;
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching card news:', error);
    return [];
  }
}

/**
 * 카드뉴스 상세 조회 (참고자료 및 실무팁 포함)
 */
export async function getCardNewsDetail(
  cardId: string
): Promise<CardNewsDetail | null> {
  try {
    // 1. 카드뉴스 기본 정보 조회
    const { data: cardData, error: cardError } = await supabase
      .from('card_news_full')
      .select('*')
      .eq('id', cardId)
      .single();

    if (cardError) throw cardError;
    if (!cardData) return null;

    // 2. 참고자료 조회
    const { data: references, error: refError } = await supabase
      .from('card_references')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at');

    if (refError) {
      console.warn('Error fetching references:', refError);
    }

    // 3. 실무팁 조회
    const { data: tips, error: tipsError } = await supabase
      .from('practical_tips')
      .select('*')
      .eq('card_id', cardId)
      .order('display_order');

    if (tipsError) {
      console.warn('Error fetching practical tips:', tipsError);
    }

    return {
      ...cardData,
      references: references || [],
      practical_tips: tips || [],
    };
  } catch (error) {
    console.error('Error fetching card news detail:', error);
    return null;
  }
}

/**
 * 중요 카드뉴스만 조회
 */
export async function getImportantCardNews(
  standardCode: string
): Promise<CardNewsFull[]> {
  try {
    const { data, error } = await supabase
      .from('card_news_full')
      .select('*')
      .eq('standard_code', standardCode)
      .eq('is_important', true)
      .order('card_number');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching important card news:', error);
    return [];
  }
}
