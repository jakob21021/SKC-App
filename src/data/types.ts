// Domänenmodell der SKC-App. Wird von Demo- und Supabase-Datenquelle gleichermaßen genutzt.

export type ID = string
/** ISO-8601 Zeitstempel, z. B. "2026-10-06T18:00:00.000Z" */
export type ISODate = string
/** Kalendertag, z. B. "2026-10-06" */
export type Day = string

export type Gender = 'w' | 'm'

/** Globale Rollen. Trainer-Rechte hängen zusätzlich am Team (Member.coachOf). */
export type Role = 'player' | 'coach' | 'parent' | 'board' | 'admin'

export interface Member {
  id: ID
  firstName: string
  lastName: string
  /** Für die Korfball-Aufstellung (4 Damen + 4 Herren). Bei Eltern/Fans optional. */
  gender?: Gender
  birthYear?: number
  jerseyNumber?: number
  /** Teams, in denen das Mitglied spielt */
  teamIds: ID[]
  /** Teams, die das Mitglied trainiert */
  coachOf: ID[]
  roles: Role[]
  /** Kinder, für die das Mitglied (als Elternteil) zu- und absagen darf */
  parentOf: ID[]
  email?: string
  phone?: string
  /** Funktion im Verein, z. B. "Jugendwart:in" */
  title?: string
  avatarHue: number
}

export type AgeGroup =
  | 'Senioren'
  | 'A-Jugend'
  | 'B-Jugend'
  | 'C-Jugend'
  | 'D-Jugend'
  | 'E-Jugend'
  | 'F-Jugend'
  | 'Hobby'

export interface Team {
  id: ID
  name: string
  short: string
  ageGroup: AgeGroup
  league?: string
  sortOrder: number
  /** "yes" = Trainings gelten als zugesagt, man muss nur absagen */
  trainingDefault: 'open' | 'yes'
}

export interface Venue {
  id: ID
  name: string
  street?: string
  city: string
  mapsQuery: string
  notes?: string
}

export type EventKind = 'training' | 'game' | 'club'

export type GameStatus = 'scheduled' | 'live' | 'halftime' | 'finished'

export interface GameInfo {
  opponent: string
  home: boolean
  competition: string
  status: GameStatus
  /** Länge einer Halbzeit in Minuten (Senioren meist 30, Jugend kürzer) */
  halfMinutes: number
  scoreUs?: number
  scoreThem?: number
  /** Nominierter Kader. Leer = alle Teammitglieder sind angefragt. */
  squad: ID[]
  /** Zeitpunkt des Anpfiffs der laufenden Halbzeit (für die Spieluhr) */
  periodStartedAt?: ISODate
  period?: 1 | 2
}

export interface ClubEvent {
  id: ID
  kind: EventKind
  title: string
  /** Leer = Vereinstermin für alle */
  teamIds: ID[]
  start: ISODate
  end: ISODate
  venueId?: ID
  meetAt?: ISODate
  rsvpDeadline?: ISODate
  description?: string
  cancelled?: boolean
  cancelReason?: string
  seriesId?: ID
  rsvpEnabled: boolean
  /** "public" ist auch ohne Anmeldung sichtbar */
  visibility: 'public' | 'members'
  game?: GameInfo
}

export type RsvpStatus = 'yes' | 'no' | 'maybe'

export type AbsenceReason = 'krank' | 'verletzt' | 'arbeit' | 'schule' | 'urlaub' | 'privat' | 'sonstiges'

export interface Rsvp {
  eventId: ID
  memberId: ID
  status: RsvpStatus
  reason?: AbsenceReason
  comment?: string
  updatedAt: ISODate
  /** Wer hat geantwortet (z. B. Elternteil) */
  updatedBy: ID
}

export interface Absence {
  id: ID
  memberId: ID
  from: Day
  to: Day
  reason: AbsenceReason
  note?: string
}

export interface Carpool {
  id: ID
  eventId: ID
  driverId: ID
  seats: number
  meetPoint: string
  departAt: ISODate
  note?: string
  passengerIds: ID[]
}

export type ShiftIcon = 'cake' | 'cash' | 'clock' | 'wrench' | 'grill' | 'broom' | 'camera' | 'heart'

export interface HelperShift {
  id: ID
  title: string
  start: ISODate
  end: ISODate
  slots: number
  icon: ShiftIcon
  signupIds: ID[]
}

export interface HelperList {
  id: ID
  title: string
  description?: string
  eventId?: ID
  venueId?: ID
  date: Day
  shifts: HelperShift[]
  createdBy: ID
}

export type NewsCategory = 'Verein' | 'Spielbericht' | 'Jugend' | 'Info'

export interface PollOption {
  id: ID
  label: string
  voterIds: ID[]
}

export interface Poll {
  id: ID
  question: string
  options: PollOption[]
  multi: boolean
  closesAt?: ISODate
}

export interface NewsPost {
  id: ID
  title: string
  body: string
  authorId: ID
  createdAt: ISODate
  category: NewsCategory
  teamId?: ID
  pinned?: boolean
  visibility: 'public' | 'members'
  /** Emoji → Mitglieder-IDs */
  reactions: Record<string, ID[]>
  poll?: Poll
}

export type SpecialCategory = 'Sponsor' | 'Fanshop' | 'Verein'

export interface Special {
  id: ID
  title: string
  description: string
  partner: string
  category: SpecialCategory
  code?: string
  url?: string
  validUntil?: Day
  highlight?: boolean
}

/** Korfball-Wurfarten */
export type ShotType = 'distance' | 'close' | 'running_in' | 'penalty' | 'free_pass'

export type GameActionType = 'goal' | 'miss' | 'period'

export interface GameAction {
  id: ID
  eventId: ID
  at: ISODate
  period: 1 | 2
  minute: number
  side: 'us' | 'them'
  type: GameActionType
  shot?: ShotType
  memberId?: ID
  text?: string
}

export interface StandingRow {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  points: number
  isUs?: boolean
}

export interface League {
  id: ID
  name: string
  season: string
  teamId: ID
  rows: StandingRow[]
}

export interface AccessRequest {
  id: ID
  name: string
  email: string
  kind: 'player' | 'parent' | 'coach' | 'fan'
  gender?: Gender
  teamId?: ID
  childName?: string
  message?: string
  createdAt: ISODate
  status: 'open' | 'approved' | 'rejected'
}

export type NotificationKind = 'event' | 'game' | 'helper' | 'news' | 'reminder' | 'system'

export interface AppNotification {
  id: ID
  memberId: ID
  createdAt: ISODate
  kind: NotificationKind
  title: string
  body: string
  link?: string
  read: boolean
}

export interface Session {
  /** null = angemeldet, aber noch nicht als Mitglied freigeschaltet */
  memberId: ID | null
  email?: string
  demo: boolean
}
