import type { NextRequest } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import type { Entry } from '@/lib/supabase/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PatchBody = {
  projectName?: string | null
  entryDate?: string | null
  metricResult?: string | null
  metricResultOriginal?: string | null
  rawText?: string
  chips?: string[]
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  try {
    const { error } = await sb.from('entries').delete().eq('id', id)
    if (error) throw error
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = await createServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = (await req.json()) as PatchBody
  const update: Record<string, string | string[] | null> = {}
  if ('projectName' in body) {
    const next = (body.projectName ?? '').trim()
    update.project_name = next.length ? next : null
  }
  if ('entryDate' in body) {
    update.entry_date = body.entryDate || null
  }
  if ('metricResult' in body) {
    const next = (body.metricResult ?? '').trim()
    update.metric_result = next.length ? next : null
  }
  if ('metricResultOriginal' in body) {
    const next = (body.metricResultOriginal ?? '').trim()
    update.metric_result_original = next.length ? next : null
  }
  if ('rawText' in body) {
    const next = (body.rawText ?? '').trim()
    if (!next.length) {
      return Response.json({ error: '원본을 비울 수 없습니다.' }, { status: 400 })
    }
    update.raw_text = next
  }
  if ('chips' in body && Array.isArray(body.chips)) {
    update.chips = body.chips
  }
  if (Object.keys(update).length === 0) {
    return Response.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  try {
    const { data, error } = await sb
      .from('entries')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw error
    return Response.json({ entry: data as Entry })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
