'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { initMixpanel, track } from '@/lib/mixpanel'

type FollowupQuestion = { topic: string; items: string[] }
type Result = { sentence: string; chips: string[]; ts: string; original: string }
type NeedsInfo = { questions: FollowupQuestion[]; original: string }
type SaveState = 'idle' | 'saving' | 'saved'
type PendingAfter = 'save' | 'history' | null

type TransformResponse =
  | { type: 'result'; sentence: string; chips: string[] }
  | { type: 'needs_info'; questions: FollowupQuestion[] }
  | { error: string }

function formatMonthDay(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function answerKey(qi: number, ii: number) {
  return `${qi}-${ii}`
}

// "질문? (예: ...)" 형태에서 끝의 괄호 부분만 분리해 작게 표시.
function splitQuestion(text: string): { main: string; example: string | null } {
  const m = text.match(/^(.*?)\s*(\([^)]*\))\s*$/)
  return m
    ? { main: m[1].trim(), example: m[2].trim() }
    : { main: text.trim(), example: null }
}

export default function Home() {
  const [rawText, setRawText] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [needsInfo, setNeedsInfo] = useState<NeedsInfo | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [pendingAfter, setPendingAfter] = useState<PendingAfter>(null)
  const [oauthBusy, setOauthBusy] = useState(false)
  const [toastMsg, setToastMsg] = useState('저장되었습니다')
  const [toastVisible, setToastVisible] = useState(false)
  const [toastCta, setToastCta] = useState<{ label: string; href: string } | null>(null)
  const [navScrolled, setNavScrolled] = useState(false)

  const pendingSave = useRef<{
    rawText: string
    metricResult: string
    chips: string[]
  } | null>(null)
  const inputStarted = useRef(false)
  const inputStartedAt = useRef<number | null>(null)
  const transformAttempt = useRef(0)
  const transformStartedAt = useRef<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    initMixpanel(user?.id)
  }, [user])

  useEffect(() => {
    if (!result) return
    track('output_viewed', { scroll_depth: 0, time_on_result_sec: 0 })
  }, [result])

  // textarea 입력 분량에 따라 자동으로 높이 늘림 (1줄 ~ 제한 없음).
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [rawText])

  // 스크롤 50vh 이상이면 nav 에 scrolled 상태(글래스 배경) 활성화.
  useEffect(() => {
    function onScroll() {
      setNavScrolled(window.scrollY > window.innerHeight * 0.5)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 각 섹션 헤드 + 카드들이 viewport 에 들어오면 in-view 클래스 토글 (fade-up 트리거).
  useEffect(() => {
    const targets = document.querySelectorAll(
      '.cb-landing--snap .section-head, ' +
      '.cb-landing--snap .closing .cb-container, ' +
      '.cb-landing--snap .problem-card, ' +
      '.cb-landing--snap .feature-card'
    )
    if (!targets.length) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    )
    targets.forEach((t) => io.observe(t))
    return () => io.disconnect()
  }, [])


  // 로그인 후 복귀 시 pending_save 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('pending_save')
    if (saved) {
      try {
        const data = JSON.parse(saved) as {
          rawText: string
          metricResult: string
          chips?: string[]
        }
        setRawText(data.rawText ?? '')
        if (data.metricResult) {
          setResult({
            sentence: data.metricResult,
            chips: data.chips ?? [],
            ts: new Date().toISOString(),
            original: data.rawText ?? '',
          })
        }
        pendingSave.current = {
          rawText: data.rawText,
          metricResult: data.metricResult,
          chips: data.chips ?? [],
        }
        sessionStorage.removeItem('pending_save')
      } catch {}
    }

    const supabase = createBrowserSupabase()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 로그인 후 자동 저장
  useEffect(() => {
    if (!user || !pendingSave.current) return
    const data = pendingSave.current
    pendingSave.current = null
    setSaveState('saving')
    fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: data.rawText,
        metricResult: data.metricResult,
        starResult: null,
        chips: data.chips,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        track('save_completed', {})
        setSaveState('saved')
        showToast('저장이 완료되었습니다', {
          label: '커리어 기록함 바로가기',
          href: '/history',
        })
      })
      .catch((e) => {
        setSaveState('idle')
        setError((e as Error).message)
      })
  }, [user])

  function showToast(
    msg: string,
    cta: { label: string; href: string } | null = null
  ) {
    setToastMsg(msg)
    setToastCta(cta)
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000)
  }

  function clearOutputs() {
    setResult(null)
    setNeedsInfo(null)
    setAnswers({})
    setSaveState('idle')
  }

  function onInputChange(val: string) {
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
    if (!val.trim() && (result || needsInfo)) clearOutputs()
  }

  async function runTransform(textForApi: string, originalForRecord: string) {
    setLoading(true)
    setError(null)
    transformStartedAt.current = Date.now()
    try {
      const res = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'metric', text: textForApi }),
      })
      const data = (await res.json()) as TransformResponse
      if (!res.ok || 'error' in data) {
        throw new Error(('error' in data && data.error) || '요청 실패')
      }
      const latency_ms = Date.now() - (transformStartedAt.current ?? Date.now())
      if (data.type === 'needs_info') {
        track('transform_needs_info', { latency_ms })
        setNeedsInfo({ questions: data.questions, original: originalForRecord })
        setResult(null)
        setAnswers({})
      } else {
        track('transform_completed', {
          latency_ms,
          output_length: data.sentence.length,
          star_method_used: false,
        })
        setResult({
          sentence: data.sentence,
          chips: data.chips,
          ts: new Date().toISOString(),
          original: originalForRecord,
        })
        setNeedsInfo(null)
        setSaveState('idle')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function onTransform(e?: FormEvent) {
    e?.preventDefault()
    const text = rawText.trim()
    if (!text) {
      setError('변환할 업무 기록을 입력해주세요.')
      return
    }
    setError(null)
    transformAttempt.current += 1
    const isRegenerate = result !== null
    track('input_submitted', {
      char_count: text.length,
      word_count: text.split(/\s+/).length,
      has_numbers: /\d/.test(text),
    })
    if (isRegenerate) {
      track('transform_regenerated', {
        reason: 'retry',
        attempt_count: transformAttempt.current,
      })
    } else {
      track('transform_requested', { input_length: text.length })
    }
    await runTransform(text, text)
  }

  async function onRetryWithAnswers() {
    if (!needsInfo) return
    const lines: string[] = [needsInfo.original]
    let answered = 0
    needsInfo.questions.forEach((q, qi) => {
      const blockLines: string[] = []
      q.items.forEach((item, ii) => {
        const a = (answers[answerKey(qi, ii)] ?? '').trim()
        if (a) {
          blockLines.push(`- ${item} → ${a}`)
          answered += 1
        }
      })
      if (blockLines.length) {
        lines.push(`[${q.topic}]`)
        lines.push(...blockLines)
      }
    })
    track('followup_answered', {
      questions_total: needsInfo.questions.reduce((n, q) => n + q.items.length, 0),
      questions_answered: answered,
    })
    const merged = lines.join('\n')
    await runTransform(merged, merged)
  }

  async function onCopy() {
    if (!result) return
    track('copy_clicked', { logged_in: !!user, copy_target: 'metric' })
    try {
      await navigator.clipboard.writeText(result.sentence)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = result.sentence
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('성과 문장이 복사되었습니다')
  }

  async function onSave() {
    if (!result) return
    track('save_attempted', { logged_in: !!user })
    if (!user) {
      track('login_prompted', { trigger: 'save_click', provider: 'google' })
      pendingSave.current = {
        rawText: result.original,
        metricResult: result.sentence,
        chips: result.chips,
      }
      setPendingAfter('save')
      setModalOpen(true)
      return
    }
    setSaveState('saving')
    setError(null)
    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: result.original,
          metricResult: result.sentence,
          starResult: null,
          chips: result.chips,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      track('save_completed', {})
      setSaveState('saved')
      showToast('저장이 완료되었습니다', {
        label: '커리어 기록함 바로가기',
        href: '/history',
      })
    } catch (err) {
      setSaveState('idle')
      setError((err as Error).message)
    }
  }

  function onClickHistory(e: React.MouseEvent) {
    if (!user) {
      e.preventDefault()
      track('login_prompted', { trigger: 'history_click', provider: 'google' })
      setPendingAfter('history')
      setModalOpen(true)
    }
  }

  async function onGoogleSignIn() {
    setOauthBusy(true)
    setError(null)
    try {
      if (pendingAfter === 'save' && result) {
        sessionStorage.setItem(
          'pending_save',
          JSON.stringify({
            rawText: result.original,
            metricResult: result.sentence,
            chips: result.chips,
          })
        )
      }
      const next = pendingAfter === 'history' ? '/history' : '/'
      const supabase = createBrowserSupabase()
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback },
      })
      if (oauthErr) throw oauthErr
    } catch (err) {
      setOauthBusy(false)
      setError((err as Error).message)
    }
  }

  async function onSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    setUser(null)
    showToast('로그아웃되었습니다')
  }

  function onTopCta(e: React.MouseEvent) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const userName =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    'User'
  const userInitial = userName.charAt(0).toUpperCase()

  const submitLabel = loading ? '변환 중…' : '성과 문장으로 바꾸기'

  return (
    <div className="cb-landing cb-landing--snap flex-1 flex flex-col">
      <header className={`nav ${navScrolled ? 'scrolled' : ''}`}>
        <div className="nav-inner">
          <a href="#top" className="brand" aria-label="Career Builder">
            <span className="brand-name">Career Builder</span>
          </a>
          <nav className="nav-links" aria-label="Main">
            <Link href="/history" onClick={onClickHistory}>
              커리어 기록함
            </Link>
            {user ? (
              <span className="nav-avatar show">
                <span className="av">{userInitial}</span>
                <span>{userName}</span>
                <button type="button" className="logout" onClick={onSignOut}>
                  로그아웃
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="nav-cta"
                onClick={() => {
                  setPendingAfter(null)
                  setModalOpen(true)
                }}
              >
                Login
              </button>
            )}
          </nav>
        </div>
      </header>

      <main id="top" className="flex-1">
        <section className="hero" id="hero">
          <video
            className="hero-video"
            src="/typing.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="hero-grid">
            <div className="hero-copy">
              <h1 style={{ fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 800 }}>
                오늘 한 일을,
                <br />
                내일의 <span className="accent">커리어 문장</span>으로.
              </h1>
              <p className="hero-sub lede" style={{ maxWidth: 500 }}>
                입력은 최대한 가볍게도 해도 좋아요. AI가 성과 중심 문장으로 바꾸고,
                역량별 커리어 자산으로 차곡차곡 쌓아드립니다.
              </p>
            </div>

            <div className="cta-card">
              <div className="cta-input-block">
                <div className="cta-input-label">지금 바로 시작해보기</div>
                <div className="cta-input-question">오늘 어떤 일을 했나요?</div>
                <div className="cta-input-helper">
                  완벽하게 쓰지 않아도 괜찮아요. 한 줄이면 충분합니다.
                </div>
              </div>

              {(loading || result || needsInfo || error) && (
              <div className="cta-result cb-slide-down">
                <div className="cta-result-head">
                  <div className="label">
                    {needsInfo ? '추가 정보 필요' : '성과 문장'}
                  </div>
                  <div className="meta">
                    {loading
                      ? 'AI가 정리하는 중…'
                      : result
                      ? `방금 변환됨 · ${formatMonthDay(result.ts)}`
                      : needsInfo
                      ? '몇 가지 답변이 필요해요'
                      : ''}
                  </div>
                </div>

                {loading && (
                  <div className="cta-result-loading">
                    <div className="skeleton-line" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                )}

                {!loading && result && (
                  <div className="cb-fade-in">
                    <div className="cta-result-body">
                      <p className="cta-result-sentence">{result.sentence}</p>
                      {result.chips.length > 0 && (
                        <div className="skill-chips">
                          {result.chips.map((label) => (
                            <span key={label} className="chip">
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="cta-actions">
                      <button type="button" className="cta-action-btn" onClick={onCopy}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        복사
                      </button>
                      <button
                        type="button"
                        className="cta-action-btn primary"
                        disabled={saveState === 'saving' || saveState === 'saved'}
                        onClick={onSave}
                      >
                        {saveState === 'saving' ? (
                          <>
                            <span className="cb-spinner" aria-hidden />
                            저장 중…
                          </>
                        ) : saveState === 'saved' ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                            저장됨
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                              <polyline points="17 21 17 13 7 13 7 21" />
                              <polyline points="7 3 7 8 15 8" />
                            </svg>
                            저장
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="cta-action-btn"
                        onClick={() => onTransform()}
                        disabled={loading || !rawText.trim()}
                        title="현재 입력 내용으로 다시 변환"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        다시 생성
                      </button>
                    </div>
                  </div>
                )}

                {!loading && needsInfo && (
                  <div className="cb-fade-in">
                    <div className="cta-followup-card">
                      <div className="cta-followup-intro">
                        몇 가지 정보를 더 알려주시면 더 정확한 성과 문장으로 정리해드릴 수 있어요.
                        모르는 항목은 비워두셔도 됩니다.
                      </div>
                      {needsInfo.questions.map((q, qi) => (
                        <div key={`${q.topic}-${qi}`} className="cta-followup-block">
                          <div className="cta-followup-topic">{q.topic}</div>
                          {q.items.map((item, ii) => {
                            const k = answerKey(qi, ii)
                            const { main, example } = splitQuestion(item)
                            return (
                              <div key={k} className="cta-followup-row">
                                <label className="cta-followup-q" htmlFor={`fu-${k}`}>
                                  {main}
                                  {example && (
                                    <span className="cta-followup-q-example">
                                      {example}
                                    </span>
                                  )}
                                </label>
                                <input
                                  id={`fu-${k}`}
                                  className="cta-followup-a"
                                  type="text"
                                  value={answers[k] ?? ''}
                                  onChange={(e) =>
                                    setAnswers((prev) => ({ ...prev, [k]: e.target.value }))
                                  }
                                  placeholder="답변 입력"
                                  autoComplete="off"
                                />
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <div className="cta-actions">
                      <button
                        type="button"
                        className="cta-action-btn primary"
                        onClick={onRetryWithAnswers}
                        disabled={loading}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        답변 합쳐서 다시 변환
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-700)', background: 'var(--ink-100)', padding: '8px 12px', borderRadius: 10 }}>
                    {error}
                  </p>
                )}
              </div>
              )}

              <form className="cta-input-row" onSubmit={onTransform}>
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="예: 회의록 정리하고 수정사항 팀에 공유함"
                  autoComplete="off"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void onTransform()
                    }
                  }}
                />
                <div className="cta-input-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {submitLabel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="problem" id="problem">
          <div className="cb-container">
            <div className="section-head">
              <h2>
                열심히 일했는데,
                <br />
                막상 쓸 말이 없었던 적 있나요?
              </h2>
              <p className="lede" style={{ maxWidth: 550 }}>
                매일 분명히 일은 했지만, 이력서를 쓰려고 하면 빈 페이지를 마주하게 됩니다.
                아래 네 가지 순간이 반복된다면 Career Builder가 필요해요.
              </p>
            </div>

            <div className="problem-grid">
              <article className="problem-card">
                <div className="problem-mock pm-memory" aria-hidden>
                  <div className="pm-note">
                    <span className="pm-note-date">5월 6일</span>
                    <span className="pm-note-line accent" />
                    <span className="pm-note-line" />
                  </div>
                  <div className="pm-note pm-fade-1">
                    <span className="pm-note-date">3월 12일</span>
                    <span className="pm-note-line" />
                    <span className="pm-note-line short" />
                  </div>
                  <div className="pm-note pm-fade-2">
                    <span className="pm-note-date">1월 4일</span>
                    <span className="pm-note-line" />
                  </div>
                  <span className="pm-mark">?</span>
                </div>
                <span className="problem-num">Problem 01</span>
                <h3 className="problem-title">기억이 나지 않아요</h3>
                <p className="problem-desc">
                  이직이나 지원 시점이 되어서야 “내가 그동안 뭘 했지?”를 다시 떠올리려 합니다.
                  대부분의 작은 성과들은 이미 흩어진 뒤죠.
                </p>
              </article>

              <article className="problem-card">
                <div className="problem-mock pm-metric" aria-hidden>
                  <div className="pm-row">
                    <span className="pm-row-label">오늘 한 일</span>
                    <div className="pm-row-body">
                      <span className="pm-row-text">회의했음</span>
                    </div>
                  </div>
                  <div className="pm-row pm-row-out">
                    <span className="pm-row-label">성과</span>
                    <div className="pm-row-body pm-row-body-blank">
                      <span className="pm-blank-line" />
                      <span className="pm-blank-line short" />
                    </div>
                  </div>
                  <span className="pm-mark">?</span>
                </div>
                <span className="problem-num">Problem 02</span>
                <h3 className="problem-title">수치화가 어려워요</h3>
                <p className="problem-desc">
                  업무를 ‘성과’와 ‘지표’ 중심으로 표현하는 일은 생각보다 어렵습니다.
                  “회의했음” 한 줄을 어떻게 임팩트 있게 적어야 할지 막막합니다.
                </p>
              </article>

              <article className="problem-card">
                <div className="problem-mock pm-pile" aria-hidden>
                  <div className="pm-cal">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const filled = i === 4
                      const accent = i === 4
                      return (
                        <span
                          key={i}
                          className={`pm-cal-cell ${filled ? 'filled' : ''} ${accent ? 'accent' : ''}`}
                        />
                      )
                    })}
                  </div>
                  <div className="pm-cal-caption">기록한 날 1 · 안 한 날 27</div>
                </div>
                <span className="problem-num">Problem 03</span>
                <h3 className="problem-title">정리가 매일 밀려요</h3>
                <p className="problem-desc">
                  하루가 끝나면 피곤해서 기록을 미루게 되고, 며칠 후에는 무엇을 적어야 할지조차 잊어버립니다.
                  기록의 부담이 결국 기록을 포기하게 만듭니다.
                </p>
              </article>

              <article className="problem-card">
                <div className="problem-mock pm-tags" aria-hidden>
                  <span className="pm-tag pm-tag-1">협업?</span>
                  <span className="pm-tag pm-tag-2 accent">문제 해결?</span>
                  <span className="pm-tag pm-tag-3">리서치?</span>
                  <span className="pm-tag pm-tag-4">커뮤니케이션?</span>
                  <span className="pm-tag pm-tag-5">···</span>
                </div>
                <span className="problem-num">Problem 04</span>
                <h3 className="problem-title">역량 연결이 안 돼요</h3>
                <p className="problem-desc">
                  오늘 한 일이 어떤 커리어 강점으로 이어지는지 알기 어렵습니다.
                  정리되지 않은 기록은 ‘나의 역량 지도’가 되지 못한 채 흩어집니다.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="solution" id="solution">
          <div className="cb-container">
            <div className="section-head center">
              <h2>
                한 줄만 적으면,
                <br />
                AI가 성과 문장으로 정리합니다.
              </h2>
              <p className="lede" style={{ maxWidth: 550 }}>
                가볍게 입력한 한 줄을 핵심 행동 · 연결 역량 · 성과 지표로 분해하고,
                이력서와 자기소개서에 그대로 쓸 수 있는 문장으로 다듬어드립니다.
              </p>
            </div>

            <div className="solution-stage">
              <div className="solution-grid">
                <div>
                  <div className="step-label">
                    <span className="step-num">01</span>
                    오늘의 한 줄
                  </div>
                  <div className="before-card" style={{ marginTop: 14 }}>
                    <p className="before-text">회의록 정리하고 수정사항 팀에 공유함</p>
                    <div className="before-meta">
                      <span>5월 6일 · 6:42 PM</span>
                      <span className="typed-len">21자</span>
                    </div>
                  </div>
                </div>

                <div className="transform-mark" aria-hidden>
                  <span className="tm-track tm-track-start">
                    <span className="tm-dot" />
                  </span>
                  <span className="ai-pill">AI 변환</span>
                  <span className="tm-track tm-track-end">
                    <span className="tm-dot" />
                  </span>
                </div>

                <div>
                  <div className="step-label">
                    <span className="step-num">02</span>
                    성과 문장 + 연결 역량
                  </div>
                  <div className="after-card" style={{ marginTop: 14 }}>
                    <p className="after-text">
                      디자인 리뷰 회의의 주요 피드백과 수정사항을 정리해 팀에 공유함으로써,
                      <span className="hl"> 후속 작업의 기준을 명확히 하고 </span>
                      협업 커뮤니케이션 효율을 높였습니다.
                    </p>
                    <div className="after-meta" aria-label="연결된 역량">
                      <span className="chip">협업 커뮤니케이션</span>
                      <span className="chip">문서화</span>
                      <span className="chip">문제 정의</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="followup">
                <div className="followup-title">
                  더 구체적인 성과 문장으로 만들기 위한 질문
                </div>
                <div className="followup-list">
                  <div className="fu-bubble">
                    <span className="fu-mark" aria-hidden>Q1</span>
                    <span className="fu-q">정리한 피드백은 몇 건이었나요?</span>
                  </div>
                  <div className="fu-bubble">
                    <span className="fu-mark" aria-hidden>Q2</span>
                    <span className="fu-q">공유 이후 어떤 액션 아이템이 결정되었나요?</span>
                  </div>
                  <div className="fu-bubble">
                    <span className="fu-mark" aria-hidden>Q3</span>
                    <span className="fu-q">후속 작업 시간이 이전보다 얼마나 단축되었나요?</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="features" id="feature">
          <div className="cb-container">
            <div className="section-head">
              <h2>
                기록할수록,
                <br />
                나의 역량 지도가 확장됩니다.
              </h2>
              <p className="lede" style={{ maxWidth: 550 }}>
                입력은 가볍게, 결과는 전문적으로. Career Builder의 다섯 가지 핵심 기능이
                매일의 작은 업무를 커리어 자산으로 바꿔드립니다.
              </p>
            </div>

            <div className="feature-grid">
              <article className="feature-card span-3">
                <span className="feature-tag">Feature 01</span>
                <h3 className="feature-title">한 줄 업무 기록</h3>
                <p className="feature-desc">
                  완벽한 문장이 아니어도 괜찮아요. 회의·수정·조사·공유처럼 떠오르는 대로
                  짧게 적기만 하면 시작됩니다.
                </p>
                <div className="feature-visual">
                  <div className="fv-input" style={{ marginBottom: 8 }}>
                    <span className="icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                    경쟁사 UX 조사해서 팀에 공유함
                  </div>
                  <div className="fv-input">
                    <span className="icon">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </span>
                    피그마 컴포넌트 정리하고 개발자에게 전달함
                    <span className="cursor" />
                  </div>
                </div>
              </article>

              <article className="feature-card span-3">
                <span className="feature-tag">Feature 02</span>
                <h3 className="feature-title">AI 성과 변환</h3>
                <p className="feature-desc">
                  경력기술서·자기소개서·포트폴리오에 그대로 쓸 수 있는 성과 중심 문장으로 바꿔드립니다.
                  과장 없이, 더 정확하게.
                </p>
                <div className="feature-visual">
                  <div className="fv-convert">
                    <div className="row">원본 기록</div>
                    <div className="src">디자인 시안 수정함</div>
                    <div className="arrow">↓</div>
                    <div className="row">성과 문장</div>
                    <div className="dst">
                      디자인 피드백을 반영해 화면 시안을 개선하고, 후속 검토를 위한 UI 완성도를 높였습니다.
                    </div>
                  </div>
                </div>
              </article>

              <article className="feature-card span-2">
                <span className="feature-tag">Feature 03</span>
                <h3 className="feature-title">성과 보강 질문</h3>
                <p className="feature-desc">수치화에 필요한 질문을 AI가 먼저 제안해드려요.</p>
                <div className="feature-visual">
                  <div className="fv-question">
                    <div className="q">몇 건의 피드백을 정리했나요?</div>
                    <div className="num-input">
                      <strong>12건</strong> · 입력됨
                    </div>
                  </div>
                </div>
              </article>

              <article className="feature-card span-2">
                <span className="feature-tag">Feature 04</span>
                <h3 className="feature-title">역량 태그 자동 분류</h3>
                <p className="feature-desc">협업·리서치·문제 해결 등 역량별로 자동 태깅됩니다.</p>
                <div className="feature-visual">
                  <div className="fv-skills">
                    <span className="chip">협업 커뮤니케이션</span>
                    <span className="chip">리서치</span>
                    <span className="chip">문제 정의</span>
                    <span className="chip">데이터 분석</span>
                    <span className="chip">문서화</span>
                    <span className="chip">디자인 시스템</span>
                  </div>
                </div>
              </article>

              <article className="feature-card span-2">
                <span className="feature-tag">Feature 05</span>
                <h3 className="feature-title">커리어 기록함</h3>
                <p className="feature-desc">누적된 기록을 이력서·자소서·포트폴리오에 바로 활용하세요.</p>
                <div className="feature-visual">
                  <div className="fv-timeline">
                    <span className="date">5/6</span>
                    <div className="entry">
                      <span>피그마 컴포넌트 정리</span>
                      <span className="mini-chip">협업</span>
                    </div>
                    <span className="date">5/7</span>
                    <div className="entry">
                      <span>VOC 정리 및 우선순위</span>
                      <span className="mini-chip">리서치</span>
                    </div>
                    <span className="date">5/8</span>
                    <div className="entry">
                      <span>화면 플로우 수정</span>
                      <span className="mini-chip">UX 개선</span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="closing">
          <div className="closing-pattern" aria-hidden />
          <div className="cb-container" style={{ fontSize: 16 }}>
            <h2 style={{ fontSize: 32 }}>
              오늘의 작은 업무도,
              <br />
              미래의 <span className="accent">커리어 증거</span>가 될 수 있어요.
            </h2>
            <p className="closing-sub">
              지금 한 줄만 적어보세요. AI가 성과 문장으로 정리해드릴게요.
            </p>
            <div className="closing-cta">
              <a href="#top" className="btn btn-secondary" onClick={onTopCta}>
                첫 기록 남기기
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div>© 2026 Career Builder. 기록되지 않고 사라지는 일을 커리어 성장의 증거로 바꿉니다.</div>
        </div>
      </footer>

      <div
        className={`cb-modal-backdrop ${modalOpen ? 'show' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false)
        }}
      >
        <div className="cb-modal">
          <div className="cb-modal-logo">CB</div>
          <h3>
            커리어 기록함은
            <br />
            로그인 후 이용 가능해요
          </h3>
          <p>
            변환된 성과 문장을 안전하게 저장하고,
            <br />
            언제든 다시 꺼내볼 수 있어요.
          </p>
          <button
            type="button"
            className="cb-google-btn"
            onClick={onGoogleSignIn}
            disabled={oauthBusy}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {oauthBusy ? '이동 중…' : 'Google로 계속하기'}
          </button>
          <button type="button" className="cb-modal-close" onClick={() => setModalOpen(false)}>
            나중에 할게요
          </button>
        </div>
      </div>

      <div
        className={`cb-toast ${toastCta ? 'with-cta' : ''} ${toastVisible ? 'show' : ''}`}
        role="status"
        aria-live="polite"
        onMouseEnter={() => {
          if (toastTimer.current) clearTimeout(toastTimer.current)
        }}
        onMouseLeave={() => {
          if (!toastVisible) return
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setToastVisible(false), 1500)
        }}
      >
        <span className="cb-toast-msg">
          <span className="check">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span>{toastMsg}</span>
        </span>
        {toastCta && (
          <Link
            href={toastCta.href}
            className="cb-toast-cta"
            onClick={() => track('toast_cta_clicked', { target: toastCta.href })}
          >
            {toastCta.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  )
}
