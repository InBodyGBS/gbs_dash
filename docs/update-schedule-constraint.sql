-- ============================================
-- Schedule Items 제약 조건 업데이트
-- 하나의 셀에 여러 카테고리 허용
-- ============================================

-- 기존 UNIQUE 제약 조건 삭제
-- (quarter_id, subsidiary_id, category)에서 category를 제거하여
-- 같은 날짜에 여러 카테고리 추가 가능하게 함

-- 1. 기존 제약 조건 확인 및 삭제
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- 제약 조건 이름 찾기
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'schedule_items'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 3;
    
    -- 제약 조건 삭제
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE schedule_items DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE '✅ 기존 UNIQUE 제약 조건 삭제: %', constraint_name;
    END IF;
END $$;

-- 2. 새로운 UNIQUE 제약 조건 추가
-- 동일한 quarter_id, subsidiary_id, planned_date, category 조합만 제한
ALTER TABLE schedule_items 
ADD CONSTRAINT schedule_items_unique_constraint 
UNIQUE (quarter_id, subsidiary_id, planned_date, category);

-- 완료!
SELECT '✅ Schedule Items 제약 조건 업데이트 완료!' AS message;
SELECT '   이제 하나의 셀에 여러 카테고리를 추가할 수 있습니다.' AS note;

