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
