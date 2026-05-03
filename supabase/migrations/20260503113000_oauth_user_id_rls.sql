-- AI Career Builder — Google OAuth 도입에 따른 entries 스키마 변경
-- 1) client_id (localStorage UUID) 기반 → user_id (auth.users.id) 기반으로 전환
-- 2) RLS 활성화 + 사용자별 격리 정책

-- 기존 client_id 기반 행은 user_id 가 NULL 이라 RLS 정책에 의해 자동으로 격리됨.
-- 의미 있는 사용자 데이터가 없는 단계라 별도 백필은 하지 않음.
alter table public.entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

drop index if exists public.entries_client_id_created_at_idx;
create index if not exists entries_user_id_created_at_idx
  on public.entries (user_id, created_at desc);

alter table public.entries drop column if exists client_id;

alter table public.entries enable row level security;

drop policy if exists "select own entries" on public.entries;
create policy "select own entries" on public.entries
  for select using (auth.uid() = user_id);

drop policy if exists "insert own entries" on public.entries;
create policy "insert own entries" on public.entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own entries" on public.entries;
create policy "delete own entries" on public.entries
  for delete using (auth.uid() = user_id);
