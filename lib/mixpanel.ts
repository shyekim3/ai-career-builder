import mixpanel from 'mixpanel-browser'

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? ''
let initialized = false

function sessionId(): string {
  let id = sessionStorage.getItem('_sid')
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    sessionStorage.setItem('_sid', id)
  }
  return id
}

function isFirstSession(): boolean {
  const first = !localStorage.getItem('_fv')
  if (first) localStorage.setItem('_fv', '1')
  return first
}

export function initMixpanel(userId?: string | null) {
  if (!TOKEN || typeof window === 'undefined') return
  if (!initialized) {
    mixpanel.init(TOKEN, { persistence: 'localStorage', track_pageview: false })
    initialized = true
  }
  const now = new Date()
  mixpanel.register({
    session_id: sessionId(),
    logged_in: !!userId,
    platform: 'web',
    day_of_week: now.getDay(),
    hour_of_day: now.getHours(),
    is_first_session: isFirstSession(),
    ...(userId ? { user_id: userId } : {}),
  })
  if (userId) mixpanel.identify(userId)
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!TOKEN || typeof window === 'undefined') return
  try {
    mixpanel.track(event, props)
  } catch {}
}
