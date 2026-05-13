export async function callOpenRouter(system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
  if (!model) throw new Error('OPENROUTER_MODEL is not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? '',
      'X-Title': 'AI Career Builder',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// JSON 응답 모드: response_format 으로 강제 + 코드블록 fallback 파싱.
export async function callOpenRouterJson<T>(system: string, user: string): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')
  if (!model) throw new Error('OPENROUTER_MODEL is not set')

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.OPENROUTER_REFERER ?? '',
      'X-Title': 'AI Career Builder',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const content: string = data.choices?.[0]?.message?.content ?? ''
  return parseJsonLoose<T>(content)
}

function parseJsonLoose<T>(s: string): T {
  const trimmed = s.trim()
  // ```json ... ``` 또는 ``` ... ``` 으로 감싸진 경우 본문만 추출
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  const body = fenced ? fenced[1] : trimmed
  return JSON.parse(body) as T
}
