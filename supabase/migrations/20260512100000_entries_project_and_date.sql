-- AI Career Builder — entries.project_name / entry_date 컬럼 추가
-- project_name: 사용자가 직접 부여하는 프로젝트 분류 (역량 chips 와 별개의 레이어)
-- entry_date  : 사용자가 편집 가능한 기록 날짜 (created_at 은 시스템 메타로 유지)

alter table public.entries
  add column if not exists project_name text,
  add column if not exists entry_date   timestamptz;
