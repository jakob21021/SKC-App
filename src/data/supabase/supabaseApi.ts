// Produktions-Datenquelle: Supabase (Postgres + Auth + Realtime).
// Schema, Rechte und Funktionen: siehe supabase/migrations.
import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Api, ChangeScope } from '../api'
import type {
  AccessRequest,
  Absence,
  AppNotification,
  Carpool,
  ClubEvent,
  GameAction,
  HelperList,
  League,
  Member,
  NewsPost,
  Rsvp,
  Session,
  Special,
  Team,
  Venue,
} from '../types'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Supabase-Fehler in verständliche Meldungen übersetzen */
function check<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) {
    const msg = res.error.message
    if (res.error.code === '42501' || /permission denied|row-level security/i.test(msg)) throw new Error(msg.startsWith('Keine') || msg.startsWith('Du ') ? msg : 'Dafür fehlen dir die Rechte.')
    throw new Error(msg)
  }
  return res.data as NonNullable<T>
}

const undef = <T,>(v: T | null | undefined) => (v == null ? undefined : v)
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : undef(v))
const chunks = <T,>(arr: T[], size = 100) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

// ------------------------------------------------------------------ Zeilen ↔ Domäne

const toTeam = (r: Row): Team => ({
  id: r.id,
  name: r.name,
  short: r.short,
  ageGroup: r.age_group,
  league: undef(r.league),
  sortOrder: r.sort_order,
  trainingDefault: r.training_default,
})

const toVenue = (r: Row): Venue => ({ id: r.id, name: r.name, street: undef(r.street), city: r.city, mapsQuery: r.maps_query, notes: undef(r.notes) })

const toMember = (r: Row): Member => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  gender: undef(r.gender),
  birthYear: undef(r.birth_year),
  jerseyNumber: undef(r.jersey_number),
  teamIds: r.team_ids ?? [],
  coachOf: r.coach_of ?? [],
  roles: r.roles ?? [],
  parentOf: r.parent_of ?? [],
  email: undef(r.email),
  phone: undef(r.phone),
  title: undef(r.title),
  avatarHue: r.avatar_hue ?? 0,
})

export const toEvent = (r: Row): ClubEvent => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  teamIds: r.team_ids ?? [],
  start: r.starts_at,
  end: r.ends_at,
  venueId: undef(r.venue_id),
  meetAt: undef(r.meet_at),
  rsvpDeadline: undef(r.rsvp_deadline),
  description: undef(r.description),
  cancelled: r.cancelled,
  cancelReason: undef(r.cancel_reason),
  seriesId: undef(r.series_id),
  rsvpEnabled: r.rsvp_enabled,
  visibility: r.visibility,
  game:
    r.kind === 'game'
      ? {
          opponent: r.opponent,
          home: r.home ?? true,
          competition: r.competition ?? '',
          status: r.game_status ?? 'scheduled',
          halfMinutes: r.half_minutes ?? 30,
          scoreUs: undef(r.score_us),
          scoreThem: undef(r.score_them),
          squad: r.squad ?? [],
          period: undef(r.period),
          periodStartedAt: undef(r.period_started_at),
        }
      : undefined,
})

export const fromEvent = (e: Omit<ClubEvent, 'id'> & { id?: string }): Row => ({
  ...(e.id ? { id: e.id } : {}),
  kind: e.kind,
  title: e.title,
  team_ids: e.teamIds,
  starts_at: e.start,
  ends_at: e.end,
  venue_id: e.venueId ?? null,
  meet_at: e.meetAt ?? null,
  rsvp_deadline: e.rsvpDeadline ?? null,
  description: e.description ?? null,
  cancelled: e.cancelled ?? false,
  cancel_reason: e.cancelReason ?? null,
  series_id: e.seriesId ?? null,
  rsvp_enabled: e.rsvpEnabled,
  visibility: e.visibility,
  opponent: e.game?.opponent ?? null,
  home: e.game?.home ?? null,
  competition: e.game?.competition ?? null,
  game_status: e.game?.status ?? null,
  half_minutes: e.game?.halfMinutes ?? null,
  squad: e.game?.squad ?? [],
})

const toRsvp = (r: Row): Rsvp => ({
  eventId: r.event_id,
  memberId: r.member_id,
  status: r.status,
  reason: undef(r.reason),
  comment: undef(r.comment),
  updatedAt: r.updated_at,
  updatedBy: r.updated_by ?? r.member_id,
})

const toAbsence = (r: Row): Absence => ({
  id: r.id,
  memberId: r.member_id,
  from: r.from_day,
  to: r.to_day,
  // Grund ist für Unbeteiligte maskiert
  reason: r.reason ?? 'sonstiges',
  note: undef(r.note),
})

const toAction = (r: Row): GameAction => ({
  id: r.id,
  eventId: r.event_id,
  at: r.at,
  period: r.period,
  minute: r.minute,
  side: r.side,
  type: r.type,
  shot: undef(r.shot),
  memberId: undef(r.member_id),
  text: undef(r.text),
})

const toNews = (r: Row): NewsPost => {
  const reactions: Record<string, string[]> = {}
  for (const x of r.news_reactions ?? []) (reactions[x.emoji] ??= []).push(x.member_id)
  const poll = one<Row>(r.polls)
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    authorId: r.author_id ?? '',
    createdAt: r.created_at,
    category: r.category,
    teamId: undef(r.team_id),
    pinned: r.pinned,
    visibility: r.visibility,
    reactions,
    poll: poll && {
      id: poll.id,
      question: poll.question,
      multi: poll.multi,
      closesAt: undef(poll.closes_at),
      options: [...(poll.poll_options ?? [])]
        .sort((a: Row, b: Row) => a.sort - b.sort)
        .map((o: Row) => ({ id: o.id, label: o.label, voterIds: (o.poll_votes ?? []).map((v: Row) => v.member_id) })),
    },
  }
}

const toHelperList = (r: Row): HelperList => ({
  id: r.id,
  title: r.title,
  description: undef(r.description),
  eventId: undef(r.event_id),
  venueId: undef(r.venue_id),
  date: r.day,
  createdBy: r.created_by ?? '',
  shifts: [...(r.helper_shifts ?? [])]
    .sort((a: Row, b: Row) => a.sort - b.sort || a.starts_at.localeCompare(b.starts_at))
    .map((s: Row) => ({
      id: s.id,
      title: s.title,
      start: s.starts_at,
      end: s.ends_at,
      slots: s.slots,
      icon: s.icon,
      signupIds: (s.shift_signups ?? []).map((x: Row) => x.member_id),
    })),
})

// ------------------------------------------------------------------ Adapter

export function createSupabaseApi(
  url: string,
  anonKey: string,
  /** Nur für Tests: festes Zugriffstoken statt Supabase-Auth */
  testing?: { accessToken: () => Promise<string | null> },
): Api {
  const sb = testing
    ? createClient(url, anonKey, { accessToken: testing.accessToken })
    : createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'skc-auth' },
      })

  const session = async (): Promise<Session | null> => {
    const { data } = await sb.auth.getSession()
    if (!data.session) return null
    const memberId = check(await sb.rpc('current_member_id')) as string | null
    return { memberId: memberId ?? null, email: data.session.user.email, demo: false }
  }

  const rpc = async (fn: string, args: Row) => {
    return check(await sb.rpc(fn, args))
  }

  return {
    mode: 'supabase',

    // ------------------------------------------------------------ Anmeldung
    getSession: session,
    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error('E-Mail oder Passwort stimmen nicht.')
      return (await session())!
    },
    async sendLoginCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
      if (error) throw new Error(error.status === 429 ? 'Zu viele Versuche – bitte kurz warten.' : error.message)
    },
    async verifyLoginCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
      if (error) throw new Error('Der Code ist falsch oder abgelaufen.')
      return (await session())!
    },
    async signInDemo() {
      throw new Error('Demo-Rollen gibt es nur im Demo-Modus.')
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async requestAccess(input) {
      check(
        await sb.from('access_requests').insert({
          name: input.name,
          email: input.email,
          kind: input.kind,
          gender: input.gender ?? null,
          team_id: input.teamId ?? null,
          child_name: input.childName ?? null,
          message: input.message ?? null,
        }),
      )
    },

    // ------------------------------------------------------------ Stammdaten
    async getClubData() {
      const [teams, venues, members] = await Promise.all([
        sb.from('teams').select('*').order('sort_order'),
        sb.from('venues').select('*').order('name'),
        sb.from('member_directory').select('*'),
      ])
      return {
        teams: check(teams).map(toTeam),
        venues: check(venues).map(toVenue),
        // Gäste sehen keine Mitglieder – das ist so gewollt
        members: (members.error ? [] : (members.data ?? [])).map(toMember),
      }
    },
    async updateMember(id, patch) {
      if (patch.phone !== undefined) await rpc('update_my_contact', { p_member_id: id, p_phone: patch.phone ?? '' })
    },

    // ------------------------------------------------------------ Termine
    async listEvents(from, to) {
      const rows = check(await sb.from('events').select('*').lte('starts_at', to).gte('ends_at', from).order('starts_at'))
      return rows.map(toEvent)
    },
    async getEvent(id) {
      const res = await sb.from('events').select('*').eq('id', id).maybeSingle()
      if (res.error) throw new Error(res.error.message)
      return res.data ? toEvent(res.data) : null
    },
    async saveEvent(input, options) {
      if (input.id) {
        const { id, ...rest } = fromEvent(input)
        void id
        // Spielstand/Status laufen über eigene Funktionen und werden hier nicht überschrieben
        delete rest.game_status
        return toEvent(check(await sb.from('events').update(rest).eq('id', input.id).select().single()))
      }
      if (options?.repeatWeeklyUntil) {
        const seriesId = crypto.randomUUID()
        const until = new Date(`${options.repeatWeeklyUntil}T23:59:59`).getTime()
        const start = new Date(input.start).getTime()
        const shift = (iso: string | undefined, by: number) => (iso ? new Date(new Date(iso).getTime() + by).toISOString() : undefined)
        const rows: Row[] = []
        for (let k = 0, s = start; s <= until && k < 60; k++, s = start + k * 7 * 86_400_000) {
          const by = s - start
          rows.push(
            fromEvent({ ...input, seriesId, start: shift(input.start, by)!, end: shift(input.end, by)!, meetAt: shift(input.meetAt, by), rsvpDeadline: shift(input.rsvpDeadline, by) }),
          )
        }
        const saved = check(await sb.from('events').insert(rows).select())
        return toEvent(saved[0])
      }
      return toEvent(check(await sb.from('events').insert(fromEvent(input)).select().single()))
    },
    async cancelEvent(id, reason) {
      await rpc('cancel_event', { p_event_id: id, p_reason: reason })
    },
    async deleteEvent(id) {
      check(await sb.from('events').delete().eq('id', id))
    },
    async setSquad(eventId, memberIds) {
      await rpc('set_squad', { p_event_id: eventId, p_member_ids: memberIds })
    },
    async remindOpen(eventId, memberIds) {
      return (await rpc('remind_open', { p_event_id: eventId, p_member_ids: memberIds })) as number
    },

    // ------------------------------------------------------------ Rückmeldungen
    async listRsvps(eventIds) {
      const parts = await Promise.all(chunks(eventIds).map((ids) => sb.from('rsvp_list').select('*').in('event_id', ids)))
      return parts.flatMap((p) => (p.error ? [] : (p.data ?? []).map(toRsvp)))
    },
    async setRsvp(input) {
      await rpc('set_rsvp', {
        p_event_id: input.eventId,
        p_member_id: input.memberId,
        p_status: input.status,
        p_reason: input.reason ?? null,
        p_comment: input.comment ?? null,
      })
    },
    async listAbsences() {
      const res = await sb.from('absence_list').select('*')
      return res.error ? [] : (res.data ?? []).map(toAbsence)
    },
    async addAbsence(input) {
      check(await sb.from('absences').insert({ member_id: input.memberId, from_day: input.from, to_day: input.to, reason: input.reason, note: input.note ?? null }))
    },
    async removeAbsence(id) {
      check(await sb.from('absences').delete().eq('id', id))
    },

    // ------------------------------------------------------------ Fahrgemeinschaften
    async listCarpools(eventId) {
      const rows = check(await sb.from('carpools').select('*, carpool_passengers(member_id)').eq('event_id', eventId).order('depart_at'))
      return rows.map(
        (r: Row): Carpool => ({
          id: r.id,
          eventId: r.event_id,
          driverId: r.driver_id,
          seats: r.seats,
          meetPoint: r.meet_point,
          departAt: r.depart_at,
          note: undef(r.note),
          passengerIds: (r.carpool_passengers ?? []).map((p: Row) => p.member_id),
        }),
      )
    },
    async offerCarpool(input) {
      check(await sb.from('carpools').insert({ event_id: input.eventId, driver_id: input.driverId, seats: input.seats, meet_point: input.meetPoint, depart_at: input.departAt, note: input.note ?? null }))
    },
    async joinCarpool(carpoolId, memberId) {
      await rpc('join_carpool', { p_carpool_id: carpoolId, p_member_id: memberId })
    },
    async leaveCarpool(carpoolId, memberId) {
      await rpc('leave_carpool', { p_carpool_id: carpoolId, p_member_id: memberId })
    },
    async removeCarpool(carpoolId) {
      check(await sb.from('carpools').delete().eq('id', carpoolId))
    },

    // ------------------------------------------------------------ Spiele
    async listGameActions(eventIds) {
      if (eventIds && eventIds.length === 0) return []
      if (!eventIds) return check(await sb.from('game_actions').select('*').order('at')).map(toAction)
      const parts = await Promise.all(chunks(eventIds).map((ids) => sb.from('game_actions').select('*').in('event_id', ids).order('at')))
      return parts.flatMap((p) => check(p).map(toAction)).sort((a, b) => a.at.localeCompare(b.at))
    },
    async addGameAction(a) {
      check(
        await sb.from('game_actions').insert({
          event_id: a.eventId,
          at: a.at,
          period: a.period,
          minute: a.minute,
          side: a.side,
          type: a.type,
          shot: a.shot ?? null,
          member_id: a.memberId ?? null,
          text: a.text ?? null,
        }),
      )
    },
    async removeGameAction(id) {
      check(await sb.from('game_actions').delete().eq('id', id))
    },
    async setGameStatus(eventId, status, period) {
      await rpc('set_game_status', { p_event_id: eventId, p_status: status, p_period: period ?? null })
    },
    async listLeagues() {
      const rows = check(await sb.from('leagues').select('*, league_rows(*)'))
      return rows.map(
        (l: Row): League => ({
          id: l.id,
          name: l.name,
          season: l.season,
          teamId: l.team_id,
          rows: [...(l.league_rows ?? [])]
            .sort((a: Row, b: Row) => a.sort - b.sort || b.points - a.points)
            .map((r: Row) => ({
              team: r.team,
              played: r.played,
              won: r.won,
              drawn: r.drawn,
              lost: r.lost,
              goalsFor: r.goals_for,
              goalsAgainst: r.goals_against,
              points: r.points,
              isUs: r.is_us,
            })),
        }),
      )
    },

    // ------------------------------------------------------------ Helferlisten
    async listHelperLists() {
      const res = await sb.from('helper_lists').select('*, helper_shifts(*, shift_signups(member_id))').order('day')
      return res.error ? [] : (res.data ?? []).map(toHelperList)
    },
    async saveHelperList(input) {
      await rpc('save_helper_list', {
        p_title: input.title,
        p_description: input.description ?? null,
        p_day: input.date,
        p_venue_id: input.venueId ?? null,
        p_event_id: input.eventId ?? null,
        p_shifts: input.shifts.map((s) => ({ title: s.title, starts_at: s.start, ends_at: s.end, slots: s.slots, icon: s.icon })),
      })
    },
    async signupShift(shiftId, memberId) {
      await rpc('signup_shift', { p_shift_id: shiftId, p_member_id: memberId })
    },
    async leaveShift(shiftId, memberId) {
      await rpc('leave_shift', { p_shift_id: shiftId, p_member_id: memberId })
    },

    // ------------------------------------------------------------ News
    async listNews() {
      const rows = check(
        await sb
          .from('news')
          .select('*, news_reactions(member_id, emoji), polls(*, poll_options(*, poll_votes(member_id)))')
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100),
      )
      return rows.map(toNews)
    },
    async createPost(input) {
      await rpc('create_post', {
        p_title: input.title,
        p_body: input.body,
        p_category: input.category,
        p_team_id: input.teamId ?? null,
        p_pinned: !!input.pinned,
        p_visibility: input.visibility,
        p_poll_question: input.poll?.question ?? null,
        p_poll_options: input.poll?.options ?? null,
        p_poll_multi: input.poll?.multi ?? false,
      })
    },
    async deletePost(id) {
      check(await sb.from('news').delete().eq('id', id))
    },
    async toggleReaction(postId, emoji) {
      await rpc('toggle_reaction', { p_post_id: postId, p_emoji: emoji })
    },
    async vote(pollId, optionIds) {
      await rpc('vote', { p_poll_id: pollId, p_option_ids: optionIds })
    },
    async listSpecials() {
      const rows = check(await sb.from('specials').select('*, special_codes(code)').order('sort'))
      return rows.map(
        (r: Row): Special => ({
          id: r.id,
          title: r.title,
          description: r.description,
          partner: r.partner,
          category: r.category,
          code: one<Row>(r.special_codes)?.code,
          url: undef(r.url),
          validUntil: undef(r.valid_until),
          highlight: r.highlight,
        }),
      )
    },

    // ------------------------------------------------------------ Benachrichtigungen
    async savePushSubscription(sub, prefs) {
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Ungültiges Push-Abo')
      await rpc('save_push_subscription', { p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth, p_prefs: prefs })
    },
    async listNotifications() {
      const res = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
      return (res.error ? [] : (res.data ?? [])).map(
        (r: Row): AppNotification => ({ id: r.id, memberId: r.member_id, createdAt: r.created_at, kind: r.kind, title: r.title, body: r.body, link: undef(r.link), read: r.read }),
      )
    },
    async markNotificationsRead(ids) {
      if (ids.length) check(await sb.from('notifications').update({ read: true }).in('id', ids))
    },

    // ------------------------------------------------------------ Verwaltung
    async listAccessRequests() {
      const rows = check(await sb.from('access_requests').select('*').order('created_at', { ascending: false }))
      return rows.map(
        (r: Row): AccessRequest => ({
          id: r.id,
          name: r.name,
          email: r.email,
          kind: r.kind,
          gender: undef(r.gender),
          teamId: undef(r.team_id),
          childName: undef(r.child_name),
          message: undef(r.message),
          createdAt: r.created_at,
          status: r.status,
        }),
      )
    },
    async resolveAccessRequest(id, approve) {
      await rpc('resolve_access_request', { p_id: id, p_approve: approve })
    },

    // ------------------------------------------------------------ Realtime
    subscribe(onChange) {
      const emit = (scope: ChangeScope) => () => onChange(scope)
      const channel = sb
        .channel('skc-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, emit('events'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_actions' }, emit('gameActions'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, emit('notifications'))
        .subscribe()
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') onChange('all')
      })
      return () => {
        void sb.removeChannel(channel)
        data.subscription.unsubscribe()
      }
    },
  }
}
