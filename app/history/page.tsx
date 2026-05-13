'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { createBrowserSupabase, type Entry } from '@/lib/supabase/client'
import { initMixpanel, track } from '@/lib/mixpanel'

type Status = 'loading' | 'unauthed' | 'loaded' | 'error'
type ExportFormat = 'copy' | 'markdown'
const UNCATEGORIZED = '__uncategorized__'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function effectiveDate(entry: Entry) {
  return entry.entry_date ?? entry.created_at
}

function formatDateBox(iso: string) {
  const d = new Date(iso)
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mo: `${d.getMonth() + 1}월`,
    wk: `${WEEKDAYS[d.getDay()]}요일`,
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = Math.round((now - d.getTime()) / 86400000)
  if (diff <= 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function toDateInputValue(iso: string) {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromDateInputValue(yyyyMmDd: string, fallbackIso: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map((v) => parseInt(v, 10))
  if (!y || !m || !d) return fallbackIso
  const base = new Date(fallbackIso)
  base.setFullYear(y, m - 1, d)
  return base.toISOString()
}

function todayInputValue() {
  return toDateInputValue(new Date().toISOString())
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function resolveProjectLabel(entry: Entry, fallbackIndex: Map<string, number>) {
  if (entry.project_name && entry.project_name.trim()) {
    return entry.project_name.trim()
  }
  if (!fallbackIndex.has(entry.id)) {
    fallbackIndex.set(entry.id, fallbackIndex.size + 1)
  }
  return `프로젝트 ${fallbackIndex.get(entry.id)}`
}

function entryToText(entry: Entry, projectLabel: string) {
  const date = new Date(effectiveDate(entry))
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const chips = (entry.chips ?? []).join(', ') || '-'
  const sentence = entry.metric_result ?? entry.raw_text
  return [
    `날짜: ${dateStr}`,
    `프로젝트: ${projectLabel}`,
    `역량: ${chips}`,
    `성과: ${sentence}`,
    `원본: ${entry.raw_text}`,
  ].join('\n')
}

function entryToMarkdown(entry: Entry, projectLabel: string) {
  const date = new Date(effectiveDate(entry))
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const chips =
    (entry.chips ?? []).map((c) => `\`${c}\``).join(' ') || '_없음_'
  const sentence = entry.metric_result ?? entry.raw_text
  return [
    `### ${dateStr} · ${projectLabel}`,
    ``,
    `**역량 태그:** ${chips}`,
    ``,
    `> ${sentence}`,
    ``,
    `_원본:_ ${entry.raw_text}`,
  ].join('\n')
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

export default function HistoryPage() {
  const [status, setStatus] = useState<Status>('loading')
  const [entries, setEntries] = useState<Entry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [editingDateId, setEditingDateId] = useState<string | null>(null)
  const [editingDateValue, setEditingDateValue] = useState<string>('')
  const [projectDraft, setProjectDraft] = useState<Record<string, string>>({})
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null)
  const [savingDateId, setSavingDateId] = useState<string | null>(null)
  const [editingMetricId, setEditingMetricId] = useState<string | null>(null)
  const [editingMetricValue, setEditingMetricValue] = useState<string>('')
  const [savingMetricId, setSavingMetricId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exportWrapRef = useRef<HTMLDivElement | null>(null)

  const projectOptions = useMemo(() => {
    const set = new Set<string>()
    entries.forEach((e) => {
      const name = e.project_name?.trim()
      if (name) set.add(name)
    })
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [entries])

  const stats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const monthStart = (() => {
      const d = new Date()
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })()
    const thisWeek = entries.filter(
      (e) => new Date(effectiveDate(e)).getTime() >= weekAgo
    ).length
    const thisMonth = entries.filter(
      (e) => new Date(effectiveDate(e)).getTime() >= monthStart
    ).length
    const skillCount = new Map<string, number>()
    entries.forEach((e) =>
      (e.chips ?? []).forEach((c) =>
        skillCount.set(c, (skillCount.get(c) ?? 0) + 1)
      )
    )
    const sorted = [...skillCount.entries()].sort((a, b) => b[1] - a[1])
    return {
      total: entries.length,
      thisWeek,
      thisMonth,
      skillTop5: sorted.slice(0, 5),
      skillsAll: skillCount.size,
      topSkill: sorted[0]?.[0] ?? '-',
    }
  }, [entries])

  const filtered = useMemo(() => {
    let list = entries
    if (activeFilter !== 'all') {
      list = list.filter((e) => (e.chips ?? []).includes(activeFilter))
    }
    if (projectFilter !== 'all') {
      if (projectFilter === UNCATEGORIZED) {
        list = list.filter((e) => !e.project_name?.trim())
      } else {
        list = list.filter((e) => e.project_name?.trim() === projectFilter)
      }
    }
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      list = list.filter(
        (e) =>
          (e.metric_result ?? '').toLowerCase().includes(t) ||
          e.raw_text.toLowerCase().includes(t) ||
          (e.chips ?? []).some((c) => c.toLowerCase().includes(t)) ||
          (e.project_name ?? '').toLowerCase().includes(t)
      )
    }
    return list
  }, [entries, activeFilter, projectFilter, searchTerm])

  const selectedInFilteredCount = useMemo(
    () => filtered.reduce((n, e) => n + (selectedIds.has(e.id) ? 1 : 0), 0),
    [filtered, selectedIds]
  )
  const allFilteredSelected =
    filtered.length > 0 && selectedInFilteredCount === filtered.length

  function showToast(msg: string) {
    setToastMsg(msg)
    setToastVisible(true)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000)
  }

  useEffect(() => {
    initMixpanel(user?.id)
  }, [user])

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

  useEffect(() => {
    if (!exportMenuOpen) return
    function onClick(e: MouseEvent) {
      if (!exportWrapRef.current) return
      if (!exportWrapRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [exportMenuOpen])

  async function loadEntries() {
    try {
      const res = await fetch('/api/entries')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '불러오기 실패')
      const loaded = data.entries as Entry[]
      setEntries(loaded)
      setProjectDraft(
        Object.fromEntries(loaded.map((e) => [e.id, e.project_name ?? '']))
      )
      setStatus('loaded')
      const oldest = loaded.at(-1)
      track('history_viewed', {
        record_count: loaded.length,
        days_since_first_save: oldest
          ? Math.floor(
              (Date.now() - new Date(oldest.created_at).getTime()) / 86400000
            )
          : 0,
      })
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    }
  }

  async function patchEntry(
    id: string,
    body: {
      projectName?: string | null
      entryDate?: string | null
      metricResult?: string | null
    }
  ): Promise<Entry | null> {
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      const next = data.entry as Entry
      setEntries((prev) => prev.map((e) => (e.id === id ? next : e)))
      return next
    } catch (e) {
      setError((e as Error).message)
      return null
    }
  }

  function openDateEditor(entry: Entry) {
    setEditingDateId(entry.id)
    setEditingDateValue(toDateInputValue(effectiveDate(entry)))
  }

  function closeDateEditor() {
    setEditingDateId(null)
    setEditingDateValue('')
  }

  function setDateToToday() {
    setEditingDateValue(todayInputValue())
  }

  async function saveDate(entry: Entry) {
    if (!editingDateValue) return
    const nextIso = fromDateInputValue(editingDateValue, effectiveDate(entry))
    const currentIso = effectiveDate(entry)
    if (toDateInputValue(nextIso) === toDateInputValue(currentIso)) {
      closeDateEditor()
      return
    }
    setSavingDateId(entry.id)
    const updated = await patchEntry(entry.id, { entryDate: nextIso })
    setSavingDateId(null)
    if (updated) {
      track('entry_date_edited', { id: entry.id })
      showToast('날짜가 수정되었습니다')
      closeDateEditor()
    }
  }

  function openMetricEditor(entry: Entry) {
    setEditingMetricId(entry.id)
    setEditingMetricValue(entry.metric_result ?? entry.raw_text)
  }

  function closeMetricEditor() {
    setEditingMetricId(null)
    setEditingMetricValue('')
  }

  async function saveMetric(entry: Entry) {
    const next = editingMetricValue.trim()
    if (!next) return
    const current = (entry.metric_result ?? '').trim()
    if (next === current) {
      closeMetricEditor()
      return
    }
    setSavingMetricId(entry.id)
    const updated = await patchEntry(entry.id, { metricResult: next })
    setSavingMetricId(null)
    if (updated) {
      track('entry_metric_edited', { id: entry.id })
      showToast('수정 내용이 저장되었습니다')
      closeMetricEditor()
    }
  }

  async function revertMetric(entry: Entry) {
    const original = entry.metric_result_original?.trim()
    if (!original) {
      showToast('되돌릴 원본 문장이 없습니다')
      return
    }
    const current = (entry.metric_result ?? '').trim()
    if (original === current && editingMetricValue.trim() === original) {
      closeMetricEditor()
      return
    }
    setSavingMetricId(entry.id)
    const updated = await patchEntry(entry.id, { metricResult: original })
    setSavingMetricId(null)
    if (updated) {
      track('entry_metric_reverted', { id: entry.id })
      showToast('AI 원본 문장으로 되돌렸습니다')
      closeMetricEditor()
    }
  }

  function onProjectDraftChange(id: string, val: string) {
    setProjectDraft((prev) => ({ ...prev, [id]: val }))
  }

  async function commitProject(entry: Entry) {
    const draft = (projectDraft[entry.id] ?? '').trim()
    const current = (entry.project_name ?? '').trim()
    if (draft === current) return
    setSavingProjectId(entry.id)
    const updated = await patchEntry(entry.id, { projectName: draft || null })
    setSavingProjectId(null)
    if (updated) {
      track('entry_project_updated', { id: entry.id, has_value: !!draft })
      showToast(
        draft
          ? `프로젝트가 "${draft}"(으)로 설정되었습니다`
          : '프로젝트가 비워졌습니다'
      )
    }
  }

  async function onCopy(entry: Entry) {
    const text = entry.metric_result ?? entry.raw_text
    track('copy_clicked', { logged_in: !!user, copy_target: 'history_entry' })
    await copyToClipboard(text)
    showToast('성과 문장이 복사되었습니다')
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev)
        filtered.forEach((e) => next.delete(e.id))
        return next
      }
      const next = new Set(prev)
      filtered.forEach((e) => next.add(e.id))
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function onExportSelected(format: ExportFormat) {
    const list = filtered.filter((e) => selectedIds.has(e.id))
    if (list.length === 0) return
    const fallback = new Map<string, number>()
    if (format === 'copy') {
      const text = list
        .map((e) => entryToText(e, resolveProjectLabel(e, fallback)))
        .join('\n\n---\n\n')
      await copyToClipboard(text)
      showToast(`${list.length}건이 한 번에 복사되었습니다`)
    } else {
      const md = [
        `# 커리어 기록함 내보내기`,
        ``,
        `_${list.length}건 · ${new Date().toLocaleDateString('ko-KR')}_`,
        ``,
        ...list.map((e) =>
          entryToMarkdown(e, resolveProjectLabel(e, fallback))
        ),
      ].join('\n\n')
      const today = todayInputValue()
      downloadBlob(`career-export-${today}.md`, md, 'text/markdown;charset=utf-8')
      showToast(`${list.length}건을 한 파일로 내려받았습니다`)
    }
    track('history_exported', { format, count: list.length, mode: 'selected' })
    setExportMenuOpen(false)
  }

  async function onDelete(id: string) {
    if (!confirm('이 기록을 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      showToast('기록이 삭제되었습니다')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setDeletingId(null)
    }
  }

  async function onSignOut() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signOut()
    setUser(null)
    setStatus('unauthed')
  }

  const userName =
    user?.user_metadata?.name ??
    user?.user_metadata?.full_name ??
    user?.email ??
    'User'
  const userInitial = userName.charAt(0).toUpperCase()
  const lastSaved = entries[0] ? formatRelative(entries[0].created_at) : '-'
  const datalistId = 'history-project-names'
  const selectedTotal = selectedIds.size

  return (
    <div className="cb-landing flex flex-col flex-1">
      <header className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand" aria-label="Career Builder">
            <span className="brand-name">Career Builder</span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            <Link href="/history" className="active">
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
              <Link href="/login?next=/history" className="nav-cta">
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main
        style={{
          maxWidth: 'var(--cb-max)',
          margin: '0 auto',
          padding: '0 32px',
          width: '100%',
        }}
        className="flex-1"
      >
        <div className="page-head">
          <h1 style={{ fontSize: 44 }}>커리어 기록함</h1>
          <p className="lede" style={{ marginTop: 12, maxWidth: 560 }}>
            저장한 성과 문장을 한곳에서 관리하세요. 역량별 자동 분류와 프로젝트별
            <br />
            맥락 분류를 함께 활용해 이력서·자소서·포트폴리오로 바로 옮길 수 있습니다.
          </p>
          {status === 'loaded' && entries.length > 0 && (
            <div className="meta-row">
              <span>
                총 <strong>{entries.length}</strong> 건의 기록
              </span>
              <span className="sep" />
              <span>
                최근 저장 <strong>{lastSaved}</strong>
              </span>
            </div>
          )}
        </div>

        {error && status === 'error' && (
          <div
            style={{
              background: 'var(--paper)',
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: 14,
              color: 'var(--ink-700)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        {status === 'loading' && (
          <p style={{ fontSize: 14, color: 'var(--ink-400)' }}>불러오는 중…</p>
        )}

        {status === 'unauthed' && (
          <div className="gate">
            <div className="lock-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2>커리어 기록함은 로그인 후 이용할 수 있어요</h2>
            <p>
              저장된 성과 문장과 역량 분류 데이터를 안전하게 보관하기 위해
              로그인이 필요합니다.
            </p>
            <div className="btn-row">
              <Link href="/login?next=/history" className="btn btn-secondary">
                Google로 로그인
              </Link>
              <Link href="/" className="btn btn-ghost">
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        )}

        {status === 'loaded' && entries.length === 0 && (
          <div className="empty">
            <div className="empty-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <h2>아직 저장된 기록이 없어요</h2>
            <p>
              오늘 한 줄을 적고 변환된 성과 문장을 저장하면 여기에 차곡차곡
              쌓입니다.
            </p>
            <div className="btn-row">
              <Link href="/#hero" className="btn btn-secondary">
                첫 기록 남기기
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {status === 'loaded' && entries.length > 0 && (
          <>
            <div className="stats">
              <div className="stat-card accent">
                <div className="lbl">누적 기록</div>
                <div className="val">
                  {stats.total}
                  <span className="unit">건</span>
                </div>
                <div className="delta">이번 주 +{stats.thisWeek}건</div>
              </div>
              <div className="stat-card">
                <div className="lbl">이번 달</div>
                <div className="val">
                  {stats.thisMonth}
                  <span className="unit">건</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="lbl">연결된 역량</div>
                <div className="val">
                  {stats.skillsAll}
                  <span className="unit">개</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="lbl">가장 많은 역량</div>
                <div className="val" style={{ fontSize: 20 }}>
                  {stats.topSkill}
                </div>
              </div>
            </div>

            <div className="toolbar">
              <div className="toolbar-left">
                <button
                  type="button"
                  className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('all')}
                >
                  전체 <span className="count">{entries.length}</span>
                </button>
                {stats.skillTop5.map(([lbl, cnt]) => (
                  <button
                    key={lbl}
                    type="button"
                    className={`filter-chip ${activeFilter === lbl ? 'active' : ''}`}
                    onClick={() => setActiveFilter(lbl)}
                  >
                    {lbl} <span className="count">{cnt}</span>
                  </button>
                ))}
              </div>
              <div className="toolbar-right">
                <label className="project-filter">
                  <span className="project-filter-label">프로젝트</span>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    <option value="all">모든 프로젝트</option>
                    <option value={UNCATEGORIZED}>미분류</option>
                    {projectOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="search"
                    placeholder="기록 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="selection-bar">
              <label className="select-all">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el)
                      el.indeterminate =
                        selectedInFilteredCount > 0 && !allFilteredSelected
                  }}
                  onChange={toggleSelectAll}
                />
                <span>전체 선택</span>
              </label>
              <span className="selection-count">
                {selectedTotal === 0
                  ? '체크박스로 항목을 선택하세요'
                  : `${selectedTotal}건 선택됨`}
              </span>
              {selectedTotal > 0 && (
                <button type="button" className="link-btn" onClick={clearSelection}>
                  선택 해제
                </button>
              )}
              <div className="selection-spacer" />
              <div className="export-wrap" ref={exportWrapRef}>
                <button
                  type="button"
                  className="btn-export"
                  disabled={selectedTotal === 0}
                  onClick={() => setExportMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={exportMenuOpen}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  선택 내보내기
                  {selectedTotal > 0 && <span className="count-pill">{selectedTotal}</span>}
                </button>
                {exportMenuOpen && (
                  <div className="export-menu align-right" role="menu">
                    <button type="button" role="menuitem" onClick={() => onExportSelected('copy')}>
                      텍스트로 복사
                    </button>
                    <button type="button" role="menuitem" onClick={() => onExportSelected('markdown')}>
                      마크다운 파일로 다운로드
                    </button>
                  </div>
                )}
              </div>
            </div>

            <datalist id={datalistId}>
              {projectOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            <div className="entries">
              {filtered.length === 0 ? (
                <div className="empty" style={{ padding: '36px 24px' }}>
                  <div className="empty-mark">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 18 }}>검색 결과가 없어요</h2>
                  <p>다른 키워드나 필터로 다시 시도해보세요.</p>
                </div>
              ) : (
                filtered.map((entry) => {
                  const dateIso = effectiveDate(entry)
                  const date = formatDateBox(dateIso)
                  const isEditingDate = editingDateId === entry.id
                  const draft = projectDraft[entry.id] ?? ''
                  const current = (entry.project_name ?? '').trim()
                  const dirty = draft.trim() !== current
                  const projectAssigned = !!current
                  const checked = selectedIds.has(entry.id)
                  return (
                    <article
                      key={entry.id}
                      className={`entry ${checked ? 'selected' : ''}`}
                    >
                      <label className="entry-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(entry.id)}
                          aria-label="이 기록 선택"
                        />
                      </label>
                      <div className="entry-date">
                        {isEditingDate ? (
                          <div className="date-edit">
                            <input
                              type="date"
                              className="date-picker"
                              autoFocus
                              value={editingDateValue}
                              onChange={(e) => setEditingDateValue(e.target.value)}
                            />
                            <div className="date-edit-actions">
                              <button
                                type="button"
                                className="date-action today"
                                onClick={setDateToToday}
                              >
                                오늘
                              </button>
                              <button
                                type="button"
                                className="date-action cancel"
                                onClick={closeDateEditor}
                                disabled={savingDateId === entry.id}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="date-action save"
                                onClick={() => saveDate(entry)}
                                disabled={savingDateId === entry.id}
                              >
                                {savingDateId === entry.id ? '저장 중…' : '저장'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="date-display"
                            onClick={() => openDateEditor(entry)}
                            aria-label="날짜 수정"
                            title="클릭하여 날짜 수정"
                          >
                            <span className="day">{date.day}</span>
                            <span className="mo">{date.mo}</span>
                            <span className="wk">{date.wk}</span>
                          </button>
                        )}
                      </div>
                      <div className="entry-body">
                        <div className="entry-original">
                          <span className="otag">원본</span>
                          <span className="otext">{entry.raw_text}</span>
                        </div>
                        {editingMetricId === entry.id ? (
                          <div className="entry-metric-edit">
                            <textarea
                              className="metric-textarea"
                              value={editingMetricValue}
                              onChange={(e) =>
                                setEditingMetricValue(e.target.value)
                              }
                              rows={4}
                              autoFocus
                            />
                            <div className="metric-edit-actions">
                              <button
                                type="button"
                                className="metric-action revert"
                                onClick={() => revertMetric(entry)}
                                disabled={
                                  savingMetricId === entry.id ||
                                  !entry.metric_result_original
                                }
                                title={
                                  entry.metric_result_original
                                    ? 'AI가 처음 만들어준 문장으로 복원'
                                    : '되돌릴 원본 문장이 없습니다'
                                }
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="1 4 1 10 7 10" />
                                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                </svg>
                                원본으로 되돌리기
                              </button>
                              <div className="metric-edit-spacer" />
                              <button
                                type="button"
                                className="metric-action cancel"
                                onClick={closeMetricEditor}
                                disabled={savingMetricId === entry.id}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                className="metric-action save"
                                onClick={() => saveMetric(entry)}
                                disabled={
                                  savingMetricId === entry.id ||
                                  !editingMetricValue.trim()
                                }
                              >
                                {savingMetricId === entry.id ? '저장 중…' : '저장'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            className="entry-sentence"
                            onDoubleClick={() => openMetricEditor(entry)}
                          >
                            {entry.metric_result ?? entry.raw_text}
                          </p>
                        )}
                        {entry.chips && entry.chips.length > 0 && (
                          <div className="entry-chips" aria-label="자동 분류된 역량 태그">
                            {entry.chips.map((c) => (
                              <span key={c} className="chip">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="entry-project">
                          <span className="entry-project-icon" aria-hidden>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            </svg>
                          </span>
                          <span className="entry-project-label">프로젝트</span>
                          <input
                            type="text"
                            list={datalistId}
                            className="entry-project-input"
                            placeholder="프로젝트명 입력 (예: 온보딩 리뉴얼)"
                            value={draft}
                            onChange={(e) =>
                              onProjectDraftChange(entry.id, e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && dirty && savingProjectId !== entry.id) {
                                e.preventDefault()
                                void commitProject(entry)
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="project-save-btn"
                            disabled={!dirty || savingProjectId === entry.id}
                            onClick={() => commitProject(entry)}
                          >
                            {savingProjectId === entry.id ? '저장 중…' : '저장'}
                          </button>
                          {!projectAssigned && !dirty && (
                            <span className="entry-project-badge">미분류</span>
                          )}
                        </div>
                      </div>
                      <div className="entry-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="변환 문장 수정"
                          aria-label="변환 문장 수정"
                          onClick={() => openMetricEditor(entry)}
                          disabled={editingMetricId === entry.id}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="성과 문장 복사"
                          onClick={() => onCopy(entry)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="삭제"
                          onClick={() => onDelete(entry.id)}
                          disabled={deletingId === entry.id}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          </svg>
                        </button>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </>
        )}
      </main>

      <div
        className={`cb-toast ${toastVisible ? 'show' : ''}`}
        role="status"
        aria-live="polite"
      >
        <span className="cb-toast-msg">
          <span className="check">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span>{toastMsg}</span>
        </span>
      </div>
    </div>
  )
}
