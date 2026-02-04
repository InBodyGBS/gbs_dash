-- ========================================
-- Accounting Standards Card News Schema
-- 기존 테이블 삭제 스크립트
-- ========================================
-- 주의: 이 스크립트는 모든 데이터를 삭제합니다!
-- ========================================

-- 뷰 삭제
DROP VIEW IF EXISTS card_news_full CASCADE;

-- 트리거 삭제
DROP TRIGGER IF EXISTS update_card_news_updated_at ON card_news;
DROP TRIGGER IF EXISTS update_accounting_standards_updated_at ON accounting_standards;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 테이블 삭제 (참조 무결성 순서대로)
DROP TABLE IF EXISTS practical_tips CASCADE;
DROP TABLE IF EXISTS card_references CASCADE;
DROP TABLE IF EXISTS card_news CASCADE;
DROP TABLE IF EXISTS card_categories CASCADE;
DROP TABLE IF EXISTS accounting_standards CASCADE;

-- ========================================
-- 삭제 완료 확인
-- ========================================
-- 다음 쿼리로 확인:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('accounting_standards', 'card_categories', 'card_news', 'card_references', 'practical_tips');
