-- ============================================================
-- Todo List — schema + RLS
--
-- GBS Admin 내부 업무 추적용 단순 todo 관리.
-- (결산 task 관리는 closing_task_master 와 별도)
--
-- 실행: Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.todo_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        text not null default 'todo'
                check (status in ('todo','in_progress','done')),
  priority      text not null default 'medium'
                check (priority in ('low','medium','high','urgent')),
  due_date      date,
  assignee      text,
  tags          text[] default '{}',
  entity_id     uuid references public.subsidiaries(id) on delete set null,
  created_by    text not null,
  created_by_id uuid not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists todo_items_status_idx     on public.todo_items (status);
create index if not exists todo_items_due_idx        on public.todo_items (due_date);
create index if not exists todo_items_assignee_idx   on public.todo_items (assignee);
create index if not exists todo_items_created_by_idx on public.todo_items (created_by_id);

-- updated_at trigger (이전에 만든 set_updated_at 재사용 가능, 안전하게 다시 정의)
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_todo_items_set_updated_at on public.todo_items;
create trigger trg_todo_items_set_updated_at
  before update on public.todo_items
  for each row execute function public.set_updated_at();

-- completed_at 자동 처리 (status → done 으로 변경되면 now(), 그 외로 변경되면 null)
create or replace function public.todo_set_completed_at() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if (new.status = 'done') then
      new.completed_at = now();
    end if;
  elsif (tg_op = 'UPDATE') then
    if (new.status = 'done' and (old.status is distinct from 'done')) then
      new.completed_at = now();
    elsif (new.status <> 'done' and (old.status = 'done')) then
      new.completed_at = null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_todo_items_set_completed_at on public.todo_items;
create trigger trg_todo_items_set_completed_at
  before insert or update on public.todo_items
  for each row execute function public.todo_set_completed_at();

-- ============================================================
-- RLS
--   - gbs_admin: 전체 todo 조회·편집·삭제
--   - 그 외 인증 사용자: 본인이 만든 todo 만 조회·편집·삭제
-- ============================================================
alter table public.todo_items enable row level security;

drop policy if exists todo_items_select on public.todo_items;
create policy todo_items_select on public.todo_items
  for select to authenticated
  using (
    created_by_id = auth.uid()
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  );

drop policy if exists todo_items_insert on public.todo_items;
create policy todo_items_insert on public.todo_items
  for insert to authenticated
  with check (created_by_id = auth.uid());

drop policy if exists todo_items_update on public.todo_items;
create policy todo_items_update on public.todo_items
  for update to authenticated
  using (
    created_by_id = auth.uid()
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  )
  with check (
    created_by_id = auth.uid()
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  );

drop policy if exists todo_items_delete on public.todo_items;
create policy todo_items_delete on public.todo_items
  for delete to authenticated
  using (
    created_by_id = auth.uid()
    or exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  );

-- ============================================================
-- 검증
-- ============================================================
-- select * from public.todo_items order by created_at desc limit 5;
