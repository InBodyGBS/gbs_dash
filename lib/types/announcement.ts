export type AnnouncementVisibility = 'confidential' | 'all';

export interface AnnouncementRow {
  id: string;
  type: string;
  title: string;
  author: string;
  content: string | null;
  visibility: AnnouncementVisibility;
  view_count: number;
  created_at: string;
  updated_at?: string | null;
}
