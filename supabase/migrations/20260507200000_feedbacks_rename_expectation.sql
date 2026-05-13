-- AI Career Builder — feedbacks.pain_point → expectation 으로 컬럼명 변경
-- 질문 카피가 "기대했던 점"으로 정리되면서 컬럼명도 의미에 맞게 정리한다.

alter table public.feedbacks
  rename column pain_point to expectation;
