'use client';

/**
 * 결산 일정표 — Task 목록 탭
 *  - 필터 (카테고리 · freq · 담당자 · 상태 · 검색)
 *  - 인라인 상태 변경 / record 수정 (메모, 실제 일정, 산출물)
 *  - 마스터 CRUD
 */

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Plus, Check, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CLOSING_TASK_CAT_COLORS,
  CLOSING_TASK_STATUS_LABEL,
} from '@/lib/types/closing-task';
import type {
  ClosingTaskView,
  ClosingTaskStatus,
  ClosingTaskMaster,
} from '@/lib/types/closing-task';
import {
  upsertClosingTaskMaster,
  deleteClosingTaskMaster,
  upsertClosingTaskRecord,
} from '@/lib/services/closingTaskService';

interface TaskListTabProps {
  views: ClosingTaskView[];
  cmYear: number;
  cmMonth: number;
  onChanged: () => Promise<void>;
  onStatusToggle: (taskId: number, current: ClosingTaskStatus) => Promise<void>;
  onStatusChange: (taskId: number, next: ClosingTaskStatus) => Promise<void>;
}

const STATUS_OPTIONS: ClosingTaskStatus[] = ['todo', 'inprog', 'done', 'delay'];

export function TaskListTab(props: TaskListTabProps) {
  const { views, cmYear, cmMonth, onChanged, onStatusToggle, onStatusChange } = props;

  // 필터
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterFreq, setFilterFreq] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // 마스터 편집
  const [masterEditOpen, setMasterEditOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<Partial<ClosingTaskMaster> | null>(null);

  // record 편집 (메모/일정)
  const [recordEditOpen, setRecordEditOpen] = useState(false);
  const [editingView, setEditingView] = useState<ClosingTaskView | null>(null);
  const [editAsDate, setEditAsDate] = useState('');
  const [editAeDate, setEditAeDate] = useState('');
  const [editNote, setEditNote] = useState('');

  const cats = useMemo(
    () => Array.from(new Set(views.map((v) => v.master.cat))).sort(),
    [views],
  );
  const assignees = useMemo(
    () =>
      Array.from(new Set(views.map((v) => v.master.assignee).filter(Boolean) as string[])).sort(),
    [views],
  );

  const filtered = useMemo(() => {
    return views.filter((v) => {
      if (filterCat !== 'all' && v.master.cat !== filterCat) return false;
      if (filterFreq !== 'all' && v.master.freq !== filterFreq) return false;
      if (filterAssignee !== 'all' && v.master.assignee !== filterAssignee) return false;
      if (filterStatus !== 'all' && v.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !v.master.name.toLowerCase().includes(s) &&
          !(v.master.sub || '').toLowerCase().includes(s) &&
          !String(v.master.id).includes(s) &&
          !(v.master.output || '').toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [views, filterCat, filterFreq, filterAssignee, filterStatus, search]);

  const handleMasterSave = async () => {
    if (!editingMaster || !editingMaster.name) {
      toast.error('이름을 입력해 주세요.');
      return;
    }
    try {
      await upsertClosingTaskMaster({
        id: editingMaster.id,
        cat: editingMaster.cat || '기타',
        freq: editingMaster.freq || '월',
        sub: editingMaster.sub || undefined,
        name: editingMaster.name,
        assignee: editingMaster.assignee || undefined,
        ps: editingMaster.ps || undefined,
        pe: editingMaster.pe || undefined,
        output: editingMaster.output || undefined,
        active: editingMaster.active ?? true,
        display_order: editingMaster.display_order ?? undefined,
        predecessors: editingMaster.predecessors ?? [],
        successors: editingMaster.successors ?? [],
      });
      toast.success('저장되었습니다.');
      setMasterEditOpen(false);
      setEditingMaster(null);
      await onChanged();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleMasterDelete = async (id: number) => {
    if (!confirm(`Task #${id} 를 삭제하시겠습니까? (모든 사이클 기록도 삭제됩니다.)`)) return;
    try {
      await deleteClosingTaskMaster(id);
      toast.success('삭제되었습니다.');
      await onChanged();
    } catch (e: unknown) {
      toast.error(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const openRecordEdit = (v: ClosingTaskView) => {
    setEditingView(v);
    setEditAsDate(v.record?.as_date ?? '');
    setEditAeDate(v.record?.ae_date ?? '');
    setEditNote(v.record?.note ?? '');
    setRecordEditOpen(true);
  };

  const handleRecordSave = async () => {
    if (!editingView) return;
    try {
      await upsertClosingTaskRecord({
        taskId: editingView.master.id,
        cmYear,
        cmMonth,
        asDate: editAsDate || null,
        aeDate: editAeDate || null,
        note: editNote || null,
        // status 는 기존 record 유지 (별도 status 변경 핸들러 사용)
        status: editingView.record?.status,
      });
      toast.success('실적이 저장되었습니다.');
      setRecordEditOpen(false);
      setEditingView(null);
      await onChanged();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="space-y-3">
      {/* 필터 + 추가 */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
          <Input
            placeholder="검색 (이름 · 코드 · 산출물)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              {cats.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFreq} onValueChange={setFilterFreq}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="빈도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 빈도</SelectItem>
              <SelectItem value="월">월</SelectItem>
              <SelectItem value="분기">분기</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="담당자" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 담당자</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {CLOSING_TASK_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="ml-auto"
            style={{ backgroundColor: '#971B2F' }}
            onClick={() => {
              setEditingMaster({
                cat: '결산',
                freq: '월',
                name: '',
                assignee: '',
                ps: '',
                pe: '',
                active: true,
                predecessors: [],
                successors: [],
              });
              setMasterEditOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Task 추가
          </Button>
        </CardContent>
      </Card>

      {/* Task table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left py-3 px-3 w-12">#</th>
                <th className="text-left py-3 px-3 w-20">카테고리</th>
                <th className="text-left py-3 px-3 w-16">빈도</th>
                <th className="text-left py-3 px-3 w-24">세부</th>
                <th className="text-left py-3 px-3">Task 명</th>
                <th className="text-left py-3 px-3 w-24">담당자</th>
                <th className="text-center py-3 px-3 w-32">계획 (PS / PE)</th>
                <th className="text-center py-3 px-3 w-32">실제 (AS / AE)</th>
                <th className="text-left py-3 px-3 w-32">상태</th>
                <th className="text-left py-3 px-3 w-40">산출물</th>
                <th className="text-right py-3 px-3 w-24">액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-400">
                    표시할 task 가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const m = v.master;
                  const color = CLOSING_TASK_CAT_COLORS[m.cat] || '#67767F';
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        'border-b border-gray-100 hover:bg-gray-50',
                        v.status === 'done' && 'bg-emerald-50/30',
                        v.status === 'delay' && 'bg-rose-50/30',
                      )}
                    >
                      <td className="py-2 px-3 font-mono text-xs text-gray-500">
                        #{m.id}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] text-white font-semibold"
                          style={{ backgroundColor: color }}
                        >
                          {m.cat}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded text-[10px] font-semibold',
                            m.freq === '월'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700',
                          )}
                        >
                          {m.freq}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600">{m.sub || '-'}</td>
                      <td className="py-2 px-3 text-gray-800">
                        <button
                          type="button"
                          onClick={() => openRecordEdit(v)}
                          className="hover:underline text-left"
                          title="클릭하여 실적 편집"
                        >
                          {m.name}
                        </button>
                        {m.predecessors.length > 0 && (
                          <span className="ml-2 text-[10px] text-gray-400">
                            ← #{m.predecessors.join(', #')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-700">{m.assignee || '-'}</td>
                      <td className="py-2 px-3 text-center text-xs font-mono text-gray-600">
                        {m.ps || '-'} / {m.pe || '-'}
                        {v.plannedStart && v.plannedEnd && (
                          <div className="text-[10px] text-gray-400">
                            ({fmtMD(v.plannedStart)} ~ {fmtMD(v.plannedEnd)})
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-xs font-mono text-gray-600">
                        {v.record?.as_date ? fmtMD(new Date(v.record.as_date)) : '-'} /{' '}
                        {v.record?.ae_date ? fmtMD(new Date(v.record.ae_date)) : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void onStatusToggle(m.id, v.status)}
                            className={cn(
                              'inline-flex items-center justify-center w-5 h-5 rounded border transition-colors',
                              v.status === 'done'
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-gray-300 hover:border-emerald-400 text-transparent hover:text-emerald-400',
                            )}
                            title={v.status === 'done' ? '완료 → 예정으로 되돌리기' : '완료 처리'}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <Select
                            value={v.status}
                            onValueChange={(s) =>
                              void onStatusChange(m.id, s as ClosingTaskStatus)
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                'h-7 text-[11px] px-2 w-[88px]',
                                v.status === 'done' &&
                                  'border-emerald-200 bg-emerald-50 text-emerald-700',
                                v.status === 'inprog' &&
                                  'border-amber-200 bg-amber-50 text-amber-700',
                                v.status === 'delay' &&
                                  'border-rose-200 bg-rose-50 text-rose-700',
                                v.status === 'todo' && 'border-gray-200 text-gray-600',
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">
                                  {CLOSING_TASK_STATUS_LABEL[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600">{m.output || '-'}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMaster(m);
                            setMasterEditOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-700"
                          title="마스터 편집"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleMasterDelete(m.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600"
                          title="마스터 삭제"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 마스터 편집 다이얼로그 */}
      <Dialog open={masterEditOpen} onOpenChange={setMasterEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingMaster?.id != null ? `Task #${editingMaster.id} 편집` : 'Task 추가'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">카테고리</Label>
                <Select
                  value={editingMaster?.cat || '결산'}
                  onValueChange={(v) =>
                    setEditingMaster((prev) => ({ ...(prev || {}), cat: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(CLOSING_TASK_CAT_COLORS).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">빈도</Label>
                <Select
                  value={editingMaster?.freq || '월'}
                  onValueChange={(v) =>
                    setEditingMaster((prev) => ({
                      ...(prev || {}),
                      freq: v as '월' | '분기',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="월">월</SelectItem>
                    <SelectItem value="분기">분기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Task 명</Label>
              <Input
                value={editingMaster?.name || ''}
                onChange={(e) =>
                  setEditingMaster((prev) => ({ ...(prev || {}), name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">세부 (sub)</Label>
                <Input
                  value={editingMaster?.sub || ''}
                  onChange={(e) =>
                    setEditingMaster((prev) => ({ ...(prev || {}), sub: e.target.value }))
                  }
                  placeholder="원가결산 / 매출 …"
                />
              </div>
              <div>
                <Label className="text-xs">담당자</Label>
                <Input
                  value={editingMaster?.assignee || ''}
                  onChange={(e) =>
                    setEditingMaster((prev) => ({
                      ...(prev || {}),
                      assignee: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">계획 시작 (PS)</Label>
                <Input
                  value={editingMaster?.ps || ''}
                  onChange={(e) =>
                    setEditingMaster((prev) => ({ ...(prev || {}), ps: e.target.value }))
                  }
                  placeholder="D-3 / D+0 / D+4"
                />
              </div>
              <div>
                <Label className="text-xs">계획 종료 (PE)</Label>
                <Input
                  value={editingMaster?.pe || ''}
                  onChange={(e) =>
                    setEditingMaster((prev) => ({ ...(prev || {}), pe: e.target.value }))
                  }
                  placeholder="D-1 / D+0 / D+5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">산출물</Label>
              <Input
                value={editingMaster?.output || ''}
                onChange={(e) =>
                  setEditingMaster((prev) => ({ ...(prev || {}), output: e.target.value }))
                }
                placeholder="제조원가명세서 / 광고선전비 대시보드 …"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">선행 Task (Predecessors)</Label>
                <TaskMultiSelectPicker
                  allTasks={views.map((v) => v.master)}
                  excludeId={editingMaster?.id}
                  selected={editingMaster?.predecessors ?? []}
                  onChange={(next) =>
                    setEditingMaster((prev) => ({ ...(prev || {}), predecessors: next }))
                  }
                  placeholder="선행 task 선택"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  이 task 가 시작되기 전에 끝나야 할 task 들
                </p>
              </div>
              <div>
                <Label className="text-xs">후행 Task (Successors)</Label>
                <TaskMultiSelectPicker
                  allTasks={views.map((v) => v.master)}
                  excludeId={editingMaster?.id}
                  selected={editingMaster?.successors ?? []}
                  onChange={(next) =>
                    setEditingMaster((prev) => ({ ...(prev || {}), successors: next }))
                  }
                  placeholder="후행 task 선택"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  이 task 가 끝난 뒤 시작할 수 있는 task 들
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setMasterEditOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => void handleMasterSave()}
              style={{ backgroundColor: '#971B2F' }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record 편집 (실적/메모) */}
      <Dialog open={recordEditOpen} onOpenChange={setRecordEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              실적 편집 — #{editingView?.master.id} {editingView?.master.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">실제 시작 (AS)</Label>
                <Input
                  type="date"
                  value={editAsDate}
                  onChange={(e) => setEditAsDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">실제 종료 (AE)</Label>
                <Input
                  type="date"
                  value={editAeDate}
                  onChange={(e) => setEditAeDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">메모</Label>
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                placeholder="진행 상황 · 이슈 · 다음 단계"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              파일 업로드는 v1.5 에서 추가 예정 (현재 메모만 저장).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRecordEditOpen(false)}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRecordSave()}
              style={{ backgroundColor: '#971B2F' }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ============================================================
// Multi-select picker for predecessors / successors
// ============================================================
function TaskMultiSelectPicker({
  allTasks,
  excludeId,
  selected,
  onChange,
  placeholder,
}: {
  allTasks: ClosingTaskMaster[];
  excludeId: number | undefined;
  selected: number[];
  onChange: (next: number[]) => void;
  placeholder: string;
}) {
  const options = useMemo(
    () =>
      [...allTasks]
        .filter((t) => t.id !== excludeId)
        .sort((a, b) => a.id - b.id),
    [allTasks, excludeId],
  );
  const selectedSet = new Set(selected);
  const selectedTasks = options.filter((t) => selectedSet.has(t.id));

  return (
    <div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal h-9 px-3 text-sm"
            type="button"
          >
            <span className="truncate text-left">
              {selected.length === 0
                ? placeholder
                : selected.length === 1
                  ? (() => {
                      const t = options.find((o) => o.id === selected[0]);
                      return t ? `#${t.id} ${t.name}` : `#${selected[0]}`;
                    })()
                  : `${selected.length}개 선택됨`}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="start">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 text-xs">
            <span className="text-gray-500">
              {selected.length}/{options.length} 선택
            </span>
            <button
              type="button"
              className="text-gray-500 hover:underline"
              onClick={() => onChange([])}
            >
              해제
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto py-1">
            {options.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3 text-center">
                선택 가능한 task 가 없습니다.
              </p>
            ) : (
              options.map((t) => {
                const checked = selectedSet.has(t.id);
                return (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const next = v
                          ? [...selected, t.id]
                          : selected.filter((c) => c !== t.id);
                        onChange(next.sort((a, b) => a - b));
                      }}
                    />
                    <span className="text-gray-500 font-mono text-xs w-10 flex-shrink-0">
                      #{t.id}
                    </span>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 w-12">
                      {t.cat}
                    </span>
                    <span className="flex-1 truncate" title={t.name}>
                      {t.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {selectedTasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedTasks.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] text-gray-700"
              title={t.name}
            >
              <span className="font-mono text-[10px] text-gray-500">#{t.id}</span>
              <span className="max-w-[140px] truncate">{t.name}</span>
              <button
                type="button"
                onClick={() => onChange(selected.filter((c) => c !== t.id))}
                className="text-gray-400 hover:text-rose-600 ml-0.5"
                title="제거"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
