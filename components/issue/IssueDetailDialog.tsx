'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Pencil, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { updateIssue, deleteIssue } from '@/lib/services/issueService';
import type { Issue, IssueCategory, IssueStatus } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';
import { CATEGORY_COLORS, ISSUE_CATEGORIES, ISSUE_STATUS_LIST } from '@/lib/constants/issue-categories';

interface IssueDetailDialogProps {
  issue: Issue;
  subsidiary?: Subsidiary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  onDelete: () => void;
}

export function IssueDetailDialog({
  issue,
  subsidiary,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: IssueDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: issue.title,
    category: issue.category,
    description: issue.description,
    response: issue.response || '',
    status: issue.status,
    period: issue.period || '',
    inquired_by: issue.inquired_by || '',
    type: issue.type || undefined,
  });

  // issue prop이 변경될 때 formData 업데이트
  useEffect(() => {
    setFormData({
      title: issue.title,
      category: issue.category,
      description: issue.description,
      response: issue.response || '',
      status: issue.status,
      period: issue.period || '',
      inquired_by: issue.inquired_by || '',
      type: issue.type || undefined,
    });
    // 수정 모드가 열려있으면 닫기
    setIsEditing(false);
  }, [issue]);

  const handleUpdate = async () => {
    try {
      setLoading(true);
      await updateIssue(issue.id, formData);
      toast.success('이슈가 수정되었습니다');
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to update issue:', error);
      toast.error('이슈 수정 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말로 이 이슈를 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      await deleteIssue(issue.id);
      toast.success('이슈가 삭제되었습니다');
      onOpenChange(false);
      onDelete();
    } catch (error) {
      console.error('Failed to delete issue:', error);
      toast.error('이슈 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsCompleted = async () => {
    try {
      setLoading(true);
      await updateIssue(issue.id, { status: '완료' });
      toast.success('이슈가 완료 처리되었습니다');
      onUpdate();
      onOpenChange(false); // 팝업 닫기
    } catch (error) {
      console.error('Failed to mark as completed:', error);
      toast.error('완료 처리 실패');
    } finally {
      setLoading(false);
    }
  };

  const categoryColor = CATEGORY_COLORS[issue.category];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Issue Detail</DialogTitle>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    삭제
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {isEditing ? (
          // 수정 모드
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">제목</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-category">카테고리</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as IssueCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status">상태</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as IssueStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISSUE_STATUS_LIST.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-period">기간 (선택)</Label>
                <Input
                  id="edit-period"
                  placeholder="예: 20254Q"
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  maxLength={10}
                />
              </div>
            </div>

            {/* 문의자 & Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-inquired_by">문의자</Label>
                <Input
                  id="edit-inquired_by"
                  placeholder="문의자 이름을 입력하세요"
                  value={formData.inquired_by}
                  onChange={(e) => setFormData({ ...formData, inquired_by: e.target.value })}
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as 'Daily' | 'Q Closing' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Daily">Daily</SelectItem>
                    <SelectItem value="Q Closing">Q Closing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">설명</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
              />
            </div>

            <div>
              <Label htmlFor="edit-response">대응 내용</Label>
              <Textarea
                id="edit-response"
                value={formData.response}
                onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                rows={6}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                취소
              </Button>
              <Button onClick={handleUpdate} disabled={loading}>
                {loading ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // 읽기 모드
          <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">#{issue.id.slice(0, 8)}</span>
                  <Badge style={{ backgroundColor: categoryColor, color: 'white' }}>
                    {issue.category}
                  </Badge>
                  <Badge variant={issue.status === '완료' ? 'default' : 'secondary'}>
                    {issue.status === '완료' ? '✅ 완료' : '⏳ 확인 중'}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{issue.title}</h2>
              </div>
            </div>

            {/* 메타데이터 */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">📍 Entity:</span>
                <span className="text-gray-900">
                  {subsidiary?.name || subsidiary?.code || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">👤 작성자:</span>
                <span className="text-gray-900">{issue.created_by}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">📅 생성일:</span>
                <span className="text-gray-900">
                  {format(new Date(issue.created_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">🔄 수정일:</span>
                <span className="text-gray-900">
                  {format(new Date(issue.updated_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                </span>
              </div>
              {issue.completed_at && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">✅ 완료일:</span>
                  <span className="text-gray-900">
                    {format(new Date(issue.completed_at), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                  </span>
                </div>
              )}
              {issue.period && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">📆 기간:</span>
                  <span className="text-gray-900">{issue.period}</span>
                </div>
              )}
              {issue.inquired_by && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">📞 문의자:</span>
                  <span className="text-gray-900">{issue.inquired_by}</span>
                </div>
              )}
              {issue.type && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-700">🏷️ Type:</span>
                  <span className="text-gray-900">{issue.type}</span>
                </div>
              )}
            </div>

            {/* 설명 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📝 설명</h3>
              <div className="bg-white border rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.description}</p>
              </div>
            </div>

            {/* 대응 내용 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">💬 대응 내용</h3>
              <div className="bg-white border rounded-lg p-4">
                {issue.response ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.response}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">대응 내용이 없습니다</p>
                )}
              </div>
            </div>

            {/* 액션 버튼 */}
            {issue.status !== '완료' && (
              <div className="flex justify-end">
                <Button onClick={handleMarkAsCompleted} disabled={loading}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  완료 처리
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

