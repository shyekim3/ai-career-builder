-- AI Career Builder — entries.chips 컬럼 추가
-- 변환 결과의 '연결 역량' 태그를 entries 테이블에 함께 저장한다.
-- 기존 row 는 빈 배열 디폴트.

alter table public.entries
  add column if not exists chips text[] not null default '{}';
