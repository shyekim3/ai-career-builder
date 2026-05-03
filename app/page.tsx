'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { initMixpanel, track } from '@/lib/mixpanel'

type Mode = 'metric' | 'star'
type SaveState = 'idle' | 'saving' | 'saved'

type Tile = {
  src: string
  top?: string
  bottom?: string
  left?: string
  right?: string
  width: string
  aspect: string
}

// 좌측 3행(상/중/하) + 우측 3행(상/중/하) + 상단 가운데 작은 1장.
// 각 타일이 서로 안 겹치도록 행끼리 y 분리, 좌우끼리 x 분리.
// 사진 톤: 캐주얼한 스타트업/코워킹 분위기.
const MOSAIC_TILES = [
  // 좌측 컬럼
  { src: 'https://images.unsplash.com/photo-1510074468346-504b4d8a8630', top: '-2%',    left: '-3%', width: '16%', aspect: '3 / 4' },
  { src: 'https://images.unsplash.com/photo-1616587226157-48e49175ee20', top: '36%',    left: '-2%', width: '11%', aspect: '1 / 1' },
  { src: 'https://images.unsplash.com/photo-1609761973820-17fe079a78dc', bottom: '12%', left: '2%',  width: '14%', aspect: '5 / 4' },
  // 상단 가운데
  { src: 'https://images.unsplash.com/photo-1456324504439-367cee3b3c32', top: '4%',     left: '24%', width: '9%',  aspect: '4 / 3' },
  // 우측 컬럼
  { src: 'https://images.unsplash.com/photo-1587554801471-37976a256db0', top: '-2%',    right: '-2%', width: '16%', aspect: '3 / 4' },
  { src: 'https://images.unsplash.com/photo-1773332598413-a6d5279d1ae8', top: '34%',    right: '-3%', width: '11%', aspect: '1 / 1' },
  { src: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643', bottom: '10%', right: '4%',  width: '13%', aspect: '4 / 5' },
] satisfies Tile[]

function BackgroundMosaic() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[110vh] overflow-hidden hidden md:block"
    >
      {MOSAIC_TILES.map((tile, i) => (
        <div
          key={i}
          className="absolute rounded-3xl overflow-hidden opacity-55 shadow-[0_8px_32px_rgba(14,14,16,0.06)]"
          style={{
            top: tile.top,
            bottom: tile.bottom,
            left: tile.left,
            right: tile.right,
            width: tile.width,
            aspectRatio: tile.aspect,
          }}
        >
          <Image
            src={`${tile.src}?w=600&q=70&auto=format`}
            alt=""
            fill
            sizes="25vw"
            className="object-cover blur-[2px] contrast-[1.0]"
          />
        </div>
      ))}
      {/* 중앙 페이드 — 헤드라인/카드 영역 보호 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_42%,_white_30%,_rgba(255,255,255,0.6)_62%,_transparent_92%)]" />
      {/* 하단 페이드 — 모자이크가 콘텐츠 영역으로 자연스럽게 사라지도록 */}
      <div className="absolute inset-x-0 bottom-0 h-[65%] bg-[linear-gradient(to_bottom,_transparent_0%,_rgba(255,255,255,0.55)_30%,_rgba(255,255,255,0.92)_65%,_white_90%)]" />
    </div>
  )
}

export default function Home() {
  const [rawText, setRawText] = useState('')
  const [metricResult, setMetricResult] = useState<string | null>(null)
  const [starResult, setStarResult] = useState<string | null>(null)
  const [loading, setLoading] = useState<Mode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [copiedKey, setCopiedKey] = useState<Mode | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const pendingSave = useRef<{ rawText: string; metricResult: string; starResult: string | null } | null>(null)
  const inputStarted = useRef(false)
  const inputStartedAt = useRef<number | null>(null)
  const transformAttempt = useRef(0)
  const transformStartedAt = useRef<number | null>(null)
  const resultAppearedAt = useRef<number | null>(null)

  // Mixpanel 초기화 — user 상태 변경 시 super props 갱신
  useEffect(() => {
    initMixpanel(user?.id)
  }, [user])

  // output_viewed — 수치 성과 결과가 처음 나타날 때
  useEffect(() => {
    if (!metricResult) return
    resultAppearedAt.current = Date.now()
    track('output_viewed', { scroll_depth: 0, time_on_result_sec: 0 })
  }, [metricResult])

  useEffect(() => {
    // 로그인 리디렉션 전에 저장했던 상태 복원
    const saved = sessionStorage.getItem('pending_save')
    if (saved) {
      try {
        const data = JSON.parse(saved) as { rawText: string; metricResult: string; starResult: string | null }
        setRawText(data.rawText ?? '')
        setMetricResult(data.metricResult ?? null)
        setStarResult(data.starResult ?? null)
        pendingSave.current = data
        sessionStorage.removeItem('pending_save')
      } catch {}
    }

    const supabase = createBrowserSupabase()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 로그인 완료 후 pending 저장 자동 실행
  useEffect(() => {
    if (!user || !pendingSave.current) return
    const data = pendingSave.current
    pendingSave.current = null
    setSaveState('saving')
    fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setSaveState('saved')
      })
      .catch((e) => {
        setSaveState('idle')
        setError((e as Error).message)
      })
  }, [user])

  async function onSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    setUser(null)
  }

  async function onCopy(key: Mode, text: string) {
    track('copy_clicked', { logged_in: !!user, copy_target: key })
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev))
      }, 1500)
    } catch {
      setError('클립보드 복사에 실패했습니다.')
    }
  }

  async function transform(mode: Mode, text: string) {
    setLoading(mode)
    setError(null)
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '요청 실패')
      return data.result as string
    } finally {
      setLoading(null)
    }
  }

  async function onTransformMetric() {
    if (!rawText.trim()) {
      setError('변환할 업무 기록을 입력해주세요.')
      return
    }
    transformAttempt.current += 1
    const isRegenerate = metricResult !== null
    track('input_submitted', {
      char_count: rawText.length,
      word_count: rawText.trim().split(/\s+/).length,
      has_numbers: /\d/.test(rawText),
    })
    if (isRegenerate) {
      track('transform_regenerated', { reason: 'retry', attempt_count: transformAttempt.current })
    } else {
      track('transform_requested', { input_length: rawText.length })
    }
    transformStartedAt.current = Date.now()
    try {
      const result = await transform('metric', rawText)
      const latency_ms = Date.now() - (transformStartedAt.current ?? Date.now())
      track('transform_completed', {
        latency_ms,
        output_length: result.length,
        star_method_used: false,
      })
      setMetricResult(result)
      setStarResult(null)
      setSaveState('idle')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function onTransformStar() {
    if (!metricResult) return
    track('transform_requested', { input_length: metricResult.length })
    transformStartedAt.current = Date.now()
    try {
      const result = await transform('star', metricResult)
      const latency_ms = Date.now() - (transformStartedAt.current ?? Date.now())
      track('transform_completed', {
        latency_ms,
        output_length: result.length,
        star_method_used: true,
      })
      setStarResult(result)
      setSaveState('idle')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function onSave() {
    if (!metricResult) return
    track('save_attempted', { logged_in: !!user })
    if (!user) {
      track('login_prompted', { trigger: 'save_click', provider: 'google' })
      sessionStorage.setItem('pending_save', JSON.stringify({ rawText, metricResult, starResult }))
      window.location.href = '/login?next=/'
      return
    }
    setSaveState('saving')
    setError(null)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, metricResult, starResult }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      track('save_completed', {})
      setSaveState('saved')
    } catch (e) {
      setSaveState('idle')
      setError((e as Error).message)
    }
  }

  const userLabel =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    null

  return (
    <div className="relative isolate flex flex-col flex-1">
      <BackgroundMosaic />
      <header className="sticky top-0 z-10 flex justify-center pt-6 pb-2">
        <div className="pill px-2 py-1 text-sm font-medium text-mono-700 flex items-center gap-1">
          <Link
            href="/history"
            className="px-3 py-1.5 rounded-full hover:bg-mono-100 transition-colors text-mono-700"
          >
            저장 기록
          </Link>
          {user ? (
            <>
              <span className="px-3 py-1.5 text-mono-400 truncate max-w-[12rem]">
                {userLabel}
              </span>
              <button
                onClick={onSignOut}
                className="px-3 py-1.5 rounded-full hover:bg-mono-100 transition-colors text-mono-700"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-full bg-mono-900 text-mono-50 hover:bg-mono-700 transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 pb-24">
        <section className="text-center pt-16 pb-14 sm:pt-24 sm:pb-20">
          <p className="text-xs sm:text-sm uppercase tracking-[0.28em] text-mono-400 mb-5 sm:mb-6">
            AI Career Builder
          </p>
          <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.1] text-mono-900">
            일상 기록을 성과로
          </h1>
          <p className="mt-6 text-base sm:text-lg text-mono-700 max-w-xl mx-auto">
            업무 기록을 수치 중심의 성과 문장으로 바꾸고,
            <br className="hidden sm:block" />
            필요할 때 STAR 기법으로 한 번 더 다듬어드립니다.
          </p>
        </section>

        <section className="grid gap-6 sm:gap-7 md:grid-cols-[1.2fr_1fr] md:auto-rows-min">
          <div className="panel-strong p-6 sm:p-7 md:row-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-mono-400 mb-3">
              업무 기록 입력
            </label>
            <textarea
              value={rawText}
              onChange={(e) => {
                const val = e.target.value
                if (!inputStarted.current && val.trim()) {
                  inputStarted.current = true
                  inputStartedAt.current = Date.now()
                  track('input_started', {
                    char_count: val.length,
                    input_type: val.length < 100 ? 'short' : 'long',
                  })
                }
                if (inputStarted.current && !val.trim()) {
                  inputStarted.current = false
                  track('input_cleared', {
                    time_spent_sec: inputStartedAt.current
                      ? Math.round((Date.now() - inputStartedAt.current) / 1000)
                      : 0,
                  })
                  inputStartedAt.current = null
                }
                setRawText(val)
              }}
              placeholder={`오늘의 업무 기록
1. 전일 매출, 전환율, ROAS 등 핵심 성과 지표 확인 및 이상 징후 파악
2. 현재 운영 중인 캠페인에서 가장 영향 큰 1~2개 요소(소재/타겟/예산) 수정
3. 커머스 페이지 또는 상세페이지 1개 개선 (배너, 구조, 카피 중 한 가지 집중)
4. 디자이너, MD, 에이전시와 협업 커뮤니케이션 1~2건 진행
5. 경쟁사 및 트렌드 빠르게 체크하여 참고 인사이트 확보
6. 오늘 실행한 작업 결과 및 인사이트 간단히 정리 (리포트 작성)`}
              className="w-full h-64 sm:h-80 resize-none bg-transparent text-base leading-7 text-mono-900 placeholder-mono-400 outline-none"
            />
            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="text-xs text-mono-400">
                {rawText.length} / 5000
              </span>
              <button
                onClick={onTransformMetric}
                disabled={loading !== null}
                className="px-5 py-2.5 rounded-full bg-mono-900 text-mono-50 text-sm font-medium hover:bg-mono-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading === 'metric' ? '변환 중…' : '성과 변환'}
              </button>
            </div>
            {error && (
              <p className="mt-4 text-sm text-mono-700 bg-mono-100 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}
          </div>

          <div className="panel p-6 sm:p-7 min-h-[14rem]">
            <div className="flex items-center justify-between mb-3 gap-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-mono-400">
                수치 성과 문장
              </label>
              {metricResult && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => onCopy('metric', metricResult)}
                    className="px-3.5 py-1.5 rounded-full bg-white/70 border border-mono-200 text-xs font-medium text-mono-900 hover:bg-white transition-colors"
                  >
                    {copiedKey === 'metric' ? '복사됨 ✓' : '복사'}
                  </button>
                  <button
                    onClick={onTransformStar}
                    disabled={loading !== null}
                    className="px-3.5 py-1.5 rounded-full bg-white/70 border border-mono-200 text-xs font-medium text-mono-900 hover:bg-white transition-colors disabled:opacity-40"
                  >
                    {loading === 'star' ? 'STAR 정리 중…' : 'STAR 기법으로 교정'}
                  </button>
                  <button
                    onClick={onSave}
                    disabled={saveState === 'saving'}
                    className="px-3.5 py-1.5 rounded-full bg-mono-900 text-mono-50 text-xs font-medium hover:bg-mono-700 transition-colors disabled:opacity-40"
                  >
                    {saveState === 'saving'
                      ? '저장 중…'
                      : saveState === 'saved'
                      ? '저장됨 ✓'
                      : user
                      ? '저장'
                      : '로그인 후 저장'}
                  </button>
                </div>
              )}
            </div>
            {metricResult ? (
              <pre className="whitespace-pre-wrap text-sm leading-7 text-mono-900 font-sans">
                {metricResult}
              </pre>
            ) : (
              <p className="text-sm text-mono-400">
                왼쪽에 업무 기록을 입력하고 변환 버튼을 누르면 결과가 여기에 표시됩니다.
              </p>
            )}
          </div>

          <div className="panel p-6 sm:p-7 min-h-[14rem]">
            <div className="flex items-center justify-between mb-3 gap-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-mono-400">
                STAR 구조 결과
              </label>
              {starResult && (
                <button
                  onClick={() => onCopy('star', starResult)}
                  className="px-3.5 py-1.5 rounded-full bg-white/70 border border-mono-200 text-xs font-medium text-mono-900 hover:bg-white transition-colors"
                >
                  {copiedKey === 'star' ? '복사됨 ✓' : '복사'}
                </button>
              )}
            </div>
            {starResult ? (
              <pre className="whitespace-pre-wrap text-sm leading-7 text-mono-900 font-sans">
                {starResult}
              </pre>
            ) : (
              <p className="text-sm text-mono-400">
                수치 성과 문장이 만들어진 뒤 ‘STAR 기법으로 교정’ 버튼을 누르면 4단 구조로 정리해드립니다.
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-mono-200/60 mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-mono-400">
          <span>AI Career Builder</span>
          <span>Powered by OpenRouter</span>
        </div>
      </footer>
    </div>
  )
}
