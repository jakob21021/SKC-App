// Demo-Datenquelle: Alle Daten liegen lokal im Browser (localStorage).
// Änderungen werden per BroadcastChannel an andere Tabs gemeldet – so lässt sich
// z. B. der Live-Ticker in zwei Fenstern gleichzeitig ausprobieren.
import { differenceInDays } from 'date-fns'
import type { Api, ChangeScope } from '../api'
import type { ClubEvent, ID, Member, Session } from '../types'
import { createSeed, DEMO_VERSION, type DemoDb } from './seed'
import { rosterFor } from '@/lib/attendance'
import { score } from '@/lib/korfball'
import { uid } from '@/lib/util'

const DB_KEY = 'skc-demo-db'
const SESSION_KEY = 'skc-demo-session'
const MAX_AGE_DAYS = 21

const clone = <T,>(v: T): T => structuredClone(v)
const now = () => new Date().toISOString()

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Speicher voll oder privat – Demo läuft dann nur im Arbeitsspeicher weiter.
  }
}

function loadDb(): DemoDb {
  const stored = read<DemoDb>(DB_KEY)
  const fresh =
    stored && stored.version === DEMO_VERSION && differenceInDays(new Date(), new Date(stored.seededAt)) < MAX_AGE_DAYS
  const db = fresh ? stored : createSeed()
  // Vergessene Live-Spiele nach 3 Stunden automatisch beenden
  for (const e of db.events) {
    if (e.game && (e.game.status === 'live' || e.game.status === 'halftime')) {
      if (Date.now() - new Date(e.start).getTime() > 3 * 3600_000) e.game.status = 'finished'
    }
  }
  if (!fresh) write(DB_KEY, db)
  return db
}

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms))

export function createDemoApi(): Api & { reset(): void } {
  let db = loadDb()
  const listeners = new Set<(s: ChangeScope) => void>()
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('skc-demo') : null

  channel?.addEventListener('message', (e: MessageEvent<ChangeScope>) => {
    db = read<DemoDb>(DB_KEY) ?? db
    listeners.forEach((l) => l(e.data))
  })

  const commit = (...scopes: ChangeScope[]) => {
    write(DB_KEY, db)
    for (const s of scopes) {
      listeners.forEach((l) => l(s))
      channel?.postMessage(s)
    }
  }

  const session = () => read<Session>(SESSION_KEY)
  const me = (): Member | undefined => db.members.find((m) => m.id === session()?.memberId)
  const requireMe = () => {
    const m = me()
    if (!m) throw new Error('Bitte melde dich an.')
    return m
  }
  const findEvent = (id: ID) => {
    const e = db.events.find((x) => x.id === id)
    if (!e) throw new Error('Termin nicht gefunden')
    return e
  }
  /** Mitglieder plus deren Eltern benachrichtigen */
  const notify = (memberIds: ID[], n: { kind: DemoDb['notifications'][number]['kind']; title: string; body: string; link?: string }) => {
    const self = session()?.memberId
    const targets = new Set<ID>()
    for (const id of memberIds) {
      targets.add(id)
      db.members.filter((p) => p.parentOf.includes(id)).forEach((p) => targets.add(p.id))
    }
    targets.delete(self ?? '')
    for (const memberId of targets) {
      db.notifications.push({ id: uid('nt-'), memberId, createdAt: now(), read: false, ...n })
    }
  }
  const recomputeScore = (eventId: ID) => {
    const ev = db.events.find((e) => e.id === eventId)
    if (!ev?.game) return
    const s = score(db.gameActions.filter((a) => a.eventId === eventId))
    ev.game.scoreUs = s.us
    ev.game.scoreThem = s.them
  }

  return {
    mode: 'demo',

    reset() {
      db = createSeed()
      write(DB_KEY, db)
      commit('all')
    },

    // ------------------------------------------------------------ Anmeldung
    async getSession() {
      return session()
    },
    async signInDemo(memberId) {
      const s: Session = { memberId, demo: true, email: db.members.find((m) => m.id === memberId)?.email }
      write(SESSION_KEY, s)
      return s
    },
    async signInWithPassword(email) {
      await wait(400)
      const m = db.members.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase())
      if (!m) throw new Error('Im Demo-Modus bitte eine der Demo-Rollen wählen.')
      return this.signInDemo(m.id)
    },
    async sendLoginCode(email) {
      await wait(400)
      if (!db.members.some((m) => m.email?.toLowerCase() === email.trim().toLowerCase())) {
        throw new Error('Diese E-Mail kennt die Demo nicht – wähle unten eine Demo-Rolle.')
      }
    },
    async verifyLoginCode(email, code) {
      await wait(300)
      if (!/^\d{6}$/.test(code.trim())) throw new Error('Bitte den 6-stelligen Code eingeben.')
      return this.signInWithPassword(email, code)
    },
    async signOut() {
      write(SESSION_KEY, null)
    },
    async requestAccess(input) {
      await wait(300)
      db.accessRequests.push({ ...input, id: uid('ar-'), createdAt: now(), status: 'open' })
      db.members
        .filter((m) => m.roles.includes('admin'))
        .forEach((m) => db.notifications.push({ id: uid('nt-'), memberId: m.id, createdAt: now(), read: false, kind: 'system', title: 'Neue Zugangsanfrage', body: `${input.name} möchte der App beitreten.`, link: '/verwaltung' }))
      commit('requests', 'notifications')
    },

    // ------------------------------------------------------------ Stammdaten
    async getClubData() {
      return clone({ teams: db.teams, venues: db.venues, members: db.members })
    },
    async updateMember(id, patch) {
      const m = db.members.find((x) => x.id === id)
      if (m) Object.assign(m, patch)
      commit('members')
    },

    // ------------------------------------------------------------ Termine
    async listEvents(from, to) {
      const loggedIn = !!session()
      return clone(
        db.events.filter((e) => e.end >= from && e.start <= to && (loggedIn || e.visibility === 'public')),
      )
    },
    async getEvent(id) {
      return clone(db.events.find((e) => e.id === id) ?? null)
    },
    async saveEvent(input, options) {
      requireMe()
      const base: ClubEvent = { ...input, id: input.id ?? uid('ev-') }
      const existing = db.events.findIndex((e) => e.id === base.id)
      if (existing >= 0) {
        db.events[existing] = base
      } else if (options?.repeatWeeklyUntil) {
        const seriesId = uid('series-')
        const until = new Date(`${options.repeatWeeklyUntil}T23:59:59`)
        const duration = new Date(base.end).getTime() - new Date(base.start).getTime()
        const meetOffset = base.meetAt ? new Date(base.start).getTime() - new Date(base.meetAt).getTime() : null
        const deadlineOffset = base.rsvpDeadline ? new Date(base.start).getTime() - new Date(base.rsvpDeadline).getTime() : null
        for (let start = new Date(base.start); start <= until; start = new Date(start.getTime() + 7 * 86_400_000)) {
          const s = start.getTime()
          db.events.push({
            ...base,
            id: uid('ev-'),
            seriesId,
            start: new Date(s).toISOString(),
            end: new Date(s + duration).toISOString(),
            meetAt: meetOffset != null ? new Date(s - meetOffset).toISOString() : undefined,
            rsvpDeadline: deadlineOffset != null ? new Date(s - deadlineOffset).toISOString() : undefined,
          })
        }
      } else {
        db.events.push(base)
        const roster = rosterFor(base, db.members)
        notify(roster.map((m) => m.id), {
          kind: base.kind === 'game' ? 'game' : 'event',
          title: base.kind === 'game' ? 'Neues Spiel angesetzt' : 'Neuer Termin',
          body: base.title,
          link: `/termine/${base.id}`,
        })
      }
      db.events.sort((a, b) => a.start.localeCompare(b.start))
      commit('events', 'notifications')
      return clone(db.events.find((e) => e.id === base.id) ?? base)
    },
    async cancelEvent(id, reason) {
      requireMe()
      const ev = findEvent(id)
      ev.cancelled = true
      ev.cancelReason = reason
      notify(rosterFor(ev, db.members).map((m) => m.id), { kind: 'event', title: `Abgesagt: ${ev.title}`, body: reason || 'Der Termin fällt aus.', link: `/termine/${id}` })
      commit('events', 'notifications')
    },
    async deleteEvent(id) {
      requireMe()
      db.events = db.events.filter((e) => e.id !== id)
      db.rsvps = db.rsvps.filter((r) => r.eventId !== id)
      commit('events', 'rsvps')
    },
    async setSquad(eventId, memberIds) {
      requireMe()
      const ev = findEvent(eventId)
      if (!ev.game) return
      const added = memberIds.filter((m) => !ev.game!.squad.includes(m))
      ev.game.squad = memberIds
      notify(added, { kind: 'game', title: 'Du bist nominiert! 🏆', body: `${ev.title} – bitte sag zu oder ab.`, link: `/termine/${eventId}` })
      commit('events', 'notifications')
    },
    async remindOpen(eventId, memberIds) {
      requireMe()
      const ev = findEvent(eventId)
      notify(memberIds, { kind: 'reminder', title: 'Rückmeldung fehlt', body: `Bitte sag für „${ev.title}“ zu oder ab.`, link: `/termine/${eventId}` })
      commit('notifications')
      return memberIds.length
    },

    // ------------------------------------------------------------ Rückmeldungen
    async listRsvps(eventIds) {
      const ids = new Set(eventIds)
      return clone(db.rsvps.filter((r) => ids.has(r.eventId)))
    },
    async setRsvp(input) {
      const actor = requireMe()
      db.rsvps = db.rsvps.filter((r) => !(r.eventId === input.eventId && r.memberId === input.memberId))
      db.rsvps.push({ ...input, updatedAt: now(), updatedBy: actor.id })
      commit('rsvps')
    },
    async listAbsences() {
      return clone(db.absences)
    },
    async addAbsence(input) {
      requireMe()
      db.absences.push({ ...input, id: uid('abs-') })
      commit('absences')
    },
    async removeAbsence(id) {
      db.absences = db.absences.filter((a) => a.id !== id)
      commit('absences')
    },

    // ------------------------------------------------------------ Fahrgemeinschaften
    async listCarpools(eventId) {
      return clone(db.carpools.filter((c) => c.eventId === eventId))
    },
    async offerCarpool(input) {
      requireMe()
      db.carpools.push({ ...input, id: uid('cp-'), passengerIds: [] })
      commit('carpools')
    },
    async joinCarpool(carpoolId, memberId) {
      const c = db.carpools.find((x) => x.id === carpoolId)
      if (!c) return
      if (c.passengerIds.length >= c.seats) throw new Error('Leider schon voll.')
      // Pro Termin nur eine Mitfahrgelegenheit pro Person
      db.carpools.filter((x) => x.eventId === c.eventId).forEach((x) => (x.passengerIds = x.passengerIds.filter((p) => p !== memberId)))
      c.passengerIds.push(memberId)
      notify([c.driverId], { kind: 'event', title: 'Neue Mitfahrt', body: `${db.members.find((m) => m.id === memberId)?.firstName ?? 'Jemand'} fährt bei dir mit.`, link: `/termine/${c.eventId}` })
      commit('carpools', 'notifications')
    },
    async leaveCarpool(carpoolId, memberId) {
      const c = db.carpools.find((x) => x.id === carpoolId)
      if (c) c.passengerIds = c.passengerIds.filter((p) => p !== memberId)
      commit('carpools')
    },
    async removeCarpool(carpoolId) {
      db.carpools = db.carpools.filter((c) => c.id !== carpoolId)
      commit('carpools')
    },

    // ------------------------------------------------------------ Spiele
    async listGameActions(eventIds) {
      const ids = eventIds ? new Set(eventIds) : null
      return clone(db.gameActions.filter((a) => !ids || ids.has(a.eventId)).sort((a, b) => a.at.localeCompare(b.at)))
    },
    async addGameAction(action) {
      requireMe()
      db.gameActions.push({ ...action, id: uid('ga-') })
      recomputeScore(action.eventId)
      commit('gameActions', 'events')
    },
    async removeGameAction(id) {
      requireMe()
      const a = db.gameActions.find((x) => x.id === id)
      db.gameActions = db.gameActions.filter((x) => x.id !== id)
      if (a) recomputeScore(a.eventId)
      commit('gameActions', 'events')
    },
    async setGameStatus(eventId, status, period) {
      requireMe()
      const ev = findEvent(eventId)
      if (!ev.game) return
      const wasScheduled = ev.game.status === 'scheduled'
      ev.game.status = status
      if (period) {
        ev.game.period = period
        ev.game.periodStartedAt = now()
      }
      recomputeScore(eventId)
      if (status === 'live' && wasScheduled) {
        notify(
          db.members.filter((m) => m.teamIds.some((t) => ev.teamIds.includes(t))).map((m) => m.id),
          { kind: 'game', title: '🔴 Live: Anpfiff!', body: ev.title, link: `/termine/${eventId}` },
        )
      }
      commit('events', 'notifications')
    },
    async listLeagues() {
      return clone(db.leagues)
    },

    // ------------------------------------------------------------ Helferlisten
    async listHelperLists() {
      return clone(db.helperLists)
    },
    async saveHelperList(input) {
      const actor = requireMe()
      const list = { ...input, id: uid('hl-'), createdBy: actor.id, shifts: input.shifts.map((s) => ({ ...s, id: uid('sh-'), signupIds: [] })) }
      db.helperLists.push(list)
      notify(db.members.filter((m) => !m.birthYear || m.birthYear < 2008).map((m) => m.id), { kind: 'helper', title: 'Helfer:innen gesucht', body: list.title, link: `/helfen/${list.id}` })
      commit('helpers', 'notifications')
    },
    async signupShift(shiftId, memberId) {
      for (const l of db.helperLists) {
        const s = l.shifts.find((x) => x.id === shiftId)
        if (!s) continue
        if (s.signupIds.length >= s.slots) throw new Error('Diese Schicht ist schon voll.')
        if (!s.signupIds.includes(memberId)) s.signupIds.push(memberId)
      }
      commit('helpers')
    },
    async leaveShift(shiftId, memberId) {
      for (const l of db.helperLists) {
        const s = l.shifts.find((x) => x.id === shiftId)
        if (s) s.signupIds = s.signupIds.filter((m) => m !== memberId)
      }
      commit('helpers')
    },

    // ------------------------------------------------------------ News
    async listNews() {
      const loggedIn = !!session()
      return clone(
        db.news
          .filter((n) => loggedIn || n.visibility === 'public')
          .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt.localeCompare(a.createdAt)),
      )
    },
    async createPost(input) {
      const actor = requireMe()
      const id = uid('n-')
      db.news.push({
        id,
        title: input.title,
        body: input.body,
        category: input.category,
        teamId: input.teamId,
        pinned: input.pinned,
        visibility: input.visibility,
        authorId: actor.id,
        createdAt: now(),
        reactions: {},
        poll: input.poll && {
          id: uid('p-'),
          question: input.poll.question,
          multi: input.poll.multi,
          options: input.poll.options.map((label) => ({ id: uid('po-'), label, voterIds: [] })),
        },
      })
      const audience = input.teamId ? db.members.filter((m) => m.teamIds.includes(input.teamId!)) : db.members
      notify(audience.map((m) => m.id), { kind: 'news', title: input.poll ? 'Neue Umfrage' : 'Neuigkeit', body: input.title, link: `/news/${id}` })
      commit('news', 'notifications')
    },
    async deletePost(id) {
      db.news = db.news.filter((n) => n.id !== id)
      commit('news')
    },
    async toggleReaction(postId, emoji) {
      const actor = requireMe()
      const post = db.news.find((n) => n.id === postId)
      if (!post) return
      const list = post.reactions[emoji] ?? []
      post.reactions[emoji] = list.includes(actor.id) ? list.filter((x) => x !== actor.id) : [...list, actor.id]
      commit('news')
    },
    async vote(pollId, optionIds) {
      const actor = requireMe()
      const poll = db.news.find((n) => n.poll?.id === pollId)?.poll
      if (!poll) return
      for (const o of poll.options) {
        o.voterIds = o.voterIds.filter((v) => v !== actor.id)
        if (optionIds.includes(o.id)) o.voterIds.push(actor.id)
      }
      commit('news')
    },
    async listSpecials() {
      return clone(db.specials)
    },

    // ------------------------------------------------------------ Benachrichtigungen
    async savePushSubscription() {
      // Im Demo-Modus gibt es keinen Server, der Pushs verschickt.
    },
    async listNotifications() {
      const id = session()?.memberId
      return clone(db.notifications.filter((n) => n.memberId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    async markNotificationsRead(ids) {
      const set = new Set(ids)
      db.notifications.forEach((n) => set.has(n.id) && (n.read = true))
      commit('notifications')
    },

    // ------------------------------------------------------------ Verwaltung
    async listAccessRequests() {
      return clone(db.accessRequests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    },
    async resolveAccessRequest(id, approve) {
      requireMe()
      const r = db.accessRequests.find((x) => x.id === id)
      if (!r) return
      r.status = approve ? 'approved' : 'rejected'
      if (approve) {
        const [firstName, ...rest] = r.name.split(' ')
        db.members.push({
          id: uid('m-'),
          firstName,
          lastName: rest.join(' ') || '–',
          gender: r.gender,
          email: r.email,
          teamIds: r.kind === 'player' && r.teamId ? [r.teamId] : [],
          coachOf: r.kind === 'coach' && r.teamId ? [r.teamId] : [],
          roles: [r.kind === 'parent' ? 'parent' : r.kind === 'coach' ? 'coach' : 'player'],
          parentOf: [],
          avatarHue: Math.floor(Math.random() * 360),
        })
      }
      commit('requests', 'members')
    },

    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
}
