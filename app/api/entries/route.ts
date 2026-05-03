import type { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Entry } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PostBody = {
  rawText: string
  metricResult: string | null
  starResult: string | null
}

export async function POST(req: NextRequest) {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = (await req.json()) as PostBody
  if (!body.rawText?.trim()) {
    return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }

  try {
    const { data, error } = await sb
      .from('entries')
      .insert({
        user_id: user.id,
        raw_text: body.rawText,
        metric_result: body.metricResult,
        star_result: body.starResult,
      })
      .select()
      .single()
    if (error) throw error
    return Response.json({ entry: data as Entry })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET() {
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const { data, error } = await sb
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return Response.json({ entries: (data ?? []) as Entry[] })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
