# Reference Page - PRD (Product Requirements Document)

## 📋 Overview

**페이지명:** Reference (결산 가이드 참고자료)  
**목적:** 해외 법인 담당자들이 결산 시 필요한 조정 항목을 쉽게 찾고, 질의응답을 통해 본사 담당자에게 도움을 받을 수 있는 페이지  
**대상 사용자:**
- Primary: 해외 법인 회계 담당자
- Secondary: 본사 GBS 팀 담당자 (질의 답변)

**참고 문서:** `_InBody__FY25_Closing.docx`

---

## 🎯 Core Features

### 1. 결산 주제 카드 그리드
해외 법인이 결산 시 필요한 주요 조정 항목을 카드 형태로 표시

### 2. 주제별 상세 설명
카드 선택 시 해당 주제의 결산 조정 방법에 대한 간단한 가이드 표시

### 3. 질의응답 Chat 시스템
사용자가 질문을 남기면 본사 담당자가 답변하는 챗봇 형태의 Q&A

### 4. 질의응답 이력 관리
모든 질의응답을 Supabase DB에 저장하여 향후 참고 가능

---

## 🎨 UI/UX Design

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Reference - Year-End Closing Guide                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Search Bar: "Search closing topics..."]                │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Revenue  │ │Inventory │ │ Accrued  │ │   A/R    │   │
│  │ Cut-off  │ │          │ │ Expenses │ │          │   │
│  │          │ │ 📦       │ │ 💰       │ │ 💳       │   │
│  │ 💵       │ │          │ │          │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Foreign  │ │  Fixed   │ │  Other   │                │
│  │ Currency │ │  Assets  │ │  Topics  │                │
│  │ 💱       │ │ 🏢       │ │ 📋       │                │
│  └──────────┘ └──────────┘ └──────────┘                │
│                                                           │
│  Contact: Rosa (seung-hyun.cho@inbody.com)              │
│           Grace (eunbik0730@inbody.com)                 │
└─────────────────────────────────────────────────────────┘
```

### Card Click → Detail View

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Topics                    [Chat 💬]           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📦 Inventory - Goods in Transit (GIT)                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                           │
│  📌 Overview                                             │
│  미착품(GIT)은 송장은 받았지만 물건이 아직 도착하지      │
│  않은 구매 건을 의미합니다.                               │
│                                                           │
│  📋 When to Record                                       │
│  • Invoice received but goods not yet arrived            │
│  • Incoterms에 따라 소유권이 이전된 경우                  │
│                                                           │
│  ✅ Steps                                                │
│  1. Identify purchases with invoice but no goods         │
│  2. Record as GIT per Incoterms (see reference table)   │
│  3. Maintain documentation (invoices, shipping docs)     │
│                                                           │
│  📝 Journal Entry                                        │
│  (Debit) GIT XXX / (Credit) AP (Trade) XXX              │
│                                                           │
│  ⚠️ Important                                            │
│  • Create manual JE and reverse on 1st Jan 2026         │
│  • Keep all supporting documents                         │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                           │
│  📚 Related Topics                                       │
│  • Physical Inventory Count                             │
│  • Accounts Payable                                      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Chat Dialog

```
┌─────────────────────────────────────────────────────────┐
│  💬 Closing Questions - Inventory (GIT)      [×]         │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📌 Past Q&A (3)                                  │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ Q: FOB 조건인 경우 어느 시점에 GIT 인식하나요?    │   │
│  │ A: FOB는 선적 시점에 소유권이 이전되므로...       │   │
│  │    [Grace, 2025-01-10]                           │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ Q: 역분개는 반드시 해야 하나요?                   │   │
│  │ A: 네, 임시 분개이므로 1월 1일에 역분개...        │   │
│  │    [Rosa, 2025-01-08]                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ New Question:                                     │   │
│  │                                                   │   │
│  │ ┌───────────────────────────────────────────┐   │   │
│  │ │ Type your question here...                 │   │   │
│  │ │                                             │   │   │
│  │ │                                             │   │   │
│  │ └───────────────────────────────────────────┘   │   │
│  │                                                   │   │
│  │           [Cancel]  [Submit Question →]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Data Structure

### Supabase Tables

#### 1. `closing_topics` (결산 주제)

```sql
CREATE TABLE closing_topics (
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
```

**Sample Data:**
```sql
INSERT INTO closing_topics (code, title, category, icon, description, content, order_index) VALUES
('revenue_cutoff', 'Revenue Cut-off', 'revenue', '💵', 'Review December invoices and verify actual delivery', 
'# Revenue Cut-off\n\n## Overview\n...', 1),

('inventory_git', 'Goods in Transit (GIT)', 'inventory', '📦', 'Record purchases where invoice received but goods not arrived',
'# Goods in Transit\n\n## When to Record\n...', 2),

('inventory_count', 'Physical Inventory Count', 'inventory', '📊', 'Conduct physical count and adjust variances',
'# Physical Inventory Count\n\n## Steps\n...', 3),

('accrued_general', 'General Accruals', 'expenses', '💰', 'Accrue FY2025 expenses without invoices',
'# General Accruals\n\n## Common Items\n...', 4),

('accrued_compensation', 'Compensation Accruals', 'expenses', '💼', 'Performance bonuses, unused leave, retirement pension',
'# Compensation Accruals\n\n## Components\n...', 5),

('ar_bad_debt', 'Bad Debt Write-off', 'receivables', '💳', 'Write-off receivables outstanding > 12 months',
'# Bad Debt\n\n## Criteria\n...', 6),

('ar_allowance', 'Allowance for Doubtful Accounts', 'receivables', '📉', 'Individual assessment for collection issues',
'# Allowance for Doubtful Accounts\n\n## Assessment\n...', 7),

('fx_revaluation', 'FX Revaluation', 'currency', '💱', 'Revalue FX-denominated assets & liabilities',
'# FX Revaluation\n\n## Process\n...', 8),

('fixed_assets', 'Fixed Assets & Leases', 'assets', '🏢', 'Fixed asset additions, disposals, and lease accounting',
'# Fixed Assets\n\n## Year-end Procedures\n...', 9);
```

---

#### 2. `closing_questions` (질의응답)

```sql
CREATE TABLE closing_questions (
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

-- Indexes
CREATE INDEX idx_closing_questions_topic ON closing_questions(topic_id);
CREATE INDEX idx_closing_questions_subsidiary ON closing_questions(subsidiary_id);
CREATE INDEX idx_closing_questions_status ON closing_questions(status);
CREATE INDEX idx_closing_questions_public ON closing_questions(is_public) WHERE is_public = true;
```

---

#### 3. `question_views` (조회 이력)

```sql
CREATE TABLE question_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES closing_questions(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  viewed_by TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_question_views_question ON question_views(question_id);
```

---

## 🔧 Technical Implementation

### Page Structure

```
app/(dashboard)/reference/
├── page.tsx                 # Main reference page
├── components/
│   ├── TopicCard.tsx       # Individual topic card
│   ├── TopicGrid.tsx       # Grid of topic cards
│   ├── TopicDetail.tsx     # Topic detail view
│   ├── ChatDialog.tsx      # Q&A chat dialog
│   └── QuestionList.tsx    # List of past Q&A
└── lib/
    ├── services/
    │   ├── topicService.ts         # CRUD for topics
    │   └── questionService.ts      # CRUD for questions
    └── types/
        └── reference.ts            # TypeScript types
```

---

### Key Components

#### 1. TopicCard Component

```typescript
interface TopicCardProps {
  topic: ClosingTopic;
  onClick: (topicId: string) => void;
}

export function TopicCard({ topic, onClick }: TopicCardProps) {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => onClick(topic.id)}
    >
      <CardContent className="p-6 text-center">
        <div className="text-4xl mb-3">{topic.icon}</div>
        <h3 className="font-semibold text-lg mb-2">{topic.title}</h3>
        <p className="text-sm text-gray-600">{topic.description}</p>
      </CardContent>
    </Card>
  );
}
```

---

#### 2. TopicDetail Component

```typescript
interface TopicDetailProps {
  topic: ClosingTopic;
  onBack: () => void;
  onOpenChat: () => void;
}

export function TopicDetail({ topic, onBack, onOpenChat }: TopicDetailProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack}>
          ← Back to Topics
        </Button>
        <Button onClick={onOpenChat}>
          💬 Chat
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-5xl">{topic.icon}</span>
          <h1 className="text-3xl font-bold">{topic.title}</h1>
        </div>

        {/* Markdown content */}
        <div className="prose max-w-none">
          <ReactMarkdown>{topic.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
```

---

#### 3. ChatDialog Component

```typescript
interface ChatDialogProps {
  topicId: string;
  topicTitle: string;
  open: boolean;
  onClose: () => void;
}

export function ChatDialog({ topicId, topicTitle, open, onClose }: ChatDialogProps) {
  const [questions, setQuestions] = useState<ClosingQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadQuestions();
    }
  }, [open, topicId]);

  const loadQuestions = async () => {
    const data = await getQuestionsByTopic(topicId);
    setQuestions(data);
  };

  const handleSubmit = async () => {
    if (!newQuestion.trim()) return;
    
    setLoading(true);
    try {
      await createQuestion({
        topic_id: topicId,
        question: newQuestion,
        asked_by: currentUser.email,
      });
      
      toast.success('질문이 제출되었습니다.');
      setNewQuestion('');
      loadQuestions();
    } catch (error) {
      toast.error('질문 제출 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogTitle>
          💬 Closing Questions - {topicTitle}
        </DialogTitle>
        
        {/* Past Q&A */}
        <div className="flex-1 overflow-auto">
          <h3 className="font-semibold mb-3">📌 Past Q&A ({questions.length})</h3>
          
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="border-b pb-4">
                <div className="mb-2">
                  <span className="font-medium">Q:</span> {q.question}
                </div>
                {q.answer && (
                  <div className="ml-4 text-gray-700">
                    <span className="font-medium text-blue-600">A:</span> {q.answer}
                    <div className="text-xs text-gray-500 mt-1">
                      [{q.answered_by}, {formatDate(q.answered_at)}]
                    </div>
                  </div>
                )}
                {!q.answer && (
                  <div className="ml-4 text-gray-400 text-sm">
                    Waiting for answer...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* New Question Form */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">New Question:</h4>
          <Textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Type your question here..."
            rows={4}
          />
          
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              Submit Question →
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🔄 User Flows

### Flow 1: Topic 탐색 및 가이드 확인

```
1. User lands on Reference page
2. Sees grid of closing topic cards
3. Clicks on "Inventory - GIT" card
4. Views detailed explanation with:
   - Overview
   - When to record
   - Steps
   - Journal entry
   - Important notes
5. Can navigate back or open chat
```

---

### Flow 2: 질문하기 (해외 법인)

```
1. User viewing topic detail
2. Clicks "Chat 💬" button
3. Dialog opens showing:
   - Past Q&A for this topic
   - New question form
4. Types question: "FOB 조건인 경우 언제 GIT 인식하나요?"
5. Clicks "Submit Question"
6. Question saved with status='pending'
7. Toast: "질문이 제출되었습니다"
8. Email notification sent to GBS team
```

---

### Flow 3: 답변하기 (본사 GBS 팀)

```
1. GBS team member receives email notification
2. Navigates to Reference page or dedicated Q&A management page
3. Sees list of pending questions
4. Clicks on question to expand
5. Types answer in text field
6. Clicks "Submit Answer"
7. Answer saved with:
   - answer text
   - answered_by email
   - answered_at timestamp
   - status='answered'
8. Email notification sent to original asker
9. Answer visible to all users viewing this topic
```

---

### Flow 4: Public Q&A 공유

```
1. GBS team marks answer as "public"
2. Question/Answer becomes visible to all subsidiaries
3. Other subsidiaries can see common questions in their chat dialog
4. Reduces duplicate questions
5. Builds knowledge base over time
```

---

## 🎯 Success Metrics

### Quantitative Metrics

1. **Topic Engagement**
   - Card click rate by topic
   - Average time spent on topic detail
   - Most viewed topics

2. **Question Volume**
   - Number of questions per topic
   - Number of questions per subsidiary
   - Average response time (pending → answered)

3. **User Satisfaction**
   - Question resolution rate
   - Return rate to same topic
   - Search usage vs. browse

### Qualitative Metrics

1. **Quality of Questions**
   - Clarity and specificity
   - Relevance to topic

2. **Quality of Answers**
   - Completeness
   - Helpful examples
   - Additional resource links

---

## 🚀 Implementation Phases

### Phase 1: Core Features (Week 1)
- ✅ Topic card grid layout
- ✅ Topic detail view with markdown rendering
- ✅ Basic chat dialog
- ✅ Question submission
- ✅ Database tables creation

### Phase 2: Q&A Management (Week 2)
- ✅ Answer submission (GBS team)
- ✅ Question status management
- ✅ Email notifications
- ✅ Question/Answer listing

### Phase 3: Enhanced Features (Week 3)
- ✅ Search functionality
- ✅ Public Q&A sharing
- ✅ Related topics linking
- ✅ View tracking

### Phase 4: Admin Features (Week 4)
- ✅ Topic content management
- ✅ Question analytics dashboard
- ✅ Bulk answer operations
- ✅ Export Q&A to PDF

---

## 🔐 Security & Permissions

### Access Control

**Public Access (All Users):**
- View all active topics
- View topic details
- Submit questions
- View answers to their own questions
- View public Q&A

**GBS Team Access:**
- All public access +
- Answer pending questions
- Mark answers as public
- Edit topic content
- View all questions from all subsidiaries
- Analytics dashboard

**Admin Access:**
- All GBS access +
- Create/edit/delete topics
- Manage user permissions
- System configuration

---

## 📱 Responsive Design

### Desktop (≥1024px)
- 4 cards per row
- Full width topic detail
- Side-by-side chat layout

### Tablet (768-1023px)
- 3 cards per row
- Full width topic detail
- Stacked chat layout

### Mobile (<768px)
- 1-2 cards per row
- Simplified topic detail
- Full-screen chat dialog

---

## 🔔 Notifications

### Email Notifications

**To Subsidiaries:**
- Question submitted (confirmation)
- Answer received
- Related questions published

**To GBS Team:**
- New question submitted
- High priority question flagged
- Daily digest of pending questions

### In-App Notifications

- Badge count on "Reference" nav item
- Toast messages for actions
- Real-time updates when answer posted

---

## 🧪 Testing Checklist

### Functional Testing
- [ ] Topic cards display correctly
- [ ] Topic detail shows markdown content
- [ ] Chat dialog opens/closes
- [ ] Question submission works
- [ ] Answer submission works
- [ ] Search returns relevant results
- [ ] Email notifications sent
- [ ] Public Q&A visible to all

### Edge Cases
- [ ] Empty state (no topics)
- [ ] Empty state (no questions)
- [ ] Long question text
- [ ] Long answer text
- [ ] Network failure during submission
- [ ] Concurrent answer submissions

### Performance
- [ ] Page loads in <2 seconds
- [ ] Chat dialog opens instantly
- [ ] Search results in <500ms
- [ ] Markdown rendering is fast

---

## 📚 Future Enhancements

### Version 2.0
- AI-powered answer suggestions
- Question similarity detection
- Multilingual support (Korean, English)
- Video tutorial integration
- PDF attachment support
- Upvote/downvote for helpful answers

### Version 3.0
- AI chatbot for instant answers
- Integration with external knowledge bases
- Advanced analytics with ML insights
- Mobile app (React Native)

---

## 📞 Contacts

**Product Owner:** GBS Team  
**Tech Lead:** Development Team  
**Stakeholders:**
- Rosa (seung-hyun.cho@inbody.com)
- Grace (eunbik0730@inbody.com)

---

## 📝 Appendix

### Sample Topic Content Structure

```markdown
# [Topic Title]

## 📌 Overview
Brief description of what this closing item is

## 📋 When to Record
Specific scenarios when this adjustment is needed

## ✅ Steps
1. Step 1
2. Step 2
3. Step 3

## 📝 Journal Entry
```
(Debit) Account XXX / (Credit) Account XXX
```

## ⚠️ Important Notes
- Key point 1
- Key point 2

## 📚 Related Topics
- [Link to related topic 1]
- [Link to related topic 2]

## 📎 References
- Supporting documents
- External links
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-17  
**Status:** Draft → Review → Approved