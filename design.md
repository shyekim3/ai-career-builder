# Career Builder Design System

> 현재 배포된 [ai-career-builder-two.vercel.app](https://ai-career-builder-two.vercel.app)
> 의 실제 코드(`app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/history/page.tsx`)
> 에서 추출한 디자인 시스템.

---

## 1. 브랜드 톤

- **꼼꼼하지만 부담 없는 커리어 코치** — 사용자가 한 일을 옆에서 정리해주고 "이건 이런 역량으로 말할 수 있어요"라고 알려주는 조력자
- 화이트 페이퍼 + 잉크 그레이 + 오렌지 액센트의 조합으로 **차분한 권위감과 따뜻함을 동시에** 전달
- 큰 디스플레이 타이포보다는 **정보 위계 · 카드 단위 surface · 짧은 모션**으로 임팩트 형성

---

## 2. 색상 팔레트

### 2.1 Primary

| Token | HEX | 용도 |
|-------|-----|------|
| `--paper` | `#FFFFFF` | 카드 / 모달 / 토스트 표면 |
| `--ink-900` | `#0B0B0C` | 헤더, 제목, primary 버튼 배경 |
| `--orange` | `#FA5C40` | 브랜드 액션, CTA 강조, 토스트 CTA, 아이콘 dot |

### 2.2 Ink Neutral Scale

| Token | HEX | 용도 |
|-------|-----|------|
| `--ink-50` | `#FAFAFB` | 페이지 배경 (hero fallback 포함) |
| `--ink-100` | `#F2F2F4` | input · chip · 비활성 버튼 배경 |
| `--ink-200` | `#E6E6E9` | 보더, dashed 구분선, 헤어라인 |
| `--ink-300` | `#C9C9CE` | input border, picker border |
| `--ink-400` | `#9A9AA0` | placeholder, weekday 메타 |
| `--ink-500` | `#6B6B70` | 보조 텍스트, 메타, 라벨 |
| `--ink-700` | `#2A2A2D` | 본문, lede |
| `--ink-900` | `#0B0B0C` | 제목, 강조 텍스트 |

### 2.3 Accent

| Token | HEX | 용도 |
|-------|-----|------|
| `--orange-soft` | `#FFE4DE` | 헤드라인 highlight, 위험 버튼 hover |
| `--orange-deep` | `#8B3527` | quote 등 채도 낮은 짙은 강조 |

### 2.4 사용 원칙

- **Orange + Ink-900** 조합이 브랜드의 핵심 액션 톤
- 페이지 배경은 `--ink-50` 으로 부드럽게, 카드는 `--paper` 로 띄움
- 텍스트 위계는 ink-900 → ink-700 → ink-500 → ink-400 의 한 스케일만 사용 (별도 컬러 강조 자제)

---

## 3. 타이포그래피

### 3.1 Family

| 역할 | Stack |
|------|-------|
| **Sans** | `Pretendard`, `Poppins`, `-apple-system`, `BlinkMacSystemFont`, system-ui, `Apple SD Gothic Neo`, `Noto Sans KR`, sans-serif |
| **Mono** | `Geist Mono`, `JetBrains Mono`, `ui-monospace`, `SFMono-Regular`, Menlo, monospace |

OpenType feature `ss06`, `ss03` 항상 활성화 (Pretendard 한글 자형 보정).

### 3.2 Type Scale (현재 코드 기준)

| 역할 | Size | Weight | Letter-spacing | Line-height |
|------|------|--------|----------------|-------------|
| Hero `h1` | `clamp(32px, 6vw, 52px)` | 700 | -0.025em | 1.25 |
| Section `h2` | 44px (모바일 32px) | 700 | -0.025em | 1.25 |
| Card / Block `h3` | 20px | 600 | -0.025em | 1.25 |
| History 페이지 타이틀 | 44px | 700 | inherit | inherit |
| Lede (서브카피) | 18px | 400 | normal | 1.6 |
| Body | 14–16px | 400 | normal | 1.55–1.65 |
| Label / Eyebrow | 12–13px | 600 | 0.04–0.06em / uppercase | 1.4 |
| Caption / Meta | 11–13px | 400–500 | normal | 1.4 |
| Numeric (mono) | 20–24px | 700 | -0.02em | 1 |

---

## 4. 레이아웃 구조

### 4.1 페이지 구조 (현재 랜딩)

```
HEADER (sticky nav, glass)
HERO              풀섹션 배경 영상 + 1단 column (헤드라인 → 카드)
PROBLEM           4-card grid (열심히 일했는데 막상 쓸 말이…)
SOLUTION          before / arrow / after 3분할 데모
FEATURES          3+2+2+2 grid (5개 feature card)
CLOSING           가벼운 검정 톤 CTA 섹션
FOOTER            한 줄 카피
```

History 페이지는 GNB → 페이지 헤더 → 4분할 stats → 툴바(필터/검색/선택 내보내기) → 선택 바 → entry 카드 목록.

### 4.2 그리드 / 스페이싱

| 토큰 | 값 |
|------|-----|
| `--cb-max` | 1200px |
| `--radius-sm` / `md` / `lg` / `xl` | 8 / 12 / 16 / 24px |
| 섹션 패딩 (desktop) | 120px 32px |
| 섹션 패딩 (≤980px) | 80px 24px |
| Gutter | 14–24px |
| Card padding | 22–24px |

### 4.3 Shadows

```css
--shadow-sm: 0 1px 2px rgba(11,11,12,0.04), 0 1px 1px rgba(11,11,12,0.03);
--shadow-md: 0 4px 8px -2px rgba(11,11,12,0.06), 0 12px 24px -8px rgba(11,11,12,0.10);
--shadow-lg: 0 8px 16px -4px rgba(11,11,12,0.06), 0 24px 48px -12px rgba(11,11,12,0.14);
```

---

## 5. 컴포넌트 패턴

### 5.1 Navigation (`.nav`)
- 위치: `sticky; top: 0; z-index: 50`
- 배경: `rgba(250, 250, 251, 0.85)` + `backdrop-filter: saturate(180%) blur(12px)` (글래스)
- 높이: 약 56px, 좌우 32px 패딩

### 5.2 Hero
- `position: relative; overflow: hidden; background: #FAFAFB`
- 배경 영상 `<video autoplay muted loop playsInline>` — `object-fit: cover`, `z-index: 0`, `pointer-events: none`
- 글로우 효과: 두 개의 blur radial gradient (orange · white) — `mix-blend-mode: screen`, z-index 1, drift 애니메이션 12–15s
- 콘텐츠 `.hero-grid` — `flex column`, `z-index: 2`, gap 48, 좌측 정렬, 카드 `max-width: 640px`

### 5.3 CTA Card (`.cta-card`)
- 배경 `--paper`, `border-radius: var(--radius-xl)` (24px), shadow-lg
- 내부 padding `cta-input-block: 24px`, 결과 영역 `cta-result: 22px 24px 24px`
- 입력 form `cta-input-row` — 카드 안쪽 `margin: 18px 24px 24px`, 자체 ink-100 inner panel + radius 14
- textarea: 자동 높이 (rows=1 시작, `scrollHeight` 기준 auto-resize)
- 결과 영역: 변환 시 `cb-slide-down` 키프레임으로 펼쳐짐, 위·아래 dashed border

### 5.4 Eyebrow / Label
- 알약 형태: padding 6/12, radius 999
- 배경: `var(--ink-100)` (또는 hero 위에서는 nav와 동일한 글래스 톤)
- 폰트: 12–13px / 600 / `letter-spacing: 0.04em` / uppercase

### 5.5 Toast (`.cb-toast`)
- 위치: `position: fixed; top: 24px; left: 50%; transform: translateX(-50%)`
- 배경: `--ink-900`, 흰 텍스트, radius 999, shadow-lg
- 등장/사라짐: opacity + translateY 250ms
- 자동 사라짐 **3초**, hover 시 타이머 일시정지 (Home), History 페이지는 단순 3초
- **`.cb-toast.with-cta` variant**: 우측에 오렌지 알약 CTA 버튼 함께 표시 (예: "커리어 기록함 바로가기 →")

### 5.6 Modal (`.cb-modal`)
- `cb-modal-backdrop`: 어두운 backdrop + blur(4px)
- 카드: 흰 배경 + radius-xl + shadow-lg + 등장 시 scale 0.96 → 1
- 좁은 폭(380px), 텍스트 가운데 정렬, 로그인 모달 등에 사용

### 5.7 Filter Chip (`.filter-chip`)
- ink-100 배경 · ink-700 텍스트가 기본
- `.active` 시 ink-900 배경 + paper 텍스트
- 우측에 count pill (mono 폰트, 작은 사각형)

### 5.8 Stat Card
- 4분할 grid, 흰 배경 + shadow-sm
- 첫 카드 `.stat-card.accent` — ink-900 배경, paper 텍스트, 오렌지 delta

### 5.9 Entry Card (History 페이지)
- Grid: `28px(체크) 88px(날짜) 1fr(본문) auto(액션)`
- 선택 시 오렌지 보더로 강조 (`.entry.selected`)
- 날짜 박스 클릭 → floating date picker panel (today / 취소 / 저장)
- 본문 더블클릭 또는 우측 ✎ 아이콘 → textarea 인라인 편집 (원본으로 되돌리기 / 취소 / 저장)
- 프로젝트명 input + datalist 자동완성 + "저장" 활성/비활성 버튼

### 5.10 Buttons

| 종류 | 스타일 |
|------|--------|
| **Primary** | `--ink-900` 배경, 흰 텍스트, radius 12, hover 시 orange 전환 |
| **Ghost** | `--ink-100` 배경, ink-700 텍스트, hover 시 ink-200 |
| **Icon button** (`.icon-btn`) | 32px 사각형, ink-100 배경, ink-700 아이콘. danger variant 는 hover 시 orange-soft 배경 |
| **CTA action** (변환 카드 액션) | 작은 알약, paper 배경 + ink-700 텍스트. `.primary` variant 는 검정 배경 흰 텍스트 |

### 5.11 Feedback button (우하단 고정)
- `position: fixed; right: 24; bottom: 24`
- 검정 알약, 좌측 채팅 아이콘

---

## 6. 디자인 토큰 (재사용 가능한 CSS 변수)

```css
:root {
  /* Brand */
  --orange:        #FA5C40;
  --orange-soft:   #FFE4DE;
  --orange-deep:   #8B3527;

  /* Ink scale */
  --ink-50:  #FAFAFB;
  --ink-100: #F2F2F4;
  --ink-200: #E6E6E9;
  --ink-300: #C9C9CE;
  --ink-400: #9A9AA0;
  --ink-500: #6B6B70;
  --ink-700: #2A2A2D;
  --ink-900: #0B0B0C;
  --paper:   #FFFFFF;

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Shadow */
  --shadow-sm: 0 1px 2px rgba(11,11,12,0.04), 0 1px 1px rgba(11,11,12,0.03);
  --shadow-md: 0 4px 8px -2px rgba(11,11,12,0.06), 0 12px 24px -8px rgba(11,11,12,0.10);
  --shadow-lg: 0 8px 16px -4px rgba(11,11,12,0.06), 0 24px 48px -12px rgba(11,11,12,0.14);

  /* Type */
  --font-sans: 'Pretendard', 'Poppins', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;

  /* Layout */
  --cb-max: 1200px;
}
```

---

## 7. 모션 / 인터랙션

| 패턴 | 동작 |
|------|------|
| `cb-fade-in` | 0.45s ease — 새 콘텐츠 등장 |
| `cb-slide-down` | 0.35s ease-out — 변환 결과 영역 펼침 |
| `cb-pop` | 0.12s ease-out — dropdown 등장 |
| `cb-spinner` | 0.7s linear infinite — 저장 중 표시 |
| Hero glow drift | 12s / 15s ease-in-out alternate — 두 개 blur 원 천천히 이동 |
| Pulse dot | 1.6s — input label 옆 작은 오렌지 dot (현재 hero label 에서는 제거) |
| Toast | opacity + translateY 250ms |

`prefers-reduced-motion: reduce` 환경에서는 hero glow 애니메이션 비활성.

---

## 8. 디자인 원칙

| 원칙 | 설명 |
|------|------|
| **Calm Authority** | 큰 디스플레이 타이포보다 정보 위계와 한 톤 절제된 텍스트 색으로 임팩트 |
| **Warm Paper** | 페이지는 따뜻한 화이트(`--ink-50`), 카드는 순백(`--paper`), 오렌지로 액션만 강조 |
| **Card-first Surface** | 토스트 · 칩 · 카드 등 작은 surface 단위로 정보를 분리, 그림자로 위계 |
| **Explicit Save** | 인라인 편집(날짜 · 프로젝트명 · 변환 문장)은 자동 저장이 아니라 명시적 "저장" 버튼 — 사용자 통제감 |
| **Subtle Motion** | 짧은 fade / slide-down / pulse / drift 만 사용. 화려한 트랜지션 배제 |
| **One Hue Accent** | 액센트는 Red Orange 한 가지로 통일. 다채로운 카드 컬러 사용하지 않음 |

---
