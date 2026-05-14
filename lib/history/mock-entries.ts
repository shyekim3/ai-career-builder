import type { Entry } from '@/lib/supabase/client'

type MockSeed = {
  daysAgo: number
  raw_text: string
  metric_result: string
  chips: string[]
  project_name: string | null
}

const SEEDS: MockSeed[] = [
  {
    daysAgo: 0,
    raw_text: '디자인 QA 기준 정리하고 개발자에게 공유함',
    metric_result:
      '디자인 QA 기준 12종을 정리해 후속 개발·검토 단계의 판단 기준을 명확히 했습니다.',
    chips: ['디자인 시스템', '품질 개선', '협업 커뮤니케이션'],
    project_name: '디자인 시스템 v2',
  },
  {
    daysAgo: 1,
    raw_text: '피드백 회의 내용 정리',
    metric_result:
      '디자인 리뷰 피드백 18건을 우선순위별로 정리해 다음 스프린트 작업 범위를 합의했습니다.',
    chips: ['협업 커뮤니케이션', '문서화'],
    project_name: '온보딩 리뉴얼',
  },
  {
    daysAgo: 2,
    raw_text: '버튼 간격 수정',
    metric_result:
      '메인 CTA 영역의 간격·정렬 규칙을 8pt 그리드 기준으로 통일해 시각적 위계를 정돈했습니다.',
    chips: ['UI 디자인', '디자인 시스템'],
    project_name: '디자인 시스템 v2',
  },
  {
    daysAgo: 4,
    raw_text: '경쟁사 온보딩 조사',
    metric_result:
      '경쟁 서비스 6곳의 온보딩 플로우를 비교 분석해 자사 온보딩 개선 포인트 4가지를 도출했습니다.',
    chips: ['리서치', 'UX 개선'],
    project_name: '온보딩 리뉴얼',
  },
  {
    daysAgo: 6,
    raw_text: '프로토타입 개선',
    metric_result:
      '주요 흐름 3개의 프로토타입을 정밀화해 사용성 테스트 시 의도가 정확히 전달되도록 했습니다.',
    chips: ['UX 개선', 'UI 디자인'],
    project_name: '온보딩 리뉴얼',
  },
  {
    daysAgo: 9,
    raw_text: '개발자에게 화면 기준 공유함',
    metric_result:
      '컴포넌트 기준 문서를 작성해 개발팀과 동일한 언어로 화면 기준을 합의했습니다.',
    chips: ['문서화', '협업 커뮤니케이션', '디자인 시스템'],
    project_name: '디자인 시스템 v2',
  },
  {
    daysAgo: 12,
    raw_text: 'UI 컴포넌트 정리',
    metric_result:
      '중복 사용되던 UI 컴포넌트 9종을 통합해 디자인 시스템의 일관성을 강화했습니다.',
    chips: ['디자인 시스템', 'UI 디자인'],
    project_name: '디자인 시스템 v2',
  },
  {
    daysAgo: 15,
    raw_text: '내부 사용자 인터뷰 진행',
    metric_result:
      '내부 사용자 5명을 인터뷰해 현재 흐름의 페인 포인트 7가지를 정리했습니다.',
    chips: ['리서치', 'UX 개선'],
    project_name: '온보딩 리뉴얼',
  },
  {
    daysAgo: 19,
    raw_text: '랜딩 카피 다듬기',
    metric_result:
      '랜딩 히어로 카피를 사용자 관점 표현으로 정리해 행동 유도 명확성을 높였습니다.',
    chips: ['UX 라이팅', 'UI 디자인'],
    project_name: null,
  },
  {
    daysAgo: 24,
    raw_text: '대시보드 와이어프레임 작성',
    metric_result:
      '대시보드 핵심 지표 5종의 위계를 정리한 와이어프레임을 작성해 이해관계자와 구조를 합의했습니다.',
    chips: ['UI 디자인', '문서화'],
    project_name: '리포트 대시보드',
  },
  {
    daysAgo: 28,
    raw_text: '디자인 시스템 컬러 토큰 점검',
    metric_result:
      '디자인 시스템의 컬러 토큰 24종을 점검해 접근성 기준에 맞지 않는 3종을 보정했습니다.',
    chips: ['디자인 시스템', '품질 개선'],
    project_name: '디자인 시스템 v2',
  },
]

function toIso(daysAgo: number): string {
  const d = new Date()
  d.setHours(20 - daysAgo, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

export function buildMockEntries(): Entry[] {
  return SEEDS.map((s, i) => {
    const iso = toIso(s.daysAgo)
    return {
      id: `mock-${i + 1}`,
      created_at: iso,
      user_id: 'mock-user',
      raw_text: s.raw_text,
      metric_result: s.metric_result,
      metric_result_original: s.metric_result,
      star_result: null,
      chips: s.chips,
      project_name: s.project_name,
      entry_date: iso,
    }
  })
}
