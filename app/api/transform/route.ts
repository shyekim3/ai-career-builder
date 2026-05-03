import type { NextRequest } from 'next/server'
import { METRIC_SYSTEM, STAR_SYSTEM } from '@/lib/prompts'
import { callOpenRouter } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { mode: 'metric' | 'star'; text: string }

export async function POST(req: NextRequest) {
  const { mode, text } = (await req.json()) as Body
  if (!text?.trim()) {
    return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }
  const system = mode === 'star' ? STAR_SYSTEM : METRIC_SYSTEM
  try {
    const result = await callOpenRouter(system, text)
    return Response.json({ result })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
