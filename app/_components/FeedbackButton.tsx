'use client'

import { useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

type Rating = 1 | 2 | 3 | 4
type Status = 'idle' | 'submitting' | 'success' | 'error'

const RATING_OPTIONS: { value: Rating; label: string }[] = [
  { value: 1, label: '별로' },
  { value: 2, label: '보통' },
  { value: 3, label: '꽤' },
  { value: 4, label: '많이' },
]

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<Rating | null>(null)
  const [painPoint, setPainPoint] = useState('')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  function reset() {
    setRating(null)
    setPainPoint('')
    setComment('')
    setStatus('idle')
    setError(null)
  }

  function close() {
    setOpen(false)
    setTimeout(reset, 250)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) {
      setError('도움도를 선택해주세요.')
      return
    }
    setStatus('submitting')
    setError(null)
    try {
      const supabase = createBrowserSupabase()
      const { error: insertError } = await supabase.from('feedbacks').insert({
        rating,
        pain_point: painPoint.trim() || null,
        comment: comment.trim() || null,
      })
      if (insertError) throw insertError
      setStatus('success')
      setTimeout(() => close(), 1600)
    } catch (e) {
      setStatus('error')
      setError((e as Error).message ?? '제출에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="의견 남기기"
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 inline-flex items-center gap-2 rounded-full bg-mono-900 text-mono-50 px-4 py-3 sm:px-5 sm:py-3 text-sm font-medium shadow-[0_8px_24px_rgba(14,14,16,0.18)] hover:bg-mono-700 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <span className="hidden sm:inline">의견 남기기</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <div
            className="absolute inset-0 bg-mono-900/40 backdrop-blur-sm"
            onClick={close}
          />

          <div className="relative w-full sm:max-w-md mx-auto sm:mx-4 panel-strong rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 max-h-[92vh] overflow-y-auto animate-[slideUp_220ms_ease-out]">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2
                  id="feedback-title"
                  className="text-lg font-semibold text-mono-900"
                >
                  의견 남기기
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-mono-700">
                  서비스 개선을 위해 진솔한 의견을 남겨주세요. 여러분의 소중한 의견이 더 나은 서비스를 만드는 데 도움이 됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="닫기"
                className="shrink-0 -mr-1 -mt-1 p-2 rounded-full text-mono-400 hover:text-mono-700 hover:bg-mono-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {status === 'success' ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mono-100 text-mono-900">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-base font-medium text-mono-900">
                  소중한 의견 감사합니다!
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <fieldset>
                  <legend className="block text-sm font-medium text-mono-900">
                    이 기능이 얼마나 도움이 되었나요?
                    <span className="ml-1 text-mono-400">*</span>
                  </legend>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {RATING_OPTIONS.map((opt) => {
                      const active = rating === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRating(opt.value)}
                          className={`px-3 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                            active
                              ? 'bg-mono-900 text-mono-50 border-mono-900'
                              : 'bg-white text-mono-700 border-mono-200 hover:border-mono-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                <div>
                  <label
                    htmlFor="feedback-pain"
                    className="block text-sm font-medium text-mono-900"
                  >
                    이 서비스에서 기대했던 점이 있으신가요?
                  </label>
                  <textarea
                    id="feedback-pain"
                    value={painPoint}
                    onChange={(e) => setPainPoint(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="mt-2 w-full rounded-2xl border border-mono-200 bg-white px-4 py-3 text-sm leading-6 text-mono-900 placeholder-mono-400 outline-none focus:border-mono-700 transition-colors resize-none"
                    placeholder="자유롭게 적어주세요"
                  />
                </div>

                <div>
                  <label
                    htmlFor="feedback-comment"
                    className="block text-sm font-medium text-mono-900"
                  >
                    개선을 위한 자유로운 의견을 남겨주세요. 서비스 이용 시 불편했던 점도 좋아요!
                  </label>
                  <textarea
                    id="feedback-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    className="mt-2 w-full rounded-2xl border border-mono-200 bg-white px-4 py-3 text-sm leading-6 text-mono-900 placeholder-mono-400 outline-none focus:border-mono-700 transition-colors resize-none"
                    placeholder="자유롭게 적어주세요"
                  />
                </div>

                {error && (
                  <p className="text-sm text-mono-700 bg-mono-100 px-4 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2.5 rounded-full text-sm font-medium text-mono-700 hover:bg-mono-100 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={status === 'submitting' || !rating}
                    className="px-5 py-2.5 rounded-full bg-mono-900 text-mono-50 text-sm font-medium hover:bg-mono-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {status === 'submitting' ? '제출 중…' : '의견 보내기'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
