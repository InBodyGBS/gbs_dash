-- ============================================================
-- schedule_items: attribution_month 컬럼 추가 + UNIQUE 제약 변경
--
-- 배경
--   기존 UNIQUE (quarter_id, subsidiary_id, category) 때문에
--   한 분기 안에서 같은 카테고리를 여러 귀속월에 각각 다른 날짜로 설정하면
--   같은 row 가 덮어써져 직전 월 설정이 사라지는 버그가 있었음.
--
--   본 마이그레이션은 attribution_month 컬럼을 추가하고, UNIQUE 키에
--   attribution_month 를 포함시켜 귀속월별로 별도 row 가 유지되도록 한다.
--
-- 데이터 모델
--   attribution_year/attribution_month  = 결산 귀속월 (사용자가 페이지에서 선택)
--   planned_date 의 월(calendar month) = attribution_month + 1 (12월 → 다음 해 1월)
--
-- 실행: Supabase Dashboard > SQL Editor
-- 안전 재실행 가능 (IF NOT EXISTS / IF EXISTS 사용)
-- ============================================================

-- 1) 컬럼 추가
ALTER TABLE public.schedule_items
  ADD COLUMN IF NOT EXISTS attribution_year  INTEGER,
  ADD COLUMN IF NOT EXISTS attribution_month INTEGER;

-- 2) 기존 데이터 backfill — planned_date 로부터 귀속월 역산
--    calendar 월 = planned_date 의 month
--    attribution 월 = calendar 월 - 1 (1월이면 12, 연도도 한 해 전)
UPDATE public.schedule_items
SET
  attribution_year = CASE
    WHEN EXTRACT(MONTH FROM planned_date::date)::int = 1
      THEN EXTRACT(YEAR FROM planned_date::date)::int - 1
    ELSE EXTRACT(YEAR FROM planned_date::date)::int
  END,
  attribution_month = CASE
    WHEN EXTRACT(MONTH FROM planned_date::date)::int = 1
      THEN 12
    ELSE EXTRACT(MONTH FROM planned_date::date)::int - 1
  END
WHERE attribution_month IS NULL
  AND planned_date IS NOT NULL;

-- 3) NOT NULL 강제 — 이후 모든 insert/upsert 가 채워야 함
ALTER TABLE public.schedule_items
  ALTER COLUMN attribution_year  SET NOT NULL,
  ALTER COLUMN attribution_month SET NOT NULL;

-- 4) 기존 UNIQUE 제약 제거 (이름은 Supabase 자동 생성 패턴)
--    DB에 따라 제약 이름이 다를 수 있어 두 형태 모두 시도
ALTER TABLE public.schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_quarter_id_subsidiary_id_category_key;
ALTER TABLE public.schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_quarter_subsidiary_category_unique;

-- 혹시 named index 형태라면 한번 더
DROP INDEX IF EXISTS schedule_items_quarter_id_subsidiary_id_category_key;
DROP INDEX IF EXISTS schedule_items_quarter_subsidiary_category_unique;

-- 5) 새 UNIQUE 제약: 귀속월 포함
ALTER TABLE public.schedule_items
  DROP CONSTRAINT IF EXISTS schedule_items_q_s_c_attr_unique;
ALTER TABLE public.schedule_items
  ADD CONSTRAINT schedule_items_q_s_c_attr_unique
  UNIQUE (quarter_id, subsidiary_id, category, attribution_month);

-- 6) (선택) 조회 성능용 인덱스 — 자주 attribution_month 단독으로 필터하지 않으면 생략 가능
-- CREATE INDEX IF NOT EXISTS schedule_items_attr_idx
--   ON public.schedule_items (attribution_year, attribution_month);

-- ============================================================
-- 검증
-- ============================================================
-- 기대값:
--   같은 quarter + sub + category 라도 attribution_month 가 다르면 별도 row.
--   기존 데이터는 attribution_month 가 모두 채워진 상태.
--
-- 확인 쿼리:
--   SELECT quarter_id, subsidiary_id, category, attribution_month, planned_date
--     FROM schedule_items
--    ORDER BY quarter_id, subsidiary_id, category, attribution_month;
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.schedule_items'::regclass;
