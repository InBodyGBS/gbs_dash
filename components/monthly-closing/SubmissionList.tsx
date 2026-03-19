'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, Download, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { MonthlySubmission } from '@/lib/types/monthly-closing-submissions';
import type { MonthlyClosingCategoryId } from '@/lib/constants/monthly-closing-categories';
import { MONTHLY_CLOSING_CATEGORIES } from '@/lib/constants/monthly-closing-categories';
import {
  deleteMonthlySubmission,
  getMonthlySubmissionUrl,
  getMonthlySubmissions,
} from '@/lib/services/monthlySubmissionService';

interface SubmissionListProps {
  periodYear: number;
  periodMonth: number;
  selectedCategory: MonthlyClosingCategoryId;
  selectedSubsidiaryId: string | null;
  refreshKey?: number;
}

export function SubmissionList({
  periodYear,
  periodMonth,
  selectedCategory,
  selectedSubsidiaryId,
  refreshKey = 0,
}: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<MonthlySubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getMonthlySubmissions(
          periodYear,
          periodMonth,
          selectedCategory,
          selectedSubsidiaryId
        );
        setSubmissions(data);
      } catch (error: any) {
        console.error('Failed to load monthly submissions:', error);
        toast.error('제출 목록 로드 실패', {
          description: error.message || '제출 목록을 불러오는 중 오류가 발생했습니다.',
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [periodYear, periodMonth, selectedCategory, selectedSubsidiaryId, refreshKey]);

  const getCategoryLabel = (categoryId: MonthlyClosingCategoryId) =>
    MONTHLY_CLOSING_CATEGORIES.find((cat) => cat.id === categoryId)?.label || categoryId;

  const getCategoryColor = (categoryId: MonthlyClosingCategoryId) =>
    MONTHLY_CLOSING_CATEGORIES.find((cat) => cat.id === categoryId)?.color || '#6B7280';

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#971B2F' }} />
        <p className="text-gray-600 mt-4">로딩 중...</p>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">제출된 파일이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          제출 목록 ({submissions.length})
        </h3>
      </div>

      <div className="p-4 space-y-3">
        {submissions.map((submission) => (
          <SubmissionItem
            key={submission.id}
            submission={submission}
            onDownload={async (s) => {
              try {
                const url = await getMonthlySubmissionUrl(s.file_path);
                const link = document.createElement('a');
                link.href = url;
                link.download = s.file_name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success('다운로드 시작', { description: `${s.file_name} 다운로드가 시작되었습니다.` });
              } catch (error: any) {
                toast.error('다운로드 실패', { description: error.message || '파일 다운로드 중 오류가 발생했습니다.' });
              }
            }}
            onDelete={async (s) => {
              try {
                await deleteMonthlySubmission(s.id, s.file_path);
                toast.success('파일 삭제 완료', { description: `${s.file_name}이(가) 삭제되었습니다.` });
                setSubmissions((prev) => prev.filter((x) => x.id !== s.id));
              } catch (error: any) {
                toast.error('삭제 실패', { description: error.message || '파일 삭제 중 오류가 발생했습니다.' });
              }
            }}
            getCategoryLabel={getCategoryLabel}
            getCategoryColor={getCategoryColor}
            formatFileSize={formatFileSize}
          />
        ))}
      </div>
    </div>
  );
}

function SubmissionItem({
  submission,
  onDownload,
  onDelete,
  getCategoryLabel,
  getCategoryColor,
  formatFileSize,
}: {
  submission: MonthlySubmission;
  onDownload: (s: MonthlySubmission) => void | Promise<void>;
  onDelete: (s: MonthlySubmission) => void | Promise<void>;
  getCategoryLabel: (categoryId: MonthlyClosingCategoryId) => string;
  getCategoryColor: (categoryId: MonthlyClosingCategoryId) => string;
  formatFileSize: (bytes: number) => string;
}) {
  const categoryId = submission.category as MonthlyClosingCategoryId;

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border transition-colors',
        'hover:bg-gray-50'
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileSpreadsheet className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{submission.file_name}</p>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: `${getCategoryColor(categoryId)}1A`,
                color: getCategoryColor(categoryId),
                border: `1px solid ${getCategoryColor(categoryId)}33`,
              }}
            >
              {getCategoryLabel(categoryId)}
            </Badge>
            {submission.version > 1 && <Badge variant="outline" className="text-xs">v{submission.version}</Badge>}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{format(new Date(submission.submitted_at), 'yyyy-MM-dd HH:mm')}</span>
            <span>|</span>
            <span>{formatFileSize(submission.file_size)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownload(submission)}
          className="flex items-center gap-1"
          title="파일 다운로드"
        >
          <Download className="h-4 w-4" />
          다운로드
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const url = await getMonthlySubmissionUrl(submission.file_path);
              await navigator.clipboard.writeText(url);
              toast.success('링크 복사 완료', { description: '다운로드 링크가 클립보드에 복사되었습니다.' });
            } catch (error: any) {
              toast.error('링크 복사 실패', { description: error.message || '링크 복사 중 오류가 발생했습니다.' });
            }
          }}
          className="flex items-center gap-1"
          title="다운로드 링크 복사"
        >
          <Copy className="h-4 w-4" />
          링크
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              title="파일 삭제"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>파일 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                {submission.file_name} 파일을 삭제하시겠습니까?
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(submission)}
                className="bg-red-600 hover:bg-red-700"
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

