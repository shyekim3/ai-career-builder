# Mixpanel 이벤트 설계

랜딩 → 입력 → 성과 변환 → 후속 질문 → 저장/복사 흐름을 단계별로 트래킹.
모든 이벤트는 [`lib/mixpanel.ts`](../lib/mixpanel.ts)의 `track(event, props)`로 전송한다.

---

## 1단계 — 입력

| 이벤트 | 발생 시점 | 프로퍼티 |
|---|---|---|
| `input_started` | textarea에 첫 글자 입력 시 | `char_count: number`<br>`input_type: 'short' \| 'long'` |
| `input_cleared` | 입력값을 전부 지웠을 때 | `time_spent_sec: number` |
| `input_submitted` | 변환 요청 직전 (form submit / 재생성 포함) | `char_count: number`<br>`word_count: number`<br>`has_numbers: boolean` |

---

## 2단계 — 성과 변환

| 이벤트 | 발생 시점 | 프로퍼티 |
|---|---|---|
| `transform_requested` | 첫 변환 호출 (`result === null`) | `input_length: number` |
| `transform_regenerated` | 결과가 있는 상태에서 "성과 문장으로 바꾸기" 버튼을 다시 클릭했을 때 | `reason: 'restart'`<br>`attempt_count: number` |
| `transform_needs_info` | API가 `needs_info` 응답 시 | `latency_ms: number` |
| `transform_completed` | 변환 결과 도착 시 | `latency_ms: number`<br>`output_length: number`<br>`star_method_used: boolean` |
| `transform_rephrase` **(신규)** | **"다른 표현으로 생성" 클릭** | `attempt_count: number`<br>`original_input: string` |
| `transform_reset` **(신규)** | **"처음부터 다시" 클릭** | `had_result: boolean`<br>`had_followup: boolean` |
| `output_viewed` | 결과 영역이 화면에 표시된 직후 | `scroll_depth: number`<br>`time_on_result_sec: number` |

- `transform_regenerated` — 결과가 이미 있는 상태에서 "성과 문장으로 바꾸기" 폼 버튼을 다시 눌렀을 때 발생
- `transform_rephrase` — 결과가 있는 상태에서 "다른 표현으로 생성" 클릭 시 발생 (같은 입력으로 문장 스타일만 변경)
- `followup_submitted` — "답변 합쳐서 다시 변환" 클릭 시 발생 (후속 질문 답변을 합쳐서 변환 요청을 보낼 때)

---

## 3단계 — 후속 질문 (신규 섹션)

| 이벤트 | 발생 시점 | 프로퍼티 |
|---|---|---|
| `followup_submitted` **(신규)** | **"답변 합쳐서 다시 변환" 클릭** | `question_count: number`<br>`answered_count: number`<br>`has_numeric_answer: boolean`<br>`input_text: string` |

- `question_count` — needs_info 응답에 포함된 전체 질문(item) 개수
- `answered_count` — 사용자가 실제로 입력한 답변 개수
- `has_numeric_answer` — 답변 중 하나라도 숫자가 포함됐는지 (`/\d/` 매칭)
- `input_text` — API에 전달되는 최종 합산 텍스트 (원본 입력 + 질문별 답변을 포맷팅한 문자열. 예: `"회의록 정리\n목표: 업무 누락 방지\n결과: 후속 업무 빠르게 시작"`)

---

## 4단계 — 저장 / 복사

| 이벤트 | 발생 시점 | 프로퍼티 |
|---|---|---|
| `copy_clicked` (확장) | 결과 카드 우측 상단 복사 아이콘 클릭 | `logged_in: boolean`<br>`copy_target: 'card_icon' \| 'full' \| 'partial'`<br>`has_followup_answer: boolean` |
| `save_clicked` **(이름 변경: `save_attempted` → `save_clicked`)** | 저장 버튼 클릭 (로그인 모달 띄우는 케이스 포함) | `logged_in: boolean`<br>`has_followup_answer: boolean`<br>`sentence_length: number` |
| `save_completed` | DB 저장 성공 시 | (없음) |
| `login_prompted` | 비로그인 상태에서 저장/기록함 클릭으로 모달 노출 | `trigger: 'save_click' \| 'history_click'`<br>`provider: 'google'` |
| `toast_cta_clicked` | 토스트의 CTA(기록함 바로가기) 클릭 | `target: string` |

- `copy_target` — 현재 홈에서는 `'card_icon'` 으로 고정. `'full' / 'partial'`은 향후 확장(전체 vs 일부 선택 복사)을 위한 예약 값.
- `has_followup_answer` — 현재 결과가 needs_info 답변 흐름을 거쳐 생성됐는지. `Result.fromFollowup` 값에서 가져옴.
- `sentence_length` — 저장 대상 성과 문장 글자 수.

---

## Super Properties (모든 이벤트 자동 첨부)

[`lib/mixpanel.ts`](../lib/mixpanel.ts)의 `initMixpanel()` 에서 `mixpanel.register()` 로 등록.
세션 시작 시 자동 첨부되며 이벤트별로 따로 보낼 필요 없음.

| 프로퍼티 | 타입 | 설명 |
|---|---|---|
| `session_id` | string | sessionStorage 기반 세션 ID (`Date.now()-random`) |
| `logged_in` | boolean | Supabase 로그인 여부 |
| `platform` | `'web'` | 플랫폼 고정 |
| `day_of_week` | number | 0(일) ~ 6(토) |
| `hour_of_day` | number | 0 ~ 23 |
| `is_first_session` | boolean | localStorage `_fv` 키 부재 시 true (최초 방문) |
| `user_id` | string? | 로그인된 경우에만 첨부 |

---

## 변경 이력

- 2026-05-18 — `transform_rephrase`, `transform_reset`, `followup_submitted` 신규.
  `save_attempted` → `save_clicked` 이름 변경 + `has_followup_answer / sentence_length` 추가.
  `copy_clicked` 에 `has_followup_answer` 추가, `copy_target` 옵션에 `'card_icon'` 명시.
- 2026-05-18 — `transform_regenerated` / `transform_rephrase` 구분 주석 추가.
  `followup_submitted.input_text` 설명 구체화.
- 2026-05-18 — `transform_regenerated` 발생 시점을 실제 코드 동작에 맞게 보정.
  구분 주석에 `followup_submitted` 항목 추가.
