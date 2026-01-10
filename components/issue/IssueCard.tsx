import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Issue } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/constants/issue-categories';

interface IssueCardProps {
  issue: Issue;
  subsidiary?: Subsidiary;
  onClick: () => void;
}

export function IssueCard({ issue, subsidiary, onClick }: IssueCardProps) {
  const categoryColor = CATEGORY_COLORS[issue.category];
  const categoryLabel = CATEGORY_LABELS[issue.category];

  return (
    <div
      className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge style={{ backgroundColor: categoryColor, color: 'white' }}>
            {issue.category}
          </Badge>
          <Badge variant={issue.status === '완료' ? 'default' : 'secondary'}>
            {issue.status === '완료' ? '✅ 완료' : '⏳ 확인 중'}
          </Badge>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">{issue.title}</h3>

      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
        <span>{subsidiary?.name || subsidiary?.code || 'Unknown'}</span>
        <span>·</span>
        <span>{format(new Date(issue.created_at), 'yyyy-MM-dd', { locale: ko })}</span>
      </div>

      <p className="text-sm text-gray-700 line-clamp-2 mb-3">{issue.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">작성자: {issue.created_by}</span>
        <Button variant="ghost" size="sm" onClick={onClick}>
          상세 보기 →
        </Button>
      </div>
    </div>
  );
}

