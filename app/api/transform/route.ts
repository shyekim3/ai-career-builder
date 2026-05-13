import type { NextRequest } from 'next/server'
import { METRIC_JSON_SYSTEM, STAR_SYSTEM } from '@/lib/prompts'
import { callOpenRouter, callOpenRouterJson } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { mode: 'metric' | 'star'; text: string }

type MetricJson =
  | { type: 'result'; sentence: string; chips?: string[] }
  | {
      type: 'needs_info'
      questions?: { topic: string; items: string[] }[]
    }

export async function POST(req: NextRequest) {
  const { mode, text } = (await req.json()) as Body
  if (!text?.trim()) {
    return Response.json({ error: '내용을 입력해주세요.' }, { status: 400 })
  }

  try {
    if (mode === 'star') {
      const result = await callOpenRouter(STAR_SYSTEM, text)
      return Response.json({ result })
    }

    const json = await callOpenRouterJson<MetricJson>(METRIC_JSON_SYSTEM, text)
    if (json.type === 'needs_info') {
      return Response.json({
        type: 'needs_info' as const,
        questions: (json.questions ?? []).map((q) => ({
          topic: q.topic ?? '',
          items: Array.isArray(q.items) ? q.items.filter(Boolean) : [],
        })),
      })
    }
    return Response.json({
      type: 'result' as const,
      sentence: json.sentence ?? '',
      chips: Array.isArray(json.chips) ? json.chips.slice(0, 3) : [],
    })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
