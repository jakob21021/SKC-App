// @vitest-environment node
// Integrationstest des Supabase-Adapters gegen Postgres + PostgREST.
// Läuft nur über `npm run test:api` (setzt SKC_IT_REST/SKC_IT_SECRET).
import { createHmac } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSupabaseApi } from './supabaseApi'
import type { Api } from '../api'

const REST = process.env.SKC_IT_REST
const SECRET = process.env.SKC_IT_SECRET ?? ''

const USERS = {
  lena: '00000000-0000-0000-0000-00000000000a',
  tim: '00000000-0000-0000-0000-00000000000b',
  sabine: '00000000-0000-0000-0000-00000000000c',
  andrea: '00000000-0000-0000-0000-00000000000d',
}
const M = {
  lena: '10000000-0000-0000-0000-000000000001',
  max: '10000000-0000-0000-0000-000000000002',
  tim: '10000000-0000-0000-0000-000000000003',
  sabine: '10000000-0000-0000-0000-000000000004',
  mia: '10000000-0000-0000-0000-000000000005',
}
const EV = {
  training: '20000000-0000-0000-0000-000000000001',
  trainingD: '20000000-0000-0000-0000-000000000002',
  game: '20000000-0000-0000-0000-000000000004',
}

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jwt(claims: object) {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ ...claims, exp: Math.floor(Date.now() / 1000) + 3600 })
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

let server: Server
let base = ''
const ANON = () => jwt({ role: 'anon' })
const as = (user: keyof typeof USERS | null): Api =>
  createSupabaseApi(base, ANON(), { accessToken: async () => (user ? jwt({ role: 'authenticated', sub: USERS[user] }) : null) })

describe.skipIf(!REST)('Supabase-Adapter (Integration)', () => {
  beforeAll(async () => {
    // Supabase stellt PostgREST unter /rest/v1 bereit – hier nachgebildet
    server = createServer(async (req, res) => {
      const chunks: Buffer[] = []
      for await (const c of req) chunks.push(c as Buffer)
      const headers = { ...req.headers } as Record<string, string>
      delete headers.host
      delete headers['content-length']
      const up = await fetch(REST + req.url!.replace(/^\/rest\/v1/, ''), {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      })
      const out = Object.fromEntries([...up.headers].filter(([k]) => !['transfer-encoding', 'content-encoding', 'content-length'].includes(k)))
      res.writeHead(up.status, out)
      res.end(Buffer.from(await up.arrayBuffer()))
    })
    await new Promise<void>((r) => server.listen(0, r))
    base = `http://localhost:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  const range = () => [new Date(Date.now() - 30 * 86_400_000).toISOString(), new Date(Date.now() + 60 * 86_400_000).toISOString()] as const

  it('Gast: Stammdaten und nur öffentliche Termine, keine Mitglieder', async () => {
    const api = as(null)
    const club = await api.getClubData()
    expect(club.teams.map((t) => t.name)).toContain('1. Mannschaft')
    expect(club.teams[0].sortOrder).toBe(1)
    expect(club.members).toEqual([])
    const events = await api.listEvents(...range())
    expect(events.map((e) => e.id)).toEqual([EV.training])
    expect(await api.listRsvps([EV.training])).toEqual([])
    await api.requestAccess({ name: 'Gast Fan', email: 'fan@test.de', kind: 'fan' })
    const specials = await api.listSpecials()
    expect(specials[0].title).toContain('Teamwear')
  })

  it('Spielerin: Verzeichnis, Zu-/Absage mit Grund, Rechte', async () => {
    const api = as('lena')
    const club = await api.getClubData()
    const lena = club.members.find((m) => m.id === M.lena)!
    expect(lena.teamIds).toHaveLength(1)
    expect(lena.phone).toBe('0170 111')
    expect(club.members.find((m) => m.id === M.max)!.phone).toBeUndefined()
    expect(club.members.find((m) => m.id === M.sabine)!.parentOf).toEqual([M.mia])

    const events = await api.listEvents(...range())
    expect(events.length).toBe(4)
    const game = events.find((e) => e.id === EV.game)!
    expect(game.game).toMatchObject({ opponent: 'KV Adler Rauxel', home: true, status: 'scheduled', halfMinutes: 30, squad: [] })

    await api.setRsvp({ eventId: EV.training, memberId: M.lena, status: 'no', reason: 'krank', comment: 'Grippe' })
    const rsvps = await api.listRsvps([EV.training])
    expect(rsvps).toMatchObject([{ memberId: M.lena, status: 'no', reason: 'krank', comment: 'Grippe', updatedBy: M.lena }])

    await expect(api.setRsvp({ eventId: EV.training, memberId: M.max, status: 'yes' })).rejects.toThrow(/nur für dich/)
    await expect(api.saveEvent({ ...game, id: undefined, title: 'Hack' })).rejects.toThrow()
    await expect(api.addGameAction({ eventId: EV.game, at: new Date().toISOString(), period: 1, minute: 1, side: 'us', type: 'goal' })).rejects.toThrow()

    await api.addAbsence({ memberId: M.lena, from: '2030-01-01', to: '2030-01-10', reason: 'urlaub', note: 'Ski' })
    const abs = await api.listAbsences()
    expect(abs).toMatchObject([{ memberId: M.lena, reason: 'urlaub', note: 'Ski' }])
    await api.updateMember(M.lena, { phone: '0170 999' })
  })

  it('Trainer: Termine, Serien, Kader, Live-Ticker, Erinnern, Absage', async () => {
    const api = as('tim')
    const club = await api.getClubData()
    const t1 = club.teams.find((t) => t.short === '1. M')!.id
    expect(club.members.find((m) => m.id === M.lena)!.phone).toBe('0170 999')
    expect((await api.listRsvps([EV.training]))[0].reason).toBe('krank')

    const start = new Date(Date.now() + 7 * 86_400_000)
    const ev = await api.saveEvent({
      kind: 'game',
      title: 'SKC – TuS Test',
      teamIds: [t1],
      start: start.toISOString(),
      end: new Date(start.getTime() + 2 * 3600_000).toISOString(),
      rsvpEnabled: true,
      visibility: 'public',
      game: { opponent: 'TuS Test', home: true, competition: 'Pokal', status: 'scheduled', halfMinutes: 25, squad: [] },
    })
    expect(ev.game?.opponent).toBe('TuS Test')

    const first = await api.saveEvent(
      { kind: 'training', title: 'Athletik', teamIds: [t1], start: start.toISOString(), end: new Date(start.getTime() + 3600_000).toISOString(), rsvpEnabled: true, visibility: 'members' },
      { repeatWeeklyUntil: new Date(start.getTime() + 21 * 86_400_000).toISOString().slice(0, 10) },
    )
    const all = await api.listEvents(...range())
    expect(all.filter((e) => e.seriesId && e.seriesId === first.seriesId)).toHaveLength(4)

    await api.saveEvent({ ...ev, title: 'SKC – TuS Test (Pokal)' })
    expect((await api.getEvent(ev.id))!.title).toBe('SKC – TuS Test (Pokal)')

    await api.setSquad(EV.game, [M.lena, M.max])
    await api.setGameStatus(EV.game, 'live', 1)
    await api.addGameAction({ eventId: EV.game, at: new Date().toISOString(), period: 1, minute: 2, side: 'us', type: 'goal', shot: 'distance', memberId: M.lena })
    await api.addGameAction({ eventId: EV.game, at: new Date().toISOString(), period: 1, minute: 3, side: 'them', type: 'goal' })
    await api.addGameAction({ eventId: EV.game, at: new Date().toISOString(), period: 1, minute: 4, side: 'us', type: 'miss', shot: 'penalty', memberId: M.max })
    const live = (await api.getEvent(EV.game))!
    expect(live.game).toMatchObject({ status: 'live', period: 1, scoreUs: 1, scoreThem: 1, squad: [M.lena, M.max] })
    expect(live.game!.periodStartedAt).toBeTruthy()
    const actions = await api.listGameActions([EV.game])
    expect(actions.map((a) => a.type)).toEqual(['goal', 'goal', 'miss'])
    await api.removeGameAction(actions[1].id)
    expect((await api.getEvent(EV.game))!.game!.scoreThem).toBe(0)

    expect(await api.remindOpen(EV.training, [M.max])).toBe(1)
    await api.cancelEvent(EV.training, 'Halle gesperrt')
    expect((await api.getEvent(EV.training))!).toMatchObject({ cancelled: true, cancelReason: 'Halle gesperrt' })

    await api.offerCarpool({ eventId: EV.game, driverId: M.tim, seats: 1, meetPoint: 'Halle', departAt: new Date().toISOString() })
  })

  it('Spielerin: Fahrgemeinschaft, Benachrichtigungen', async () => {
    const api = as('lena')
    const [cp] = await api.listCarpools(EV.game)
    await api.joinCarpool(cp.id, M.lena)
    expect((await api.listCarpools(EV.game))[0].passengerIds).toEqual([M.lena])
    const notes = await api.listNotifications()
    expect(notes.map((n) => n.title)).toEqual(expect.arrayContaining(['Du bist nominiert! 🏆', '🔴 Live: Anpfiff!', 'Abgesagt: Training 1. M']))
    await api.markNotificationsRead(notes.map((n) => n.id))
    expect((await api.listNotifications()).every((n) => n.read)).toBe(true)
  })

  it('Elternteil: antwortet für das Kind, sieht keine fremden Gründe', async () => {
    const api = as('sabine')
    await api.setRsvp({ eventId: EV.trainingD, memberId: M.mia, status: 'no', reason: 'schule' })
    const list = await api.listRsvps([EV.trainingD, EV.training])
    expect(list.find((r) => r.memberId === M.mia)).toMatchObject({ reason: 'schule', updatedBy: M.sabine })
    expect(list.find((r) => r.memberId === M.lena)?.reason).toBeUndefined()
    expect((await api.listAbsences()).find((a) => a.memberId === M.lena)?.reason).toBe('sonstiges')
  })

  it('Vorstand: Helferliste, Beitrag mit Umfrage, Zugänge', async () => {
    const api = as('andrea')
    await api.saveHelperList({
      title: 'Heimspieltag',
      date: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      shifts: [
        { title: 'Kasse', start: new Date().toISOString(), end: new Date().toISOString(), slots: 2, icon: 'cash' },
        { title: 'Kuchen', start: new Date().toISOString(), end: new Date().toISOString(), slots: 3, icon: 'cake' },
      ],
    })
    await api.createPost({ title: 'Weihnachten', body: 'Abstimmen!', category: 'Verein', visibility: 'public', pinned: true, poll: { question: 'Wohin?', options: ['Bowling', 'Essen'], multi: false } })
    const requests = await api.listAccessRequests()
    expect(requests.map((r) => r.email)).toEqual(expect.arrayContaining(['fan@test.de']))
    await api.resolveAccessRequest(requests.find((r) => r.email === 'fan@test.de')!.id, true)
    expect((await api.getClubData()).members.some((m) => m.email === 'fan@test.de')).toBe(true)
  })

  it('Spielerin: Helferschicht, Reaktion und Abstimmung', async () => {
    const api = as('lena')
    const [list] = (await api.listHelperLists()).filter((l) => l.title === 'Heimspieltag' && l.shifts.length === 2)
    expect(list.shifts.map((s) => s.title)).toEqual(['Kasse', 'Kuchen'])
    await api.signupShift(list.shifts[0].id, M.lena)
    expect((await api.listHelperLists()).find((l) => l.id === list.id)!.shifts[0].signupIds).toEqual([M.lena])

    const post = (await api.listNews()).find((n) => n.title === 'Weihnachten')!
    expect(post.pinned).toBe(true)
    expect(post.poll?.options.map((o) => o.label)).toEqual(['Bowling', 'Essen'])
    await api.toggleReaction(post.id, '🔥')
    await api.vote(post.poll!.id, [post.poll!.options[1].id])
    const again = (await api.listNews()).find((n) => n.id === post.id)!
    expect(again.reactions['🔥']).toEqual([M.lena])
    expect(again.poll!.options[1].voterIds).toEqual([M.lena])
    await expect(api.vote(post.poll!.id, post.poll!.options.map((o) => o.id))).rejects.toThrow(/Nur eine Antwort/)
  })
})
