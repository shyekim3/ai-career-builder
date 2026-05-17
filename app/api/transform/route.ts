import type { NextRequest } from 'next/server'
import { METRIC_JSON_SYSTEM, STAR_SYSTEM } from '@/lib/prompts'
import { callOpenRouter, callOpenRouterJson } from '@/lib/openrouter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { mode: 'metric' | 'star'; text: string }

type FollowupItem = { question: string; options?: string[] }
// LLM 원본 응답은 items 가 string[] 이거나 객체[] 일 수 있음 → 정규화 후 FollowupItem[] 로 보낸다.
type RawFollowupItem = string | { question?: unknown; options?: unknown } | null | undefined
type MetricJson =
  | { type: 'result'; sentence: string; chips?: string[] }
  | {
      type: 'needs_info'
      questions?: { topic: string; items: RawFollowupItem[] }[]
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
          items: Array.isArray(q.items)
            ? q.items
                .map((it) => {
                  if (typeof it === 'string') {
                    return { question: it.trim() } as FollowupItem
                  }
                  if (it && typeof it === 'object' && typeof it.question === 'string') {
                    const rawOpts = it.options
                    const opts = Array.isArray(rawOpts)
                      ? rawOpts
                          .filter((o): o is string => typeof o === 'string' && !!o.trim())
                          .map((o) => o.trim())
                      : undefined
                    return {
                      question: it.question.trim(),
                      ...(opts && opts.length ? { options: opts } : {}),
                    } as FollowupItem
                  }
                  return null
                })
                .filter((it): it is FollowupItem => !!it && !!it.question)
            : [],
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
