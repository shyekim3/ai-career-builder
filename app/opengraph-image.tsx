import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Career Builder — 오늘 한 일을, 내일의 커리어 문장으로.'

const PRETENDARD_BOLD =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf'
const PRETENDARD_REGULAR =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf'

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
  const [boldData, regularData] = await Promise.all([
    tryFont(PRETENDARD_BOLD),
    tryFont(PRETENDARD_REGULAR),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FAFAFB',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          position: 'relative',
        }}
      >
        {/* hero glow */}
        <div
          style={{
            position: 'absolute',
            top: -200,
            right: -200,
            width: 760,
            height: 760,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(250,92,64,0.38), rgba(250,92,64,0) 70%)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -240,
            left: -240,
            width: 640,
            height: 640,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(11,11,12,0.10), rgba(11,11,12,0) 70%)',
            display: 'flex',
          }}
        />

        {/* eyebrow */}
        <div
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: '#2A2A2D',
            background: '#F2F2F4',
            padding: '10px 22px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            alignSelf: 'flex-start',
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#FA5C40',
              display: 'flex',
            }}
          />
          AI 커리어 기록 서비스
        </div>

        {/* headline */}
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            color: '#0B0B0C',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex' }}>오늘 한 일을,</div>
          <div style={{ display: 'flex', marginTop: 6, alignItems: 'center' }}>
            내일의&nbsp;
            <span
              style={{
                background: '#FFE4DE',
                padding: '2px 14px',
                borderRadius: 8,
              }}
            >
              커리어 문장
            </span>
            으로.
          </div>
        </div>

        {/* sub */}
        <div
          style={{
            fontSize: 30,
            color: '#2A2A2D',
            marginTop: 44,
            maxWidth: 920,
            lineHeight: 1.5,
            display: 'flex',
          }}
        >
          AI가 성과 중심 문장으로 바꾸고, 역량별 커리어 자산으로 쌓아드립니다.
        </div>

        {/* footer brand */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: 80,
            fontSize: 26,
            fontWeight: 700,
            color: '#0B0B0C',
            letterSpacing: '-0.02em',
            display: 'flex',
          }}
        >
          Career Builder
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(boldData
          ? [
              {
                name: 'Pretendard',
                data: boldData,
                weight: 700 as const,
                style: 'normal' as const,
              },
            ]
          : []),
        ...(regularData
          ? [
              {
                name: 'Pretendard',
                data: regularData,
                weight: 400 as const,
                style: 'normal' as const,
              },
            ]
          : []),
      ],
    }
  )
}
