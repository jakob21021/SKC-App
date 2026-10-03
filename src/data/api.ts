import type {
  AbsenceReason,
  AccessRequest,
  Absence,
  AppNotification,
  Carpool,
  ClubEvent,
  GameAction,
  GameStatus,
  HelperList,
  ID,
  ISODate,
  League,
  Member,
  NewsPost,
  Rsvp,
  RsvpStatus,
  Session,
  Special,
  Team,
  Venue,
} from './types'

export interface ClubData {
  teams: Team[]
  venues: Venue[]
  members: Member[]
}

export interface RsvpInput {
  eventId: ID
  memberId: ID
  status: RsvpStatus
  reason?: AbsenceReason
  comment?: string
}

export interface EventInput extends Omit<ClubEvent, 'id'> {
  id?: ID
}

export interface SaveEventOptions {
  /** Wöchentliche Serie bis einschließlich dieses Tages anlegen */
  repeatWeeklyUntil?: string
}

export type NewPost = Pick<NewsPost, 'title' | 'body' | 'category' | 'teamId' | 'pinned' | 'visibility'> & {
  poll?: { question: string; options: string[]; multi: boolean }
}

export type NewHelperList = Omit<HelperList, 'id' | 'createdBy' | 'shifts'> & {
  shifts: Omit<HelperList['shifts'][number], 'id' | 'signupIds'>[]
}

export type AccessRequestInput = Omit<AccessRequest, 'id' | 'createdAt' | 'status'>

/**
 * Schnittstelle zwischen App und Backend.
 * Implementiert durch die Demo-Datenquelle (lokal im Browser) und Supabase (Produktion).
 */
export interface Api {
  readonly mode: 'demo' | 'supabase'

  // Anmeldung
  getSession(): Promise<Session | null>
  signInWithPassword(email: string, password: string): Promise<Session>
  /** Schickt einen 6-stelligen Anmeldecode per E-Mail (funktioniert auch in der installierten App) */
  sendLoginCode(email: string): Promise<void>
  verifyLoginCode(email: string, code: string): Promise<Session>
  signInDemo(memberId: ID): Promise<Session>
  signOut(): Promise<void>
  requestAccess(input: AccessRequestInput): Promise<void>

  // Stammdaten
  getClubData(): Promise<ClubData>
  updateMember(id: ID, patch: Partial<Pick<Member, 'phone' | 'email' | 'jerseyNumber'>>): Promise<void>

  // Termine
  listEvents(from: ISODate, to: ISODate): Promise<ClubEvent[]>
  getEvent(id: ID): Promise<ClubEvent | null>
  saveEvent(input: EventInput, options?: SaveEventOptions): Promise<ClubEvent>
  cancelEvent(id: ID, reason: string): Promise<void>
  deleteEvent(id: ID): Promise<void>
  setSquad(eventId: ID, memberIds: ID[]): Promise<void>
  /** Erinnert alle, die noch nicht geantwortet haben. Liefert die Anzahl Erinnerungen. */
  remindOpen(eventId: ID, memberIds: ID[]): Promise<number>

  // Rückmeldungen & Abwesenheiten
  listRsvps(eventIds: ID[]): Promise<Rsvp[]>
  setRsvp(input: RsvpInput): Promise<void>
  listAbsences(): Promise<Absence[]>
  addAbsence(input: Omit<Absence, 'id'>): Promise<void>
  removeAbsence(id: ID): Promise<void>

  // Fahrgemeinschaften
  listCarpools(eventId: ID): Promise<Carpool[]>
  offerCarpool(input: Omit<Carpool, 'id' | 'passengerIds'>): Promise<void>
  joinCarpool(carpoolId: ID, memberId: ID): Promise<void>
  leaveCarpool(carpoolId: ID, memberId: ID): Promise<void>
  removeCarpool(carpoolId: ID): Promise<void>

  // Spiele, Live-Ticker & Statistik
  listGameActions(eventIds?: ID[]): Promise<GameAction[]>
  addGameAction(action: Omit<GameAction, 'id'>): Promise<void>
  removeGameAction(id: ID): Promise<void>
  setGameStatus(eventId: ID, status: GameStatus, period?: 1 | 2): Promise<void>
  listLeagues(): Promise<League[]>

  // Helferlisten
  listHelperLists(): Promise<HelperList[]>
  saveHelperList(input: NewHelperList): Promise<void>
  signupShift(shiftId: ID, memberId: ID): Promise<void>
  leaveShift(shiftId: ID, memberId: ID): Promise<void>

  // News, Umfragen, Specials
  listNews(): Promise<NewsPost[]>
  createPost(input: NewPost): Promise<void>
  deletePost(id: ID): Promise<void>
  toggleReaction(postId: ID, emoji: string): Promise<void>
  vote(pollId: ID, optionIds: ID[]): Promise<void>
  listSpecials(): Promise<Special[]>

  // Benachrichtigungen
  /** Push-Abo dieses Geräts speichern (inkl. Einstellungen, welche Arten gepusht werden) */
  savePushSubscription(sub: PushSubscriptionJSON, prefs: Record<string, boolean>): Promise<void>
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(ids: ID[]): Promise<void>

  // Verwaltung
  listAccessRequests(): Promise<AccessRequest[]>
  resolveAccessRequest(id: ID, approve: boolean): Promise<void>

  /** Meldet Änderungen (z. B. aus anderen Tabs oder per Realtime). */
  subscribe(onChange: (scope: ChangeScope) => void): () => void
}

export type ChangeScope =
  | 'events'
  | 'rsvps'
  | 'absences'
  | 'carpools'
  | 'gameActions'
  | 'helpers'
  | 'news'
  | 'notifications'
  | 'members'
  | 'requests'
  | 'all'
