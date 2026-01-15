-- ============================================
-- Reference Page Database Schema
-- Closing Topics and Q&A System
-- ============================================

-- 1. closing_topics 테이블 (결산 주제)
CREATE TABLE IF NOT EXISTS closing_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,  -- 'revenue_cutoff', 'inventory_git', etc.
  title TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'revenue', 'inventory', 'expenses', etc.
  icon TEXT,  -- emoji or icon name
  description TEXT,
  content TEXT,  -- Full markdown content
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_closing_topics_code ON closing_topics(code);
CREATE INDEX IF NOT EXISTS idx_closing_topics_category ON closing_topics(category);
CREATE INDEX IF NOT EXISTS idx_closing_topics_active ON closing_topics(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_closing_topics_order ON closing_topics(order_index);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_closing_topics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_closing_topics_timestamp
    BEFORE UPDATE ON closing_topics
    FOR EACH ROW
    EXECUTE FUNCTION update_closing_topics_updated_at();

-- 코멘트
COMMENT ON TABLE closing_topics IS '결산 주제 카드';
COMMENT ON COLUMN closing_topics.code IS '고유 코드 (revenue_cutoff, inventory_git 등)';
COMMENT ON COLUMN closing_topics.content IS 'Markdown 형식의 상세 내용';

-- ============================================
-- 2. closing_questions 테이블 (질의응답)
-- ============================================
CREATE TABLE IF NOT EXISTS closing_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES closing_topics(id) ON DELETE SET NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE CASCADE,
  
  -- Question
  question TEXT NOT NULL,
  asked_by TEXT NOT NULL,  -- User email
  asked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Answer
  answer TEXT,
  answered_by TEXT,  -- GBS team member email
  answered_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Metadata
  is_public BOOLEAN DEFAULT false,  -- Show to all subsidiaries?
  tags TEXT[],  -- For categorization
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_closing_questions_topic ON closing_questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_closing_questions_subsidiary ON closing_questions(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_closing_questions_status ON closing_questions(status);
CREATE INDEX IF NOT EXISTS idx_closing_questions_public ON closing_questions(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_closing_questions_asked_at ON closing_questions(asked_at DESC);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_closing_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_closing_questions_timestamp
    BEFORE UPDATE ON closing_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_closing_questions_updated_at();

-- 코멘트
COMMENT ON TABLE closing_questions IS '결산 관련 질의응답';
COMMENT ON COLUMN closing_questions.is_public IS '모든 법인에 공개할지 여부';

-- ============================================
-- 3. question_views 테이블 (조회 이력)
-- ============================================
CREATE TABLE IF NOT EXISTS question_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES closing_questions(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  viewed_by TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_question_views_question ON question_views(question_id);
CREATE INDEX IF NOT EXISTS idx_question_views_subsidiary ON question_views(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_question_views_viewed_at ON question_views(viewed_at DESC);

-- 코멘트
COMMENT ON TABLE question_views IS '질문 조회 이력';

-- ============================================
-- 4. 샘플 데이터 입력
-- ============================================

-- Revenue Cut-off
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('revenue_cutoff', 'Revenue Cut-off', 'revenue', '💵', 'Review December invoices and verify actual delivery', 
'# Revenue Cut-off

## 📌 Overview
Revenue cut-off ensures that revenue is recognized in the correct accounting period. Review all December invoices and verify that goods or services were actually delivered before year-end.

## 📋 When to Record
- Invoice issued in December but goods/services delivered in January
- Invoice issued in January but goods/services delivered in December
- Partial delivery scenarios

## ✅ Steps
1. Review all December invoices
2. Verify actual delivery dates
3. Identify cut-off issues
4. Record adjustments as needed

## 📝 Journal Entry
```
(Dr) Accounts Receivable XXX
(Cr) Revenue XXX
```

## ⚠️ Important
- Maintain supporting documentation
- Coordinate with sales team for delivery confirmations', 1)
ON CONFLICT (code) DO NOTHING;

-- Goods in Transit (GIT)
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('inventory_git', 'Goods in Transit (GIT)', 'inventory', '📦', 'Record purchases where invoice received but goods not arrived',
'# Goods in Transit (GIT)

## 📌 Overview
Goods in Transit (GIT) refers to purchases where the invoice has been received but the goods have not yet arrived. This is important for accurate inventory and accounts payable recording.

## 📋 When to Record
- Invoice received but goods not yet arrived
- Ownership transferred per Incoterms (FOB, CIF, etc.)
- Goods shipped but not received by year-end

## ✅ Steps
1. Identify purchases with invoice but no goods
2. Record as GIT per Incoterms (see reference table)
3. Maintain documentation (invoices, shipping docs)
4. Reverse entry on January 1st

## 📝 Journal Entry
```
(Dr) Goods in Transit XXX
(Cr) Accounts Payable (Trade) XXX
```

## ⚠️ Important
- Create manual JE and reverse on 1st Jan 2026
- Keep all supporting documents
- Verify Incoterms for ownership transfer timing', 2)
ON CONFLICT (code) DO NOTHING;

-- Physical Inventory Count
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('inventory_count', 'Physical Inventory Count', 'inventory', '📊', 'Conduct physical count and adjust variances',
'# Physical Inventory Count

## 📌 Overview
Physical inventory count is conducted to verify the accuracy of inventory records and identify any discrepancies.

## 📋 When to Record
- Year-end physical count
- Significant variances between book and physical
- Obsolete or damaged inventory

## ✅ Steps
1. Schedule physical count
2. Count all inventory items
3. Compare with book records
4. Investigate variances
5. Record adjustments

## 📝 Journal Entry
```
(Dr) Inventory Adjustment XXX
(Cr) Inventory XXX
```

## ⚠️ Important
- Complete count before year-end
- Document all variances
- Review for obsolescence', 3)
ON CONFLICT (code) DO NOTHING;

-- General Accruals
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('accrued_general', 'General Accruals', 'expenses', '💰', 'Accrue FY2025 expenses without invoices',
'# General Accruals

## 📌 Overview
Accrue expenses that have been incurred but not yet invoiced or paid by year-end.

## 📋 When to Record
- Services received but not invoiced
- Utilities used but not billed
- Professional fees incurred but not invoiced

## ✅ Steps
1. Identify expenses incurred but not recorded
2. Estimate amounts based on contracts or usage
3. Record accrual entries
4. Reverse in January when invoices received

## 📝 Journal Entry
```
(Dr) Expense Account XXX
(Cr) Accrued Expenses XXX
```

## ⚠️ Important
- Support with contracts or estimates
- Reverse when actual invoices received', 4)
ON CONFLICT (code) DO NOTHING;

-- Compensation Accruals
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('accrued_compensation', 'Compensation Accruals', 'expenses', '💼', 'Performance bonuses, unused leave, retirement pension',
'# Compensation Accruals

## 📌 Overview
Accrue compensation-related expenses including performance bonuses, unused leave, and retirement pension.

## 📋 When to Record
- Performance bonuses earned but not paid
- Unused annual leave
- Retirement pension obligations

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
- Review with HR department', 5)
ON CONFLICT (code) DO NOTHING;

-- Bad Debt Write-off
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('ar_bad_debt', 'Bad Debt Write-off', 'receivables', '💳', 'Write-off receivables outstanding > 12 months',
'# Bad Debt Write-off

## 📌 Overview
Write off receivables that are determined to be uncollectible, typically those outstanding for more than 12 months.

## 📋 When to Record
- Receivables outstanding > 12 months
- Customer declared bankruptcy
- Collection efforts exhausted

## ✅ Steps
1. Review aged receivables
2. Identify uncollectible amounts
3. Obtain management approval
4. Record write-off

## 📝 Journal Entry
```
(Dr) Bad Debt Expense XXX
(Cr) Accounts Receivable XXX
```

## ⚠️ Important
- Document collection efforts
- Obtain proper approvals
- Maintain for tax purposes', 6)
ON CONFLICT (code) DO NOTHING;

-- Allowance for Doubtful Accounts
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('ar_allowance', 'Allowance for Doubtful Accounts', 'receivables', '📉', 'Individual assessment for collection issues',
'# Allowance for Doubtful Accounts

## 📌 Overview
Establish or adjust allowance for doubtful accounts based on individual assessment of collection issues.

## 📋 When to Record
- Individual receivables with collection concerns
- Changes in customer creditworthiness
- Economic conditions affecting collectibility

## ✅ Steps
1. Review individual receivables
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
- Adjust based on actual collections', 7)
ON CONFLICT (code) DO NOTHING;

-- FX Revaluation
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('fx_revaluation', 'FX Revaluation', 'currency', '💱', 'Revalue FX-denominated assets & liabilities',
'# FX Revaluation

## 📌 Overview
Revalue foreign currency-denominated assets and liabilities to year-end exchange rates.

## 📋 When to Record
- Assets/liabilities denominated in foreign currency
- Year-end exchange rate differs from transaction rate
- Unrealized FX gains/losses

## ✅ Steps
1. Identify FX-denominated items
2. Obtain year-end exchange rates
3. Calculate revaluation amount
4. Record adjustment

## 📝 Journal Entry
```
(Dr) FX Loss / (Cr) FX Gain XXX
(Cr) Asset/Liability XXX
```

## ⚠️ Important
- Use official exchange rates
- Document rate sources
- Review for hedge accounting', 8)
ON CONFLICT (code) DO NOTHING;

-- Fixed Assets & Leases
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('fixed_assets', 'Fixed Assets & Leases', 'assets', '🏢', 'Fixed asset additions, disposals, and lease accounting',
'# Fixed Assets & Leases

## 📌 Overview
Review fixed asset additions, disposals, and lease accounting for the year.

## 📋 When to Record
- New asset acquisitions
- Asset disposals
- Lease agreements (IFRS 16)
- Depreciation adjustments

## ✅ Steps
1. Review asset additions
2. Review asset disposals
3. Review lease agreements
4. Calculate depreciation
5. Record adjustments

## 📝 Journal Entry
```
(Dr) Depreciation Expense XXX
(Cr) Accumulated Depreciation XXX
```

## ⚠️ Important
- Maintain asset register
- Review lease terms
- Follow accounting standards', 9)
ON CONFLICT (code) DO NOTHING;
