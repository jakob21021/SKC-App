// Supabase Edge Function: verschickt Web-Push-Benachrichtigungen.
// Wird per Database Webhook bei jedem neuen Eintrag in `public.notifications` aufgerufen.
//
// Benötigte Secrets (supabase secrets set …):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT (z. B. mailto:vorstand@schwerinerkc.de),
//   PUSH_WEBHOOK_SECRET (beliebige lange Zeichenkette, auch im Webhook als Header eintragen)
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(Deno.env.get('VAPID_CONTACT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

interface NotificationRow {
  member_id: string
  kind: 'event' | 'game' | 'helper' | 'news' | 'reminder' | 'system'
  title: string
  body: string
  link: string | null
}

/** Welche Einstellung (Einstellungen → Benachrichtigungen) steuert diese Meldung? */
function prefKey(n: NotificationRow): string | null {
  switch (n.kind) {
    case 'reminder':
      return 'reminders'
    case 'event':
      return 'cancellations'
    case 'game':
      return n.title.includes('nominiert') ? 'nominations' : 'live'
    case 'helper':
      return 'helpers'
    case 'news':
      return 'news'
    default:
      return null // Systemmeldungen immer zustellen
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('PUSH_WEBHOOK_SECRET')}`) {
    return new Response('forbidden', { status: 403 })
  }
  const payload = await req.json()
  const n = payload.record as NotificationRow
  if (!n?.member_id) return new Response('ignored')

  const { data: subs, error } = await supabase.from('push_subscriptions').select('*').eq('member_id', n.member_id)
  if (error) return new Response(error.message, { status: 500 })

  const key = prefKey(n)
  const message = JSON.stringify({ title: n.title, body: n.body, link: n.link ?? '/', tag: n.kind })
  let sent = 0
  await Promise.all(
    (subs ?? [])
      .filter((s) => !key || s.prefs?.[key] !== false)
      .map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 60 * 60 * 24 })
          sent++
        } catch (e) {
          // Abgelaufene Abos aufräumen
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id)
        }
      }),
  )
  return new Response(JSON.stringify({ sent }), { headers: { 'content-type': 'application/json' } })
})
