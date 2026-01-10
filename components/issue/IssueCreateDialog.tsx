'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [formData, setFormData] = useState<Partial<IssueFormData>>({
    title: '',
    category: undefined,
    entity_id: '',
    description: '',
    response: '',
    created_by: '조승현', // TODO: 실제 사용자 인증 연동
  });

  // AI로 자연어 입력 파싱
  const handleAIParse = async () => {
    if (!aiInput.trim()) {
      toast.error('내용을 입력해주세요');
      return;
    }

    try {
      setAiLoading(true);
      toast.loading('AI가 분석 중입니다...');

      // API 호출
      const response = await fetch('/api/ai/parse-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: aiInput,
          subsidiaries: subsidiaries,
        }),
      });

      if (!response.ok) {
        throw new Error('AI 파싱 실패');
      }

      const result = await response.json();
      console.log('✅ AI 파싱 결과:', result);

      // 새로운 응답 형식 처리: { success: true, data: {...} }
      const parsed = result.data || result;

      // 법인 ID 찾기
      const subsidiary = subsidiaries.find(
        (s) =>
          s.code.toLowerCase() === parsed.entity.toLowerCase() ||
          s.name.toLowerCase().includes(parsed.entity.toLowerCase())
      );

      // 폼 자동 채우기
      setFormData({
        ...formData,
        title: parsed.title,
        category: parsed.category as IssueCategory,
        entity_id: subsidiary?.id || subsidiaries.find((s) => s.code === 'HQ')?.id || '',
        description: parsed.description,
      });

      toast.dismiss();
      toast.success('AI 분석 완료! 내용을 확인하고 수정하세요');
    } catch (error) {
      console.error('AI 파싱 에러:', error);
      toast.dismiss();
      toast.error('AI 분석에 실패했습니다. 수동으로 입력해주세요');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 유효성 검사
    if (!formData.title || !formData.category || !formData.entity_id || !formData.description) {
      toast.error('필수 항목을 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      await createIssue(formData as IssueFormData);
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
        created_by: '조승현',
      });
      setAiInput('');
    } catch (error) {
      console.error('Failed to create issue:', error);
      toast.error('이슈 등록 실패');
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
          {/* AI Issue Writer */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">AI Issue Writer</h3>
            </div>
            <Textarea
              placeholder="자연어로 이슈를 입력하세요...&#10;&#10;예: USA 법인의 리스 회계 처리가 K-IFRS와 다르게 되어있어요. 재작성이 필요합니다."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              rows={4}
              className="mb-3"
            />
            <Button
              type="button"
              onClick={handleAIParse}
              disabled={aiLoading || !aiInput.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {aiLoading ? 'AI 분석 중...' : '✨ AI로 변환하기'}
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-gray-500">OR</span>
            <Separator className="flex-1" />
          </div>

          {/* 수동 입력 폼 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">📝 수동 입력</h3>

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

            {/* 카테고리 & Entity */}
            <div className="grid grid-cols-2 gap-4">
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

