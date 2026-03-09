'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { createIssue } from '@/lib/services/issueService';
import type { Subsidiary } from '@/lib/supabase/types';
import type { IssueCategory, IssueFormData } from '@/lib/types/issue';
import { ISSUE_CATEGORIES } from '@/lib/constants/issue-categories';

interface IssueCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subsidiaries: Subsidiary[];
  onSuccess: () => void;
}

export function IssueCreateDialog({
  open,
  onOpenChange,
  subsidiaries,
  onSuccess,
}: IssueCreateDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<IssueFormData>>({
    title: '',
    category: undefined,
    entity_id: '',
    description: '',
    response: '',
    period: '',
    created_by: '',
    inquired_by: '',
    type: undefined,
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    if (!formData.title || !formData.category || !formData.entity_id || !formData.description) {
      toast.error('필수 항목을 모두 입력해주세요');
      return;
    }

    const issueData: any = {
      title: formData.title!,
      category: formData.category!,
      entity_id: formData.entity_id!,
      description: formData.description!,
      created_by: formData.created_by?.trim() || '시스템', // 빈 값이면 기본값 사용
    };

    // 선택적 필드: 값이 있을 때만 추가
    if (formData.response && formData.response.trim()) {
      issueData.response = formData.response.trim();
    }
    if (formData.period && formData.period.trim()) {
      issueData.period = formData.period.trim();
    }
    if (formData.inquired_by && formData.inquired_by.trim()) {
      issueData.inquired_by = formData.inquired_by.trim();
    }
    if (formData.type) {
      issueData.type = formData.type;
    }

    // 디버깅용
    console.log('📤 Issue Data being sent:', issueData);
    console.log('📝 All fields:', {
      hasTitle: !!issueData.title,
      hasCategory: !!issueData.category,
      hasEntityId: !!issueData.entity_id,
      hasDescription: !!issueData.description,
      hasResponse: !!issueData.response,
      hasPeriod: !!issueData.period,
      periodValue: issueData.period || '(empty)',
      hasCreatedBy: !!issueData.created_by,
    });
    console.log('🔍 Raw formData.period:', formData.period);

    try {
      setLoading(true);
      const newIssue = await createIssue(issueData);
      toast.success('이슈가 등록되었습니다');
      onSuccess();
      onOpenChange(false);
      // 폼 초기화
      setFormData({
        title: '',
        category: undefined,
        entity_id: '',
        description: '',
        response: '',
        period: '',
        created_by: '',
        inquired_by: '',
        type: undefined,
      });
    } catch (error: any) {
      console.error('❌ Detailed Error:', error);
      
      // Supabase 에러 메시지 추출
      let errorMessage = '이슈 등록 실패';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.details) {
        errorMessage = error.details;
      } else if (error?.hint) {
        errorMessage = error.hint;
      }
      
      console.error('Error details:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      
      toast.error('이슈 등록 실패', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 수동 입력 폼 */}
          <div className="space-y-4">

            {/* 제목 */}
            <div>
              <Label htmlFor="title">
                제목 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="이슈 제목을 입력하세요"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                maxLength={200}
                required
              />
            </div>

            {/* 등록자 & Type & 카테고리 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="created_by">등록자</Label>
                <Input
                  id="created_by"
                  placeholder="등록자 이름"
                  value={formData.created_by || ''}
                  onChange={(e) => setFormData({ ...formData, created_by: e.target.value })}
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="type">Type</Label>
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

              <div>
                <Label htmlFor="category">
                  카테고리 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as IssueCategory })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
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
            </div>

            {/* 문의자 & Entity & 기간 */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="inquired_by">문의자</Label>
                <Input
                  id="inquired_by"
                  placeholder="문의자 이름"
                  value={formData.inquired_by || ''}
                  onChange={(e) => setFormData({ ...formData, inquired_by: e.target.value })}
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="entity">
                  Entity <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.entity_id}
                  onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="법인 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {subsidiaries.map((subsidiary) => {
                      // 괄호 안 코드 커스터마이징
                      let displayCode = subsidiary.code;
                      if (subsidiary.code === 'NLD') {
                        displayCode = 'EUR'; // Europe
                      } else if (subsidiary.code === 'HLTH') {
                        displayCode = 'IHC'; // Healthcare
                      }
                      
                      return (
                        <SelectItem key={subsidiary.id} value={subsidiary.id}>
                          {subsidiary.name} ({displayCode})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="period">기간 (선택)</Label>
                <Input
                  id="period"
                  placeholder="예: 20254Q"
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  maxLength={10}
                />
              </div>
            </div>

            {/* 설명 */}
            <div>
              <Label htmlFor="description">
                설명 <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="이슈에 대한 상세 설명을 입력하세요"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                required
              />
            </div>

            {/* 대응 내용 (선택) */}
            <div>
              <Label htmlFor="response">대응 내용 (선택)</Label>
              <Textarea
                id="response"
                placeholder="대응 내용이 있다면 입력하세요"
                value={formData.response}
                onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '등록 중...' : '등록하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

