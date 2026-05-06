-- AI Career Builder — 사용자 피드백 수집 테이블
-- 익명 제출을 허용하기 위해 RLS 는 활성화하되 anon insert 만 허용한다.

create table if not exists public.feedbacks (
  id          uuid        primary key default gen_random_uuid(),
  rating      int2        not null check (rating between 1 and 4),
  pain_point  text,
  comment     text,
  created_at  timestamptz not null default now()
);

create index if not exists feedbacks_created_at_idx
  on public.feedbacks (created_at desc);

alter table public.feedbacks enable row level security;

drop policy if exists "anon insert feedbacks" on public.feedbacks;
create policy "anon insert feedbacks" on public.feedbacks
  for insert
  to anon, authenticated
  with check (rating between 1 and 4);
