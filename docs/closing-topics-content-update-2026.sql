-- ============================================
-- Accounting Treatment 토픽 콘텐츠 업데이트
-- 첨부 리뷰 파일(accounting portal treatment페이지 review.docx) 기반 수정사항 반영
--
-- 영향 토픽: 5개 (revenue_cutoff, inventory_git, inventory_count, accrued_compensation, ar_allowance)
-- 변경 없음 토픽: general_accruals, ar_bad_debt, fx_revaluation, fixed_assets
-- ============================================

-- ────────────────────────────────────────────
-- 1. Revenue Cut-off
--    - 케이스별 결론 추가 (Jan revenue / Dec revenue / 각 delivery date)
--    - 섹션명: When to Record → Adjustment period by case
--    - 분개: 감액 케이스 추가
--    - Important: "분기 단위 이상 검토" 추가
-- ────────────────────────────────────────────
UPDATE closing_topics
SET
  description = 'Review December invoices and verify actual delivery (at least on a quarterly basis)',
  content = '# Revenue Cut-off

## 📌 Overview
Revenue cut-off ensures that revenue is recognized in the correct accounting period. Review all December invoices and verify that goods or services were actually delivered before year-end.

## 📋 Adjustment Period by Case
- Invoice issued in December but goods/services delivered in January → **Jan revenue**
- Invoice issued in January but goods/services delivered in December → **Dec revenue**
- Partial delivery scenarios → Recognize revenue based on each delivery date

## ✅ Steps
1. Review all December invoices
2. Verify actual delivery dates
3. Identify cut-off issues
4. Apply adjustments as needed

## 📝 Journal Entry
**If additional recognition of revenue needed:**
```
(Dr) Accounts Receivable XXX
(Cr) Revenue XXX
```

**If reduction of revenue needed:**
```
(Dr) Revenue XXX
(Cr) Accounts Receivable XXX
```

## ⚠️ Important
- Maintain supporting documentation
- Coordinate with sales team for delivery confirmations
- Review at least on a quarterly basis'
WHERE code = 'revenue_cutoff';

-- ────────────────────────────────────────────
-- 2. Goods in Transit (GIT)
--    - Incoterms 인용 풀어쓰기
--    - Step 2: 'as GIT per Incoterms (see reference table)' → 'based on Incoterms (refer to the reference table)'
--    - Step 4 / Important: '1/1 reversal' 의미 명확화
-- ────────────────────────────────────────────
UPDATE closing_topics
SET
  content = '# Goods in Transit (GIT)

## 📌 Overview
Goods in Transit (GIT) refers to purchases where the invoice has been received but the goods have not yet arrived. This is important for accurate inventory and accounts payable recording.

## 📋 When to Record
- Invoice received but goods not yet arrived
- Ownership transferred per Incoterms (FOB, CIF, etc.) — varies based on the ownership transfer period defined by the Incoterms
- Goods shipped but not received by year-end

## ✅ Steps
1. Identify purchases with invoice but goods not received yet
2. Recognize as GIT based on Incoterms (refer to the reference table)
3. Maintain related documentation (invoices, shipping docs)
4. Reverse entry on January 1st — adjust the recognition timing of GIT from FY2025 to January 2026

## 📝 Journal Entry
```
(Dr) Goods in Transit XXX
(Cr) Accounts Payable (Trade) XXX
```

## ⚠️ Important
- Create manual JE and reverse on 1st Jan 2026 — adjust the recognition timing of GIT from FY2025 to January 2026
- Keep all supporting documents
- Verify Incoterms for ownership transfer timing'
WHERE code = 'inventory_git';

-- ────────────────────────────────────────────
-- 3. Physical Inventory Count
--    - 단어 교체: variances → discrepancies, variances → adjustments(recognize)
--    - Important: 'document all variances' → 'document every discrepancy between book and physical inventories'
--
-- ※ 리뷰어 코멘트(미반영, 추후 검토): "Year-end physical count"와
--    "Significant variances between book and physical inventory"가 별개 항목으로
--    분리되어 헷갈린다는 지적. 별도로 구조 개선 검토 필요.
-- ────────────────────────────────────────────
UPDATE closing_topics
SET
  content = '# Physical Inventory Count

## 📌 Overview
Physical inventory count is conducted to verify the accuracy of inventory records and identify any discrepancies.

## 📋 When to Record
- Year-end physical count
- Significant variances between book inventory and physical inventory
- Obsolete or damaged inventory

## ✅ Steps
1. Schedule physical count
2. Count all inventory items
3. Compare with book records
4. Investigate discrepancies
5. Recognize adjustments

## 📝 Journal Entry
```
(Dr) Inventory Adjustment XXX
(Cr) Inventory XXX
```

## ⚠️ Important
- Complete count before year-end
- Document every discrepancy between book and physical inventories
- Review for obsolescence'
WHERE code = 'inventory_count';

-- ────────────────────────────────────────────
-- 4. Compensation Accruals
--    - 'Retirement pension obligations' → 'When required based on retirement pension obligations'
-- ────────────────────────────────────────────
UPDATE closing_topics
SET
  content = '# Compensation Accruals

## 📌 Overview
Accrue compensation-related expenses including performance bonuses, unused leave, and retirement pension.

## 📋 When to Record
- Performance bonuses earned but not paid
- Unused annual leave
- When required based on retirement pension obligations

## ✅ Steps
1. Calculate performance bonuses
2. Calculate unused leave liability
3. Calculate retirement pension
4. Record accrual entries

## 📝 Journal Entry
```
(Dr) Compensation Expense XXX
(Cr) Accrued Compensation XXX
```

## ⚠️ Important
- Follow local labor laws
- Document calculation methods
- Review with HR department'
WHERE code = 'accrued_compensation';

-- ────────────────────────────────────────────
-- 5. Allowance for Doubtful Accounts
--    - 'Individual receivables' (복수) → 'Individual receivable with collection concerns' (단수)
--    - Step 1: 'Review individual receivables' → 'Review individual receivable'
-- ────────────────────────────────────────────
UPDATE closing_topics
SET
  content = '# Allowance for Doubtful Accounts

## 📌 Overview
Establish or adjust allowance for doubtful accounts based on individual assessment of collection issues.

## 📋 When to Record
- Individual receivable with collection concerns
- Changes in customer creditworthiness
- Economic conditions affecting collectibility

## ✅ Steps
1. Review individual receivable
2. Assess collection probability
3. Calculate allowance amount
4. Record adjustment

## 📝 Journal Entry
```
(Dr) Bad Debt Expense XXX
(Cr) Allowance for Doubtful Accounts XXX
```

## ⚠️ Important
- Document assessment rationale
- Review regularly
- Adjust based on actual collections'
WHERE code = 'ar_allowance';

-- ============================================
-- 검증
-- ============================================
SELECT code, title, LEFT(content, 80) AS content_preview, updated_at
FROM closing_topics
WHERE code IN ('revenue_cutoff', 'inventory_git', 'inventory_count', 'accrued_compensation', 'ar_allowance')
ORDER BY order_index;
