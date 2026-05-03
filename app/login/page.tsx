'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'

function LoginInner() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/'
  const errorParam = params.get('error')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    errorParam === 'oauth' ? 'Google 인증에 실패했습니다. 다시 시도해주세요.' : null
  )

  async function onGoogle() {
    setBusy(true)
    setError(null)
    try {
      const supabase = createBrowserSupabase()
      const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback },
      })
      if (error) throw error
    } catch (e) {
      setBusy(false)
      setError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-10 flex justify-center pt-6 pb-2">
        <div className="pill px-2 py-1 text-sm font-medium text-mono-700 flex items-center gap-1">
          <Link
            href="/"
            className="px-3 py-1.5 rounded-full hover:bg-mono-100 transition-colors text-mono-700"
          >
            ← 홈
          </Link>
          <span className="px-3 py-1.5">로그인</span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-6 pt-12 pb-24 flex flex-col items-center justify-center">
        <div className="glass-strong p-8 sm:p-10 w-full">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-mono-900 mb-2 text-center">
            로그인
          </h1>
          <p className="text-sm text-mono-400 text-center mb-8">
            저장과 기록 조회는 로그인이 필요합니다.
            <br />
            변환·STAR 교정은 로그인 없이도 사용 가능합니다.
          </p>

          {error && (
            <p className="mb-6 text-sm text-mono-700 bg-mono-100 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            onClick={onGoogle}
            disabled={busy}
            className="w-full px-5 py-3 rounded-full bg-mono-900 text-mono-50 text-sm font-medium hover:bg-mono-700 transition-colors disabled:opacity-40"
          >
            {busy ? '이동 중…' : 'Google 로 계속하기'}
          </button>

          <p className="mt-6 text-xs text-mono-400 text-center">
            로그인 시 Google 프로필의 이메일·이름을 받아 본인 데이터를 격리합니다.
          </p>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  )
}
