'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createBrowserSupabase, type Entry } from '@/lib/supabase/client'

type Status = 'loading' | 'unauthed' | 'loaded' | 'error'

export default function HistoryPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    const supabase = createBrowserSupabase()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      setUser(u)
      if (!u) {
        setStatus('unauthed')
        return
      }
      void loadEntries()
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) void loadEntries()
      else setStatus('unauthed')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function loadEntries() {
    try {
      const res = await fetch('/api/entries')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '불러오기 실패')
      setEntries(data.entries as Entry[])
      setStatus('loaded')
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function onDelete(id: string) {
    if (!confirm('이 기록을 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-10 flex justify-center pt-6 pb-2">
        <div className="pill px-2 py-1 text-sm font-medium text-mono-700 flex items-center gap-1">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-full hover:bg-mono-100 transition-colors text-mono-700 flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            홈
          </Link>
          <span className="px-3 py-1.5">저장 기록</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 pt-12 pb-24">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-mono-900 mb-2">
          저장 기록
        </h1>
        <p className="text-sm text-mono-400 mb-10">
          {user
            ? `${user.user_metadata?.name ?? user.email ?? ''} 님의 기록입니다.`
            : '저장한 기록은 로그인 후 확인할 수 있습니다.'}
        </p>

        {error && status === 'error' && (
          <div className="glass p-4 mb-6 text-sm text-mono-700">{error}</div>
        )}

        {status === 'loading' && (
          <p className="text-sm text-mono-400">불러오는 중…</p>
        )}

        {status === 'unauthed' && (
          <div className="glass-strong p-10 text-center">
            <p className="text-base text-mono-700 mb-6">
              저장한 변환 결과는 로그인 후 확인할 수 있습니다.
            </p>
            <Link
              href="/login?next=/history"
              className="inline-block px-5 py-2.5 rounded-full bg-mono-900 text-mono-50 text-sm font-medium hover:bg-mono-700 transition-colors"
            >
              Google 로 로그인
            </Link>
          </div>
        )}

        {status === 'loaded' && entries.length === 0 && (
          <div className="glass p-10 text-center">
            <p className="text-sm text-mono-400">
              저장된 기록이 아직 없습니다.{' '}
              <Link href="/" className="text-mono-900 underline">
                홈으로 가서
              </Link>{' '}
              첫 변환을 만들어보세요.
            </p>
          </div>
        )}

        {status === 'loaded' && entries.length > 0 && (
          <ul className="space-y-3">
            {entries.map((entry) => {
              const open = openIds.has(entry.id)
              return (
                <li key={entry.id} className="glass overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleOpen(entry.id)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-4 px-5 sm:px-6 py-4 text-left hover:bg-white/40 transition-colors"
                  >
                    <Chevron open={open} />
                    <span className="flex-1 min-w-0 text-sm sm:text-base text-mono-900 truncate">
                      {getTitle(entry)}
                    </span>
                    <time className="shrink-0 text-xs text-mono-400 tabular-nums">
                      {formatDate(entry.created_at)}
                    </time>
                  </button>

                  {open && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 border-t border-mono-200/60">
                      <Section label="원본 기록">
                        <p className="whitespace-pre-wrap">{entry.raw_text}</p>
                      </Section>

                      {entry.metric_result && (
                        <Section label="수치 성과 문장">
                          <pre className="whitespace-pre-wrap font-sans">
                            {entry.metric_result}
                          </pre>
                        </Section>
                      )}

                      {entry.star_result && (
                        <Section label="STAR 구조">
                          <pre className="whitespace-pre-wrap font-sans">
                            {entry.star_result}
                          </pre>
                        </Section>
                      )}

                      <div className="mt-5 flex justify-end">
                        <button
                          onClick={() => onDelete(entry.id)}
                          disabled={deletingId === entry.id}
                          className="text-xs text-mono-400 hover:text-mono-900 transition-colors disabled:opacity-40"
                        >
                          {deletingId === entry.id ? '삭제 중…' : '삭제'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="text-xs font-medium uppercase tracking-wider text-mono-400 mb-2">
        {label}
      </div>
      <div className="text-sm leading-7 text-mono-900">{children}</div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-mono-400 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

function getTitle(entry: Entry): string {
  const source = entry.metric_result?.trim() || entry.raw_text.trim()
  const firstLine = source.split('\n')[0].trim()
  if (!firstLine) return '(제목 없음)'
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
