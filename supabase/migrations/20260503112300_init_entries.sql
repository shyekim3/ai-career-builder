-- AI Career Builder — entries 테이블 초기화
-- 1차: 회원가입 없음. localStorage 의 client_id 로 사용자 분리.
-- 다음 단계: Google OAuth 도입 시 user_id 컬럼을 추가하고 client_id → user_id 매핑.

create table if not exists public.entries (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  client_id     text        not null,
  raw_text      text        not null,
  metric_result text,
  star_result   text
);

create index if not exists entries_client_id_created_at_idx
  on public.entries (client_id, created_at desc);

alter table public.entries disable row level security;
