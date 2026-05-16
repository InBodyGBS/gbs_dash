-- ============================================
-- Accounting Treatment 카드뉴스 추가
-- 토픽: Incoterms & Inventory Recognition
--
-- 위치: inventory_git (order 2), inventory_count (order 3) 다음에 배치하기 위해
-- 기존 4번 이후 항목들을 +1 씩 밀고 새 토픽을 order_index=4로 INSERT.
--
-- 멱등성: 기존 데이터가 이미 시프트되어 있어도 안전하게 동작하도록
-- 1) 새 토픽을 먼저 UPSERT (order_index=4)
-- 2) 다른 토픽들의 order_index 를 코드별로 명시적 SET (현재 값 무관)
-- ============================================

-- 1) 신규 토픽 추가/갱신
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index)
VALUES (
  'incoterms_inventory',
  'Incoterms & Inventory Recognition',
  'inventory',
  '🚢',
  'Verify inventory ownership transfer point based on Incoterms (FOB, DDP, etc.)',
  '# Incoterms & Inventory Recognition

## 📌 Overview
Accounting personnel must verify the inventory ownership transfer point based on Incoterms. Accurate recording of Goods in Transit (GIT) or Inventory at the correct month-end cut-off is essential.

## 📋 Key Incoterms
- **EXW (Ex Works)** — Risk and ownership transfer at the HQ factory / designated places.
- **FOB (Free on Board)** — Risk and ownership transfer once goods are loaded onto the vessel.
- **CIF (Cost, Insurance, and Freight)** — Seller pays costs/insurance to destination, but ownership transfers at shipment.
- **DDP (Delivered Duty Paid)** — Seller bears all risks and costs (including duties) until delivery to destination.

> The majority of inventory transfers from Headquarters to global subsidiaries are executed based on **FOB or DDP** Incoterms.

## ✅ Accounting Procedures
1. **Verify Terms** — Confirm Incoterms on CIPL or customs documents.
2. **Check Shipping Status** — Coordinate with HQ Sales Management for actual departure dates.
3. **Recognition Timing** — Determine if it should be "Goods in Transit" or "Inventory".
4. **Record Adjustment** — Process month-end manual journals if necessary.

## 📝 Journal Entry (Goods in Transit)
For goods belonging to the subsidiary but not yet arrived (**EXW, FOB, CIF**):

> *No GIT entry is required for DDP shipments, as inventory is recognized only at the point of delivery.*

### A. Month-end Recognition (Accrual)
```
(Dr) Goods in Transit (GIT) XXX
(Cr) Accounts Payable          XXX
```

### B. Beginning of Next Month (Reversal)
```
(Dr) Accounts Payable          XXX
(Cr) Goods in Transit (GIT) XXX
```

> Once the order arrives at the warehouse and the inspection of the quantity is complete, please proceed with the itemized purchase entry, consistent with standard acquisition procedures. *(Incidental import costs according to each condition must be capitalized into the inventory value.)*

## ⚠️ Crucial Notes
- **Reversal Logic** — Reversal entry is used to avoid double-counting with the ERP''s automated goods receipt (GR) process.
- **Manual Journals** — Record GIT as a total amount manual journal (lump-sum), not itemized entry.
- **DDP Exception** — No accounting entry is required until physical arrival at the warehouse.',
  4
)
ON CONFLICT (code) DO UPDATE SET
  title         = EXCLUDED.title,
  category      = EXCLUDED.category,
  icon          = EXCLUDED.icon,
  description   = EXCLUDED.description,
  content       = EXCLUDED.content,
  order_index   = EXCLUDED.order_index,
  is_active     = TRUE;

-- 2) 다른 토픽들의 order_index 재정렬 (4번 이후 +1)
--    code 기준으로 명시 — 멱등하게 동작
UPDATE closing_topics SET order_index = 5  WHERE code = 'accrued_general';
UPDATE closing_topics SET order_index = 6  WHERE code = 'accrued_compensation';
UPDATE closing_topics SET order_index = 7  WHERE code = 'ar_bad_debt';
UPDATE closing_topics SET order_index = 8  WHERE code = 'ar_allowance';
UPDATE closing_topics SET order_index = 9  WHERE code = 'fx_revaluation';
UPDATE closing_topics SET order_index = 10 WHERE code = 'fixed_assets';

-- ============================================
-- 검증 — 전체 토픽 순서 확인
-- ============================================
SELECT order_index, code, title, category, icon
FROM closing_topics
WHERE is_active = TRUE
ORDER BY order_index;
