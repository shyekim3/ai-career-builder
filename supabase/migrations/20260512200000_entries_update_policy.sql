-- AI Career Builder — entries 테이블 UPDATE RLS 정책 추가
-- 초기 마이그레이션에는 select/insert/delete 만 정의되어 있어 PATCH(날짜·프로젝트명 수정)가 차단된다.
-- 자기 자신의 row 만 수정 가능하도록 user_id 기준 정책을 추가한다.

drop policy if exists "update own entries" on public.entries;
create policy "update own entries" on public.entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
