/**
 * Reference Page Types
 * Types for closing topics and Q&A system
 */

export interface ClosingTopic {
  id: string;
  code: string; // 'revenue_cutoff', 'inventory_git', etc.
  title: string;
  category: string; // 'revenue', 'inventory', 'expenses', etc.
  icon: string; // emoji or icon name
  description: string;
  content: string; // Full markdown content
  order_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClosingQuestion {
  id: string;
  topic_id: string | null;
  subsidiary_id: string | null;
  
  // Question
  question: string;
  asked_by: string; // User email
  asked_at: string;
  
  // Answer
  answer: string | null;
  answered_by: string | null; // GBS team member email
  answered_at: string | null;
  
  // Status
  status: 'pending' | 'answered' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Metadata
  is_public: boolean; // Show to all subsidiaries?
  tags: string[]; // For categorization
  
  created_at: string;
  updated_at: string;
}

export interface QuestionView {
  id: string;
  question_id: string;
  subsidiary_id: string;
  viewed_by: string;
  viewed_at: string;
}
