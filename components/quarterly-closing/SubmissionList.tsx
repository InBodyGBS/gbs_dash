'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileSpreadsheet, Download, Trash2, MessageSquare, Copy, ExternalLink, Check } from 'lucide-react';
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
import { getSubmissions, deleteSubmission, getSubmissionUrl } from '@/lib/services/submissionService';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Submission } from '@/lib/types/submission';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';

interface SubmissionListProps {
  selectedCategory?: ClosingCategoryId;
  quarterId?: string | null;
  subsidiaryId?: string | null;
  onSubmissionClick?: (submission: Submission) => void;
  refreshKey?: number;
  onDeleteSuccess?: () => void;
}

export function SubmissionList({
  selectedCategory,
  quarterId,
  subsidiaryId,
  onSubmissionClick,
  refreshKey = 0,
  onDeleteSuccess,
}: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedCategory) {
      loadSubmissions();
    } else {
      setSubmissions([]);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, selectedCategory, quarterId, subsidiaryId]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const data = await getSubmissions(selectedCategory, quarterId, subsidiaryId);
      setSubmissions(data);
    } catch (error: any) {
      console.error('Failed to load submissions:', error);
      toast.error('제출 목록 로드 실패', {
        description: error.message || '제출 목록을 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (submission: Submission) => {
    try {
      await deleteSubmission(submission.id, submission.file_path);
      toast.success('파일 삭제 완료', {
        description: `${submission.file_name}이(가) 삭제되었습니다.`,
      });
      // 로컬 상태에서 즉시 제거
      setSubmissions((prev) => prev.filter((s) => s.id !== submission.id));
      // 부모 컴포넌트에 삭제 성공 알림
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      // 서버에서 다시 로드하여 동기화
      await loadSubmissions();
    } catch (error: any) {
      toast.error('삭제 실패', {
        description: error.message || '파일 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const handleDownload = async (submission: Submission) => {
    try {
      const url = await getSubmissionUrl(submission.file_path);
      const link = document.createElement('a');
      link.href = url;
      link.download = submission.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('다운로드 시작', {
        description: `${submission.file_name} 다운로드가 시작되었습니다.`,
      });
    } catch (error: any) {
      toast.error('다운로드 실패', {
        description: error.message || '파일 다운로드 중 오류가 발생했습니다.',
      });
    }
  };

  const handleCopyLink = async (submission: Submission) => {
    try {
      const url = await getSubmissionUrl(submission.file_path);
      await navigator.clipboard.writeText(url);
      toast.success('링크 복사 완료', {
        description: '다운로드 링크가 클립보드에 복사되었습니다.',
      });
    } catch (error: any) {
      toast.error('링크 복사 실패', {
        description: error.message || '링크 복사 중 오류가 발생했습니다.',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryLabel = (categoryId: ClosingCategoryId): string => {
    return CLOSING_CATEGORIES.find((cat) => cat.id === categoryId)?.label || categoryId;
  };

  const getCategoryColor = (categoryId: ClosingCategoryId): string => {
    return CLOSING_CATEGORIES.find((cat) => cat.id === categoryId)?.color || '#6B7280';
  };

  if (!selectedCategory) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">좌측에서 카테고리를 선택하세요.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
          style={{ borderColor: '#971B2F' }}
        ></div>
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
            onDownload={handleDownload}
            onDelete={handleDelete}
            onClick={onSubmissionClick}
            getCategoryLabel={getCategoryLabel}
            getCategoryColor={getCategoryColor}
            formatFileSize={formatFileSize}
          />
        ))}
      </div>
    </div>
  );
}

interface SubmissionItemProps {
  submission: Submission;
  onDownload: (submission: Submission) => void;
  onDelete: (submission: Submission) => void;
  onClick?: (submission: Submission) => void;
  getCategoryLabel: (categoryId: ClosingCategoryId) => string;
  getCategoryColor: (categoryId: ClosingCategoryId) => string;
  formatFileSize: (bytes: number) => string;
}

function SubmissionItem({
  submission,
  onDownload,
  onDelete,
  onClick,
  getCategoryLabel,
  getCategoryColor,
  formatFileSize,
}: SubmissionItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border transition-colors',
        onClick && 'cursor-pointer hover:bg-gray-50'
      )}
      onClick={() => onClick?.(submission)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <FileSpreadsheet className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {submission.file_name}
            </p>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: `${getCategoryColor(submission.category)}1A`,
                color: getCategoryColor(submission.category),
                border: `1px solid ${getCategoryColor(submission.category)}33`,
              }}
            >
              {getCategoryLabel(submission.category)}
            </Badge>
            {submission.version > 1 && (
              <Badge variant="outline" className="text-xs">
                v{submission.version}
              </Badge>
            )}
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
          onClick={(e) => {
            e.stopPropagation();
            onDownload(submission);
          }}
          className="flex items-center gap-1"
          title="파일 다운로드"
        >
          <Download className="h-4 w-4" />
          다운로드
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              const url = await getSubmissionUrl(submission.file_path);
              await navigator.clipboard.writeText(url);
              toast.success('링크 복사 완료', {
                description: '다운로드 링크가 클립보드에 복사되었습니다.',
              });
            } catch (error: any) {
              toast.error('링크 복사 실패', {
                description: error.message || '링크 복사 중 오류가 발생했습니다.',
              });
            }
          }}
          className="flex items-center gap-1"
          title="다운로드 링크 복사"
        >
          <Copy className="h-4 w-4" />
          링크
        </Button>
        {onClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClick(submission);
            }}
            className="flex items-center gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            댓글
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                <br />
                이 작업은 되돌릴 수 없습니다.
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
