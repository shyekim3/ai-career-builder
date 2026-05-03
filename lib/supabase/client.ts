import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type Entry = {
  id: string
  created_at: string
  user_id: string
  raw_text: string
  metric_result: string | null
  star_result: string | null
}
