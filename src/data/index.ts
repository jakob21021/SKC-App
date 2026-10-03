import type { Api } from './api'
import { createDemoApi } from './demo/demoApi'
import { createSupabaseApi } from './supabase/supabaseApi'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Mit Supabase-Zugangsdaten läuft die echte App, sonst der Demo-Modus (Daten nur im Browser). */
export const api: Api & { reset?: () => void } = url && key ? createSupabaseApi(url, key) : createDemoApi()
