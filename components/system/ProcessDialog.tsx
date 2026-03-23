'use client';

/**
 * 프로세스 생성/수정 Dialog
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import type { Process, ProcessCategory } from '@/lib/types/system';
import type { Subsidiary } from '@/lib/supabase/types';
import { createProcess, updateProcess } from '@/lib/services/processService';

interface ProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process?: Process | null;
  subsidiaries: Subsidiary[];
  onSuccess: () => void;
}

const PROCESS_CATEGORIES: ProcessCategory[] = [
  '회계',
  '구매',
  '판매',
  '비용',
  '자금',
  'FOC',
  '결산',
];

export function ProcessDialog({
  open,
  onOpenChange,
  process,
  subsidiaries,
  onSuccess,
}: ProcessDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    entity_id: '',
    category: '' as ProcessCategory | '',
    description: '',
  });

  useEffect(() => {
    if (process) {
      setFormData({
        title: process.title,
        entity_id: process.entity_id,
        category: process.category,
        description: process.description || '',
      });
    } else {
      setFormData({
        title: '',
        entity_id: '',
        category: '' as ProcessCategory | '',
        description: '',
      });
    }
  }, [process, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.entity_id || !formData.category) {
      toast.error('필수 항목을 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      const createdBy = user?.email || user?.id || 'unknown';

      const processData = {
        title: formData.title,
        entity_id: formData.entity_id,
        category: formData.category,
        description: formData.description || null,
        flowchart_data: process?.flowchart_data || {},
        created_by: createdBy,
        version: 1,
        status: 'draft',
        approved_by: null,
        approved_at: null,
      };

      if (process) {
        await updateProcess(process.id, processData);
        toast.success('프로세스가 수정되었습니다');
      } else {
        await createProcess(processData);
        toast.success('프로세스가 생성되었습니다');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save process:', error);
      toast.error('저장 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{process ? '프로세스 수정' : 'New Process'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">
              프로세스명 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 월마감 프로세스"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="entity_id">
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
                  {subsidiaries.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category">
                카테고리 <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value as ProcessCategory })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {PROCESS_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="프로세스에 대한 설명을 입력하세요"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '저장 중...' : process ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

