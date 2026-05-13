-- AI Career Builder — entries.metric_result_original 컬럼 추가
-- 사용자가 변환 문장을 직접 편집할 수 있도록 metric_result 는 사용자 편집 결과로 사용하고,
-- AI 가 처음 만들어준 원본은 metric_result_original 에 별도로 보존한다.
-- 기존 row 는 현재 metric_result 를 원본으로 백필.

alter table public.entries
  add column if not exists metric_result_original text;

update public.entries
  set metric_result_original = metric_result
  where metric_result_original is null
    and metric_result is not null;
