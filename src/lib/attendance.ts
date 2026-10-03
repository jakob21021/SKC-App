import { format } from 'date-fns'
import type { Absence, AbsenceReason, ClubEvent, Gender, ID, Member, Rsvp, RsvpStatus, Team } from '@/data/types'

export type EffectiveStatus = RsvpStatus | 'open'

export interface EffectiveRsvp {
  status: EffectiveStatus
  /** explicit = selbst geantwortet, absence = aus Abwesenheit, default = Team-Standard */
  source: 'explicit' | 'absence' | 'default' | 'none'
  reason?: AbsenceReason
  comment?: string
  rsvp?: Rsvp
}

export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  yes: 'Dabei',
  no: 'Nicht dabei',
  maybe: 'Vielleicht',
  open: 'Offen',
}

export const REASON_LABEL: Record<AbsenceReason, string> = {
  krank: 'Krank',
  verletzt: 'Verletzt',
  arbeit: 'Arbeit',
  schule: 'Schule/Uni',
  urlaub: 'Urlaub',
  privat: 'Privat',
  sonstiges: 'Sonstiges',
}

export const REASONS = Object.keys(REASON_LABEL) as AbsenceReason[]

export function eventDay(event: Pick<ClubEvent, 'start'>) {
  return format(new Date(event.start), 'yyyy-MM-dd')
}

/** Wer ist für einen Termin angefragt? */
export function rosterFor(event: ClubEvent, members: Member[]): Member[] {
  if (!event.rsvpEnabled) return []
  const squad = event.game?.squad ?? []
  if (squad.length > 0) return members.filter((m) => squad.includes(m.id))
  if (event.teamIds.length === 0) return members.filter((m) => m.teamIds.length > 0)
  return members.filter((m) => m.teamIds.some((t) => event.teamIds.includes(t)))
}

export function effectiveRsvp(
  event: ClubEvent,
  memberId: ID,
  rsvps: Rsvp[],
  absences: Absence[],
  teams: Team[],
): EffectiveRsvp {
  const rsvp = rsvps.find((r) => r.eventId === event.id && r.memberId === memberId)
  if (rsvp) return { status: rsvp.status, source: 'explicit', reason: rsvp.reason, comment: rsvp.comment, rsvp }

  const day = eventDay(event)
  const absence = absences.find((a) => a.memberId === memberId && a.from <= day && day <= a.to)
  if (absence) return { status: 'no', source: 'absence', reason: absence.reason, comment: absence.note }

  if (event.kind === 'training') {
    const optOut = teams.some((t) => event.teamIds.includes(t.id) && t.trainingDefault === 'yes')
    if (optOut) return { status: 'yes', source: 'default' }
  }
  return { status: 'open', source: 'none' }
}

export interface AttendanceSummary {
  entries: { member: Member; rsvp: EffectiveRsvp }[]
  byStatus: Record<EffectiveStatus, Member[]>
  yesByGender: Record<Gender, number>
}

export function summarize(
  event: ClubEvent,
  members: Member[],
  rsvps: Rsvp[],
  absences: Absence[],
  teams: Team[],
): AttendanceSummary {
  const roster = rosterFor(event, members)
  const byStatus: AttendanceSummary['byStatus'] = { yes: [], no: [], maybe: [], open: [] }
  const yesByGender: Record<Gender, number> = { w: 0, m: 0 }
  const entries = roster.map((member) => {
    const rsvp = effectiveRsvp(event, member.id, rsvps, absences, teams)
    byStatus[rsvp.status].push(member)
    if (rsvp.status === 'yes' && member.gender) yesByGender[member.gender]++
    return { member, rsvp }
  })
  return { entries, byStatus, yesByGender }
}

/** Trainingsbeteiligung eines Mitglieds über vergangene Trainings. */
export function trainingRate(
  memberId: ID,
  pastTrainings: ClubEvent[],
  rsvps: Rsvp[],
  absences: Absence[],
  teams: Team[],
  members: Member[],
) {
  const member = members.find((m) => m.id === memberId)
  if (!member) return { attended: 0, total: 0, rate: 0 }
  const relevant = pastTrainings.filter(
    (e) => !e.cancelled && e.kind === 'training' && e.teamIds.some((t) => member.teamIds.includes(t)),
  )
  const attended = relevant.filter((e) => effectiveRsvp(e, memberId, rsvps, absences, teams).status === 'yes').length
  return { attended, total: relevant.length, rate: relevant.length ? attended / relevant.length : 0 }
}
