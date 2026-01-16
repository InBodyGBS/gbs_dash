'use client';

/**
 * 업로드된 업무기술서 목록 컴포넌트
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, Eye, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { getWorkManuals, deleteWorkManual } from '@/lib/services/workManualService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { WorkManual } from '@/lib/types/work-manual';

interface WorkManualListProps {
  onSelect: (manual: WorkManual) => void;
  selectedId?: string | null;
  refreshKey?: number;
}

export function WorkManualList({
  onSelect,
  selectedId,
  refreshKey = 0,
}: WorkManualListProps) {
  const [manuals, setManuals] = useState<WorkManual[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadManuals = async () => {
      try {
        setLoading(true);
        const data = await getWorkManuals();
        setManuals(data);
      } catch (error: any) {
        console.error('Failed to load work manuals:', error);
        toast.error('파일 목록 로드 실패', {
          description: error.message || '파일 목록을 불러오는 중 오류가 발생했습니다.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadManuals();
  }, [refreshKey]);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDelete = async (manual: WorkManual) => {
    try {
      await deleteWorkManual(manual.id, manual.file_path);
      toast.success('파일 삭제 완료', {
        description: `${manual.file_name}이(가) 삭제되었습니다.`,
      });
      // 목록 새로고침
      const data = await getWorkManuals();
      setManuals(data);
    } catch (error: any) {
      toast.error('삭제 실패', {
        description: error.message || '파일 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: '#971B2F' }}></div>
        <p className="text-gray-600 mt-4">로딩 중...</p>
      </div>
    );
  }

  if (manuals.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-gray-500">업로드된 파일이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div 
        className="flex items-center justify-between cursor-pointer mb-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold text-gray-900">
          업로드된 파일 목록 ({manuals.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      {isExpanded && (
        <div className="space-y-2">
          {manuals.map((manual) => (
          <div
            key={manual.id}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border transition-colors',
              selectedId === manual.id
                ? 'border-gray-300'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
            style={selectedId === manual.id ? { backgroundColor: 'rgba(151, 27, 47, 0.1)', borderColor: '#971B2F' } : undefined}
          >
            <div className="flex items-center gap-3 flex-1">
              <FileText className="h-5 w-5 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {manual.file_name}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>
                    {format(new Date(manual.uploaded_at), 'yyyy-MM-dd')}
                  </span>
                  <span>|</span>
                  <span>{formatFileSize(manual.file_size)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelect(manual)}
                className="flex items-center gap-1"
              >
                <Eye className="h-4 w-4" />
                보기
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
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
                      {manual.file_name} 파일을 삭제하시겠습니까?
                      <br />
                      이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(manual)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
