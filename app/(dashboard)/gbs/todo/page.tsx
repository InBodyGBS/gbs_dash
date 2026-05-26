'use client';

/**
 * Todo List 페이지
 *  - 카드 리스트 + 필터 + 검색 + 정렬
 *  - 카드 좌측 체크박스로 빠른 상태 토글 (todo ↔ done)
 *  - 생성 / 수정 / 삭제 다이얼로그
 *  - Stats 카드 (전체 / 진행중 / 완료 / 마감임박 / 지연)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckSquare, Plus, Pencil, Trash2, Search, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import {
  getTodos,
  createTodo,
  updateTodo,
  updateTodoStatus,
  deleteTodo,
} from '@/lib/services/todoService';
import {
  TODO_STATUS_LABEL,
  TODO_STATUS_COLOR,
  TODO_PRIORITY_LABEL,
  TODO_PRIORITY_COLOR,
  TODO_PRIORITY_ORDER,
} from '@/lib/types/todo';
import type {
  TodoItem,
  TodoStatus,
  TodoPriority,
  TodoFormData,
  TodoSortOption,
} from '@/lib/types/todo';
import { displayNameFromAuthUser } from '@/lib/utils/authDisplayName';

const STATUSES: TodoStatus[] = ['todo', 'in_progress', 'done'];
const PRIORITIES: TodoPriority[] = ['urgent', 'high', 'medium', 'low'];

export default function TodoPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorName, setAuthorName] = useState('');
  const [authorId, setAuthorId] = useState('');

  // filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TodoStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<TodoPriority | 'all'>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [sortBy, setSortBy] = useState<TodoSortOption>('due_asc');

  // edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TodoFormData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 작성자 정보 — user_profiles 우선, 폴백으로 auth user metadata
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      // user_profiles 의 name 우선
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
      const profileName = (profile as { name?: string | null } | null)?.name;
      const fallback = displayNameFromAuthUser(user);
      if (!cancelled) {
        setAuthorName(profileName || fallback || user.email || 'unknown');
        setAuthorId(user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getTodos();
      setTodos(rows);
    } catch (e: unknown) {
      toast.error(`로드 실패: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // assignees 후보 (todo 안의 unique)
  const assignees = useMemo(() => {
    const set = new Set<string>();
    todos.forEach((t) => {
      if (t.assignee) set.add(t.assignee);
    });
    return Array.from(set).sort();
  }, [todos]);

  // 필터 + 정렬
  const filtered = useMemo(() => {
    let arr = [...todos];
    if (!showCompleted) {
      arr = arr.filter((t) => t.status !== 'done');
    }
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          (t.description || '').toLowerCase().includes(s) ||
          t.tags.some((tag) => tag.toLowerCase().includes(s)),
      );
    }
    if (filterStatus !== 'all') arr = arr.filter((t) => t.status === filterStatus);
    if (filterPriority !== 'all') arr = arr.filter((t) => t.priority === filterPriority);
    if (filterAssignee !== 'all') arr = arr.filter((t) => t.assignee === filterAssignee);

    arr.sort((a, b) => {
      switch (sortBy) {
        case 'due_asc': {
          const ad = a.due_date ?? '9999-12-31';
          const bd = b.due_date ?? '9999-12-31';
          return ad.localeCompare(bd);
        }
        case 'due_desc': {
          const ad = a.due_date ?? '0000-01-01';
          const bd = b.due_date ?? '0000-01-01';
          return bd.localeCompare(ad);
        }
        case 'created_desc':
          return b.created_at.localeCompare(a.created_at);
        case 'created_asc':
          return a.created_at.localeCompare(b.created_at);
        case 'priority':
          return TODO_PRIORITY_ORDER[a.priority] - TODO_PRIORITY_ORDER[b.priority];
        default:
          return 0;
      }
    });
    return arr;
  }, [todos, search, filterStatus, filterPriority, filterAssignee, showCompleted, sortBy]);

  // stats
  const stats = useMemo(() => {
    const total = todos.length;
    const todoCount = todos.filter((t) => t.status === 'todo').length;
    const inProg = todos.filter((t) => t.status === 'in_progress').length;
    const done = todos.filter((t) => t.status === 'done').length;
    const today = startOfToday();
    const in3 = addDaysIso(3);
    let dueSoon = 0;
    let overdue = 0;
    todos.forEach((t) => {
      if (t.status === 'done') return;
      if (!t.due_date) return;
      if (t.due_date < today) overdue += 1;
      else if (t.due_date <= in3) dueSoon += 1;
    });
    return { total, todoCount, inProg, done, dueSoon, overdue };
  }, [todos]);

  // status toggle
  const handleStatusToggle = async (id: string, current: TodoStatus) => {
    const next: TodoStatus = current === 'done' ? 'todo' : 'done';
    try {
      await updateTodoStatus(id, next);
      await loadAll();
    } catch (e: unknown) {
      toast.error(`상태 변경 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const openCreate = () => {
    setEditing({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      tags: [],
    });
    setEditingId(null);
    setDialogOpen(true);
  };

  const openEdit = (t: TodoItem) => {
    setEditing({
      title: t.title,
      description: t.description ?? '',
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      assignee: t.assignee ?? '',
      tags: t.tags,
      entity_id: t.entity_id,
    });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error('제목을 입력해 주세요.');
      return;
    }
    try {
      if (editingId) {
        await updateTodo(editingId, editing);
      } else {
        if (!authorId) {
          toast.error('로그인 정보가 없습니다.');
          return;
        }
        await createTodo(editing, authorName, authorId);
      }
      toast.success('저장되었습니다.');
      setDialogOpen(false);
      setEditing(null);
      setEditingId(null);
      await loadAll();
    } catch (e: unknown) {
      toast.error(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 Todo 를 삭제하시겠습니까?')) return;
    try {
      await deleteTodo(id);
      toast.success('삭제되었습니다.');
      await loadAll();
    } catch (e: unknown) {
      toast.error(`삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1400px] mx-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare className="h-6 w-6" style={{ color: '#971B2F' }} />
              Todo List
            </h1>
            <p className="text-sm text-gray-500 mt-1">GBS 내부 업무 관리</p>
          </div>
          <Button onClick={openCreate} style={{ backgroundColor: '#971B2F' }}>
            <Plus className="h-4 w-4 mr-1.5" />새 Todo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <StatCard label="전체" value={stats.total} color="text-gray-900" />
          <StatCard label="진행중" value={stats.inProg} color="text-blue-600" />
          <StatCard label="완료" value={stats.done} color="text-emerald-600" />
          <StatCard
            label="마감 임박 (D-3)"
            value={stats.dueSoon}
            color="text-amber-600"
            danger={stats.dueSoon > 0}
          />
          <StatCard
            label="지연"
            value={stats.overdue}
            color="text-rose-600"
            danger={stats.overdue > 0}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="검색 (제목/본문/태그)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 w-64 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TodoStatus | 'all')}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TODO_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterPriority}
              onValueChange={(v) => setFilterPriority(v as TodoPriority | 'all')}
            >
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 우선순위</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {TODO_PRIORITY_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
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
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as TodoSortOption)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due_asc">마감일 가까운 순</SelectItem>
                <SelectItem value="due_desc">마감일 먼 순</SelectItem>
                <SelectItem value="created_desc">최근 생성순</SelectItem>
                <SelectItem value="created_asc">오래된 생성순</SelectItem>
                <SelectItem value="priority">우선순위순</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded"
              />
              완료 표시
            </label>
          </CardContent>
        </Card>

        {/* List */}
        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-400">로드 중...</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-gray-500">
                {todos.length === 0 ? '아직 Todo 가 없습니다.' : '조건에 맞는 Todo 가 없습니다.'}
              </p>
              {todos.length === 0 && (
                <p className="text-xs text-gray-400">
                  Tip — SQL 마이그레이션이 아직이라면{' '}
                  <span className="font-mono">docs/todo-items-schema.sql</span> 을 먼저 실행하세요.
                </p>
              )}
              <Button size="sm" variant="outline" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />새 Todo 추가
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                onStatusToggle={handleStatusToggle}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Todo 편집' : '새 Todo'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">제목 *</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  placeholder="할 일 제목"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">상태</Label>
                  <Select
                    value={editing.status || 'todo'}
                    onValueChange={(v) =>
                      setEditing({ ...editing, status: v as TodoStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {TODO_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">우선순위</Label>
                  <Select
                    value={editing.priority || 'medium'}
                    onValueChange={(v) =>
                      setEditing({ ...editing, priority: v as TodoPriority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {TODO_PRIORITY_LABEL[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">마감일</Label>
                  <Input
                    type="date"
                    value={editing.due_date ?? ''}
                    onChange={(e) =>
                      setEditing({ ...editing, due_date: e.target.value || null })
                    }
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">담당자</Label>
                <Input
                  value={editing.assignee ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, assignee: e.target.value })
                  }
                  placeholder="담당자 이름"
                />
              </div>
              <div>
                <Label className="text-xs">태그 (쉼표 구분)</Label>
                <Input
                  value={(editing.tags ?? []).join(', ')}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      tags: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="예: 결산, 보고, 긴급"
                />
              </div>
              <div>
                <Label className="text-xs">설명</Label>
                <Textarea
                  rows={4}
                  value={editing.description ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                  placeholder="상세 내용"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void handleSave()} style={{ backgroundColor: '#971B2F' }}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({
  label,
  value,
  color,
  danger,
}: {
  label: string;
  value: number;
  color: string;
  danger?: boolean;
}) {
  return (
    <Card className={cn(danger && 'border-rose-300 bg-rose-50/40')}>
      <CardContent className="py-4 px-4">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TodoRow({
  todo,
  onStatusToggle,
  onEdit,
  onDelete,
}: {
  todo: TodoItem;
  onStatusToggle: (id: string, current: TodoStatus) => Promise<void>;
  onEdit: (t: TodoItem) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const done = todo.status === 'done';
  const today = startOfToday();
  const isOverdue = !done && todo.due_date && todo.due_date < today;
  const dCount = todo.due_date ? dayDiff(todo.due_date, today) : null;
  const dLabel =
    dCount === null ? null : dCount < 0 ? `D+${-dCount}` : dCount === 0 ? 'D-0' : `D-${dCount}`;

  return (
    <Card
      className={cn(
        'transition-colors',
        done && 'opacity-60',
        isOverdue && 'border-l-4 border-l-rose-500',
        !done && !isOverdue && todo.status === 'in_progress' && 'border-l-4 border-l-blue-500',
        !done && !isOverdue && todo.status === 'todo' && 'border-l-4 border-l-gray-300',
      )}
    >
      <CardContent className="py-3 px-4 flex items-start gap-3">
        {/* 체크박스 */}
        <button
          type="button"
          onClick={() => void onStatusToggle(todo.id, todo.status)}
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded border-2 mt-0.5 flex items-center justify-center transition-colors',
            done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-gray-300 hover:border-emerald-400',
          )}
          title={done ? '완료 해제' : '완료 처리'}
        >
          {done && <CheckSquare className="h-3 w-3" />}
        </button>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={cn(
                'text-sm font-medium text-gray-900',
                done && 'line-through text-gray-400',
              )}
            >
              {todo.title}
            </h3>
            {/* 우선순위 뱃지 */}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-white"
              style={{ backgroundColor: TODO_PRIORITY_COLOR[todo.priority] }}
            >
              {TODO_PRIORITY_LABEL[todo.priority]}
            </span>
            {/* 상태 뱃지 (todo/in_progress 만 시각화) */}
            {!done && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                style={{
                  backgroundColor: TODO_STATUS_COLOR[todo.status] + '20',
                  color: TODO_STATUS_COLOR[todo.status],
                }}
              >
                {TODO_STATUS_LABEL[todo.status]}
              </span>
            )}
            {/* D-day */}
            {dLabel && (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5',
                  isOverdue
                    ? 'bg-rose-100 text-rose-700'
                    : dCount !== null && dCount <= 3
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600',
                )}
              >
                <Calendar className="h-2.5 w-2.5" />
                {dLabel}
              </span>
            )}
          </div>
          {todo.description && (
            <p
              className={cn(
                'text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap',
                done && 'line-through',
              )}
            >
              {todo.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
            {todo.assignee && <span>담당: {todo.assignee}</span>}
            {todo.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {todo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <span className="ml-auto">
              {todo.created_by} · {todo.created_at.slice(0, 10)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(todo)}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
            title="편집"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onDelete(todo.id)}
            className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50"
            title="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 유틸
// ============================================================
function startOfToday(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}
function addDaysIso(days: number): string {
  const t = new Date();
  t.setDate(t.getDate() + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(
    t.getDate(),
  ).padStart(2, '0')}`;
}
function dayDiff(future: string, base: string): number {
  // (future - base) days
  const f = new Date(future);
  const b = new Date(base);
  return Math.round((b.getTime() - f.getTime()) / (1000 * 60 * 60 * 24)) * -1;
}
