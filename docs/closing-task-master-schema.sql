-- ============================================================
-- 결산 일정표 (Closing Task Master) — schema + seed
--
-- 3 tables:
--   closing_task_master       : 재사용 task 정의 (마스터)
--   closing_task_records      : 결산월별 실행 기록
--   closing_holidays          : 공휴일 (D-day → 절대일 환산 시 영업일 제외용)
--
-- 권한: gbs_admin 만 모든 작업 가능. 그 외 미접근.
--
-- 실행: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) Task Master ---------------------------------------------
create table if not exists public.closing_task_master (
  id            integer primary key,
  cat           text not null,
  freq          text not null check (freq in ('월','분기')),
  sub           text,
  name          text not null,
  assignee      text,
  ps            text,                          -- 'D-3', 'D+4' 등
  pe            text,
  predecessors  integer[] default '{}',
  successors    integer[] default '{}',
  output        text,
  active        boolean default true,
  display_order integer,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists closing_task_master_cat_idx     on public.closing_task_master (cat);
create index if not exists closing_task_master_freq_idx    on public.closing_task_master (freq);
create index if not exists closing_task_master_active_idx  on public.closing_task_master (active);

-- 2) Task Records --------------------------------------------
create table if not exists public.closing_task_records (
  id            uuid primary key default gen_random_uuid(),
  task_id       integer not null references public.closing_task_master(id) on delete cascade,
  cm_year       integer not null,
  cm_month      integer not null check (cm_month between 1 and 12),
  as_date       date,
  ae_date       date,
  status        text not null default 'todo'
                check (status in ('todo','inprog','done','delay')),
  note          text,
  files         jsonb default '[]',
  completed_by  text,
  completed_at  timestamptz,
  updated_at    timestamptz default now(),
  unique (task_id, cm_year, cm_month)
);

create index if not exists closing_task_records_cycle_idx
  on public.closing_task_records (cm_year, cm_month);
create index if not exists closing_task_records_status_idx
  on public.closing_task_records (status);

-- 3) Holidays ------------------------------------------------
create table if not exists public.closing_holidays (
  holiday_date  date primary key,
  name          text
);

-- 4) updated_at trigger --------------------------------------
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_closing_task_master_set_updated_at on public.closing_task_master;
create trigger trg_closing_task_master_set_updated_at
  before update on public.closing_task_master
  for each row execute function public.set_updated_at();

drop trigger if exists trg_closing_task_records_set_updated_at on public.closing_task_records;
create trigger trg_closing_task_records_set_updated_at
  before update on public.closing_task_records
  for each row execute function public.set_updated_at();

-- 5) RLS — gbs_admin 만 ---------------------------------------
alter table public.closing_task_master  enable row level security;
alter table public.closing_task_records enable row level security;
alter table public.closing_holidays     enable row level security;

drop policy if exists closing_task_master_admin_all on public.closing_task_master;
create policy closing_task_master_admin_all on public.closing_task_master
  for all to authenticated
  using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  )
  with check (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  );

drop policy if exists closing_task_records_admin_all on public.closing_task_records;
create policy closing_task_records_admin_all on public.closing_task_records
  for all to authenticated
  using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  )
  with check (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  );

drop policy if exists closing_holidays_admin_all on public.closing_holidays;
create policy closing_holidays_admin_all on public.closing_holidays
  for all to authenticated
  using (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  )
  with check (
    exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
    or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
  );

-- ============================================================
-- 6) Seed (선택) — 별도 파일로 분리
-- ============================================================
-- 본 마이그레이션은 빈 테이블만 만든다.
--   예시/참고용 seed 가 필요하면 docs/closing-task-master-seed-example.sql
--   을 별도로 실행하거나, UI 의 "+ Task 추가" 버튼으로 직접 입력한다.

-- 7) Storage 버킷 ---------------------------------------------
insert into storage.buckets (id, name, public)
values ('closing-task-files', 'closing-task-files', false)
on conflict (id) do nothing;

drop policy if exists closing_task_files_admin_read on storage.objects;
create policy closing_task_files_admin_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'closing-task-files'
    and (
      exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
      or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
    )
  );

drop policy if exists closing_task_files_admin_write on storage.objects;
create policy closing_task_files_admin_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'closing-task-files'
    and (
      exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
      or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
    )
  );

drop policy if exists closing_task_files_admin_delete on storage.objects;
create policy closing_task_files_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'closing-task-files'
    and (
      exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'gbs_admin')
      or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.is_admin = true)
    )
  );

-- ============================================================
-- 검증
-- ============================================================
-- select count(*) from public.closing_task_master;        -- 34
-- select cat, count(*) from public.closing_task_master group by cat order by cat;
-- select freq, count(*) from public.closing_task_master group by freq;
