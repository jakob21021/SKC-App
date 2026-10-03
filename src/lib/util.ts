import type { Member, Venue } from '@/data/types'

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

export const fullName = (m: Pick<Member, 'firstName' | 'lastName'>) => `${m.firstName} ${m.lastName}`
export const shortName = (m: Pick<Member, 'firstName' | 'lastName'>) => `${m.firstName} ${m.lastName.charAt(0)}.`
export const initials = (m: Pick<Member, 'firstName' | 'lastName'>) => `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`

export const uid = (prefix = '') =>
  prefix + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))

export function mapsUrl(venue: Venue) {
  const q = encodeURIComponent(venue.mapsQuery)
  const apple = /iPad|iPhone|Macintosh/.test(navigator.userAgent)
  return apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`
}

export const byName = (a: Member, b: Member) =>
  a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de')

export async function shareOrCopy(data: { title: string; text: string; url?: string }) {
  if (navigator.share) {
    try {
      await navigator.share(data)
      return 'shared' as const
    } catch {
      return 'cancelled' as const
    }
  }
  await navigator.clipboard?.writeText([data.text, data.url].filter(Boolean).join('\n'))
  return 'copied' as const
}
