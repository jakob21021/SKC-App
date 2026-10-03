import { api } from '@/data'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'granted' | 'denied' | 'default' | 'unsupported'

export function pushState(): PushState {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported'
  return Notification.permission
}

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/**
 * Fragt die Erlaubnis an und registriert dieses Gerät für Push-Benachrichtigungen.
 * Auf dem iPhone geht das nur, wenn die App zum Home-Bildschirm hinzugefügt wurde.
 */
export async function enablePush(prefs: Record<string, boolean>): Promise<PushState> {
  if (pushState() === 'unsupported') return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission
  await syncPush(prefs)
  return 'granted'
}

/** Push-Abo (neu) speichern, z. B. nach geänderten Einstellungen */
export async function syncPush(prefs: Record<string, boolean>) {
  if (pushState() !== 'granted' || !VAPID || api.mode !== 'supabase') return
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) }))
  await api.savePushSubscription(sub.toJSON(), prefs)
}
