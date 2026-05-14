import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Career Builder'

const PRETENDARD_BOLD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf'

async function tryFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export default async function Image() {
  const boldData = await tryFont(PRETENDARD_BOLD)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FEF8F3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 700,
            letterSpacing: '-0.035em',
            color: '#0B0B0C',
            display: 'flex',
          }}
        >
          Career Builder
        </div>
      </div>
    ),
    {
      ...size,
      fonts: boldData
        ? [
            {
              name: 'Pretendard',
              data: boldData,
              weight: 700 as const,
              style: 'normal' as const,
            },
          ]
        : [],
    }
  )
}
