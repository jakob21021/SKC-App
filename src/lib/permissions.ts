import type { ClubEvent, ID, Member } from '@/data/types'

export const isAdmin = (m: Member | null | undefined) =>
  !!m && (m.roles.includes('admin') || m.roles.includes('board'))

export const isCoachOf = (m: Member | null | undefined, teamIds: ID[]) =>
  !!m && teamIds.some((t) => m.coachOf.includes(t))

export const isCoach = (m: Member | null | undefined) => !!m && m.coachOf.length > 0

/** Termine anlegen/bearbeiten: Vorstand für alles, Trainer:innen für ihre Teams */
export function canManageEvent(m: Member | null | undefined, event: Pick<ClubEvent, 'teamIds'>) {
  if (isAdmin(m)) return true
  return event.teamIds.length > 0 && isCoachOf(m, event.teamIds)
}

export const canScore = canManageEvent

/** Für wen darf dieses Mitglied zu-/absagen? Sich selbst und die eigenen Kinder. */
export function canRespondFor(m: Member | null | undefined, memberId: ID) {
  if (!m) return false
  return m.id === memberId || m.parentOf.includes(memberId)
}

/** Absagegründe sind sensibel (z. B. "krank") und nur für Trainer:innen/Vorstand sichtbar. */
export const canSeeReasons = (m: Member | null | undefined, event: Pick<ClubEvent, 'teamIds'>) =>
  canManageEvent(m, event)

export const canPostNews = (m: Member | null | undefined) => isAdmin(m) || isCoach(m)
export const canManageHelpers = (m: Member | null | undefined) => isAdmin(m)

export function roleLabel(m: Member) {
  if (m.title) return m.title
  if (m.roles.includes('admin') || m.roles.includes('board')) return 'Vorstand'
  if (m.coachOf.length) return 'Trainer:in'
  if (m.parentOf.length && !m.teamIds.length) return 'Elternteil'
  return 'Spieler:in'
}
