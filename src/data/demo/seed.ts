// Erzeugt einen realistischen, aber frei erfundenen Demo-Datenbestand relativ zum heutigen Datum.
// Alle Personen sind fiktiv. Gegner-Ergebnisse und Tabellen sind Beispieldaten.
import { addDays, addMinutes, format, set, startOfWeek, subMinutes } from 'date-fns'
import type {
  AbsenceReason,
  AccessRequest,
  Absence,
  AppNotification,
  Carpool,
  ClubEvent,
  GameAction,
  Gender,
  HelperList,
  League,
  Member,
  NewsPost,
  Rsvp,
  ShotType,
  Special,
  StandingRow,
  Team,
  Venue,
} from '../types'
import { club } from '@/config/club'

export const DEMO_VERSION = 3

export interface DemoDb {
  version: number
  seededAt: string
  teams: Team[]
  venues: Venue[]
  members: Member[]
  events: ClubEvent[]
  rsvps: Rsvp[]
  absences: Absence[]
  carpools: Carpool[]
  helperLists: HelperList[]
  news: NewsPost[]
  specials: Special[]
  gameActions: GameAction[]
  leagues: League[]
  notifications: AppNotification[]
  accessRequests: AccessRequest[]
}

export const PERSONAS = [
  { id: 'm-lena', role: 'Spielerin', who: 'Lena Hoffmann', detail: '1. Mannschaft, Trikot 7' },
  { id: 'm-tim', role: 'Trainer', who: 'Tim Schäfer', detail: '1. Mannschaft & A-Jugend' },
  { id: 'm-sabine', role: 'Elternteil', who: 'Sabine Krüger', detail: 'Mia (D-Jugend) & Paul (F-Jugend)' },
  { id: 'm-andrea', role: 'Vorstand', who: 'Andrea Wolff', detail: '1. Vorsitzende, Admin' },
] as const

function prng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FEMALE = 'Anna Lea Hannah Sophie Marie Emma Laura Julia Lisa Sarah Johanna Clara Katharina Nele Paula Jana Carla Pia Frieda Ida Lina Emily Merle Maja Greta Charlotte Luisa Svenja Kim Jule Theresa Annika Franziska Vanessa Melina Romy Mila Ella Leni Thea'.split(' ')
const MALE = 'Lukas Jonas Felix Niklas Leon Finn Ben Tom Moritz Jan David Julian Simon Max Elias Noah Luca Erik Henrik Malte Philipp Fabian Kevin Dennis Marvin Tobias Sebastian Florian Marco Ole Mats Anton Emil Theo Linus Till Lasse Hannes Jannik Nils'.split(' ')
const LAST = 'Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Koch Richter Klein Schröder Neumann Schwarz Zimmermann Braun Hartmann Lange Werner Krause Lehmann Schulze Köhler Herrmann König Walter Kaiser Peters Scholz Möller Jung Hahn Vogel Friedrich Keller Günther Frank Berger Winkler Roth Beck Lorenz Baumann Franke Albrecht Schuster Ludwig Böhm Winter Kraus Schumacher Vogt Stein Jäger Otto Sommer Seidel Heinrich Brandt Haas Schreiber Graf Schulte Dietrich Ziegler Kuhn Pohl Engel Horn Busch Bergmann Voigt Sauer Arnold Pfeiffer Kröger Overbeck Brinkmann Terhorst'.split(' ')

const TEAMS: Team[] = [
  { id: 't1', name: '1. Mannschaft', short: '1. M', ageGroup: 'Senioren', league: 'Korfball-Bundesliga', sortOrder: 1, trainingDefault: 'open' },
  { id: 't2', name: '2. Mannschaft', short: '2. M', ageGroup: 'Senioren', league: 'Verbandsliga', sortOrder: 2, trainingDefault: 'open' },
  { id: 'ta', name: 'A-Jugend', short: 'A', ageGroup: 'A-Jugend', league: 'A-Jugend-Liga (U19)', sortOrder: 3, trainingDefault: 'open' },
  { id: 'tc', name: 'C-Jugend', short: 'C', ageGroup: 'C-Jugend', league: 'C-Jugend-Liga (U15)', sortOrder: 4, trainingDefault: 'open' },
  { id: 'td', name: 'D-Jugend', short: 'D', ageGroup: 'D-Jugend', league: 'D-Jugend-Liga (U13)', sortOrder: 5, trainingDefault: 'open' },
  { id: 'tf', name: 'F-Jugend (Minis)', short: 'F', ageGroup: 'F-Jugend', sortOrder: 6, trainingDefault: 'yes' },
  { id: 'th', name: 'Hobby', short: 'Hobby', ageGroup: 'Hobby', sortOrder: 7, trainingDefault: 'yes' },
]

const VENUES: Venue[] = [
  { id: 'v-home', name: 'Sporthalle Bodelschwingher Straße', street: 'Bodelschwingher Str. 35', city: '44577 Castrop-Rauxel', mapsQuery: 'Bodelschwingher Str. 35, 44577 Castrop-Rauxel', notes: 'Eingang über den Schulhof. Umkleiden im Untergeschoss.' },
  { id: 'v-asg', name: 'ASG-Halle', city: 'Castrop-Rauxel', mapsQuery: 'Adalbert-Stifter-Gymnasium Castrop-Rauxel', notes: 'Hallenschuhe mit heller Sohle Pflicht.' },
  { id: 'v-heim', name: 'Vereinsheim', street: 'Bodelschwingher Str. 35', city: '44577 Castrop-Rauxel', mapsQuery: 'Bodelschwingher Str. 35, 44577 Castrop-Rauxel' },
  { id: 'v-adler', name: 'Halle KV Adler Rauxel', city: 'Castrop-Rauxel', mapsQuery: 'KV Adler Rauxel Sporthalle' },
  { id: 'v-schildgen', name: 'Sporthalle TuS Schildgen', city: 'Bergisch Gladbach', mapsQuery: 'TuS Schildgen Korfball Sporthalle' },
  { id: 'v-pegasus', name: 'Sporthalle SG Pegasus Rommerscheid', city: 'Bergisch Gladbach', mapsQuery: 'SG Pegasus Rommerscheid Sporthalle' },
  { id: 'v-albatros', name: 'Halle KC Albatros', city: 'Castrop-Rauxel', mapsQuery: 'KC Albatros Castrop-Rauxel Halle' },
  { id: 'v-gw', name: 'Halle KC Grün-Weiß', city: 'Castrop-Rauxel', mapsQuery: 'KC Grün-Weiß Castrop-Rauxel Halle' },
]

const OPP_VENUE: Record<string, string> = {
  'KV Adler Rauxel': 'v-adler',
  'TuS Schildgen': 'v-schildgen',
  'SG Pegasus Rommerscheid': 'v-pegasus',
  'KC Albatros Castrop-Rauxel': 'v-albatros',
  'KC Grün-Weiß Castrop-Rauxel': 'v-gw',
}

export function createSeed(now = new Date()): DemoDb {
  const rnd = prng(1967)
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]
  const chance = (p: number) => rnd() < p
  const iso = (d: Date) => d.toISOString()
  const week0 = startOfWeek(now, { weekStartsOn: 1 })
  /** Zeitpunkt in Woche `w` (relativ zu dieser Woche), Wochentag `dow` (0 = Montag) */
  const at = (w: number, dow: number, h: number, m = 0) =>
    set(addDays(week0, w * 7 + dow), { hours: h, minutes: m, seconds: 0, milliseconds: 0 })

  // ---------------------------------------------------------------- Mitglieder
  const members: Member[] = []
  const usedNames = new Set<string>(['Lena Hoffmann', 'Tim Schäfer', 'Sabine Krüger', 'Mia Krüger', 'Paul Krüger', 'Andrea Wolff'])
  const newName = (g: Gender) => {
    for (;;) {
      const first = pick(g === 'w' ? FEMALE : MALE)
      const last = pick(LAST)
      const n = `${first} ${last}`
      if (!usedNames.has(n)) {
        usedNames.add(n)
        return { firstName: first, lastName: last }
      }
    }
  }
  const add = (m: Partial<Member> & Pick<Member, 'firstName' | 'lastName' | 'gender'>): Member => {
    const full: Member = {
      id: m.id ?? `m-${members.length + 1}`,
      teamIds: [],
      coachOf: [],
      roles: ['player'],
      parentOf: [],
      avatarHue: Math.floor(rnd() * 360),
      ...m,
    }
    members.push(full)
    return full
  }

  // Persona-Accounts
  add({ id: 'm-lena', firstName: 'Lena', lastName: 'Hoffmann', gender: 'w', birthYear: 2001, jerseyNumber: 7, teamIds: ['t1'], email: 'lena@example.org', avatarHue: 350 })
  add({ id: 'm-tim', firstName: 'Tim', lastName: 'Schäfer', gender: 'm', birthYear: 1988, teamIds: [], coachOf: ['t1', 'ta'], roles: ['coach'], title: 'Trainer 1. Mannschaft & A-Jugend', email: 'tim@example.org', avatarHue: 210 })
  add({ id: 'm-andrea', firstName: 'Andrea', lastName: 'Wolff', gender: 'w', birthYear: 1975, teamIds: [], roles: ['board', 'admin'], title: '1. Vorsitzende', email: 'andrea@example.org', avatarHue: 140 })
  add({ id: 'm-sabine', firstName: 'Sabine', lastName: 'Krüger', gender: 'w', birthYear: 1983, teamIds: ['th'], roles: ['player', 'parent'], parentOf: ['m-mia', 'm-paul'], email: 'sabine@example.org', avatarHue: 30 })
  add({ id: 'm-mia', firstName: 'Mia', lastName: 'Krüger', gender: 'w', birthYear: 2014, teamIds: ['td'], jerseyNumber: 11, avatarHue: 300 })
  add({ id: 'm-paul', firstName: 'Paul', lastName: 'Krüger', gender: 'm', birthYear: 2019, teamIds: ['tf'], avatarHue: 190 })

  const roster: { team: string; w: number; m: number; years: [number, number]; numbers?: boolean }[] = [
    { team: 't1', w: 7, m: 7, years: [1993, 2006], numbers: true },
    { team: 't2', w: 6, m: 6, years: [1984, 2007], numbers: true },
    { team: 'ta', w: 5, m: 5, years: [2008, 2009], numbers: true },
    { team: 'tc', w: 5, m: 5, years: [2012, 2013] },
    { team: 'td', w: 5, m: 5, years: [2014, 2015] },
    { team: 'tf', w: 4, m: 4, years: [2018, 2020] },
    { team: 'th', w: 5, m: 5, years: [1968, 1996] },
  ]
  for (const r of roster) {
    const usedNumbers = new Set(members.filter((m) => m.teamIds.includes(r.team)).map((m) => m.jerseyNumber))
    for (const g of ['w', 'm'] as Gender[]) {
      const existing = members.filter((m) => m.teamIds.includes(r.team) && m.gender === g).length
      for (let i = existing; i < r[g]; i++) {
        let jerseyNumber: number | undefined
        if (r.numbers) {
          do jerseyNumber = 1 + Math.floor(rnd() * 30)
          while (usedNumbers.has(jerseyNumber))
          usedNumbers.add(jerseyNumber)
        }
        add({
          ...newName(g),
          gender: g,
          birthYear: r.years[0] + Math.floor(rnd() * (r.years[1] - r.years[0] + 1)),
          teamIds: [r.team],
          jerseyNumber,
        })
      }
    }
  }
  const inTeam = (t: string) => members.filter((m) => m.teamIds.includes(t))

  // A-Jugendliche helfen in der 2. Mannschaft aus
  inTeam('ta').slice(0, 2).forEach((m) => m.teamIds.push('t2'))
  // Funktionen im Verein
  const t2Coach = inTeam('t2').find((m) => m.gender === 'm')!
  t2Coach.coachOf = ['t2']
  t2Coach.roles = ['player', 'coach']
  t2Coach.title = 'Spielertrainer 2. Mannschaft'
  const youthCoaches = inTeam('t1').filter((m) => m.id !== 'm-lena').slice(0, 3)
  ;[['tc'], ['td'], ['tf']].forEach((teams, i) => {
    youthCoaches[i].coachOf = teams
    youthCoaches[i].roles = ['player', 'coach']
    youthCoaches[i].title = `Trainer:in ${TEAMS.find((t) => t.id === teams[0])!.name}`
  })
  const hobby = inTeam('th').filter((m) => m.id !== 'm-sabine')
  hobby[0].roles = ['player', 'board']
  hobby[0].title = 'Kassenwart:in'
  hobby[1].roles = ['player', 'board']
  hobby[1].title = 'Jugendwart:in'
  // Weitere Eltern für Jugendteams
  for (const t of ['tc', 'td', 'tf']) {
    for (const kid of inTeam(t).slice(1, 3)) {
      const g: Gender = chance(0.5) ? 'w' : 'm'
      add({ firstName: pick(g === 'w' ? FEMALE : MALE), lastName: kid.lastName, gender: g, birthYear: 1978 + Math.floor(rnd() * 12), roles: ['parent'], parentOf: [kid.id] })
    }
  }

  // ---------------------------------------------------------------- Termine
  const events: ClubEvent[] = []
  const slots: { team: string; dow: number; h: number; m: number; dur: number; venue: string }[] = [
    { team: 't1', dow: 1, h: 19, m: 30, dur: 120, venue: 'v-home' },
    { team: 't1', dow: 3, h: 19, m: 30, dur: 120, venue: 'v-home' },
    { team: 't2', dow: 2, h: 19, m: 30, dur: 90, venue: 'v-asg' },
    { team: 'ta', dow: 0, h: 17, m: 30, dur: 90, venue: 'v-home' },
    { team: 'ta', dow: 3, h: 17, m: 30, dur: 90, venue: 'v-asg' },
    { team: 'tc', dow: 1, h: 17, m: 0, dur: 90, venue: 'v-asg' },
    { team: 'td', dow: 2, h: 17, m: 0, dur: 90, venue: 'v-home' },
    { team: 'tf', dow: 4, h: 16, m: 0, dur: 60, venue: 'v-home' },
    { team: 'th', dow: 4, h: 19, m: 0, dur: 120, venue: 'v-home' },
  ]
  for (let w = -8; w <= 10; w++) {
    for (const s of slots) {
      const start = at(w, s.dow, s.h, s.m)
      const team = TEAMS.find((t) => t.id === s.team)!
      events.push({
        id: `tr-${s.team}-${format(start, 'yyyyMMdd')}`,
        kind: 'training',
        title: `Training ${team.name}`,
        teamIds: [s.team],
        start: iso(start),
        end: iso(addMinutes(start, s.dur)),
        venueId: s.venue,
        rsvpDeadline: iso(subMinutes(start, 180)),
        seriesId: `series-${s.team}-${s.dow}`,
        rsvpEnabled: true,
        visibility: 'public',
      })
    }
  }
  const cancelled = events.find((e) => e.id === `tr-t1-${format(at(1, 3, 0), 'yyyyMMdd')}`)
  if (cancelled) {
    cancelled.cancelled = true
    cancelled.cancelReason = 'Halle wegen Elternsprechtag gesperrt. Wir laufen stattdessen am Samstag eine Runde – Infos folgen.'
  }

  const gameEvents: { ev: ClubEvent; result?: [number, number] }[] = []
  const game = (o: {
    id: string
    team: string
    when: Date
    opponent: string
    home: boolean
    competition: string
    result?: [number, number]
    halfMinutes?: number
    description?: string
    squad?: string[]
  }) => {
    const team = TEAMS.find((t) => t.id === o.team)!
    const half = o.halfMinutes ?? 30
    const ev: ClubEvent = {
      id: o.id,
      kind: 'game',
      title: o.home ? `${club.name} – ${o.opponent}` : `${o.opponent} – ${club.name}`,
      teamIds: [o.team],
      start: iso(o.when),
      end: iso(addMinutes(o.when, half * 2 + 25)),
      venueId: o.home ? 'v-home' : (OPP_VENUE[o.opponent.replace(/ \d$/, '')] ?? 'v-home'),
      meetAt: iso(subMinutes(o.when, o.home ? 60 : 90)),
      rsvpDeadline: iso(subMinutes(o.when, 48 * 60)),
      rsvpEnabled: true,
      visibility: 'public',
      description: o.description ?? `${team.name} · ${o.competition}`,
      game: {
        opponent: o.opponent,
        home: o.home,
        competition: o.competition,
        status: o.result ? 'finished' : 'scheduled',
        halfMinutes: half,
        scoreUs: o.result?.[0],
        scoreThem: o.result?.[1],
        squad: o.squad ?? [],
      },
    }
    events.push(ev)
    gameEvents.push({ ev, result: o.result })
    return ev
  }

  const BL = 'Bundesliga'
  game({ id: 'g-t1-1', team: 't1', when: at(-7, 5, 18), opponent: 'TuS Schildgen', home: true, competition: BL, result: [22, 19] })
  game({ id: 'g-t1-2', team: 't1', when: at(-5, 6, 15), opponent: 'SG Pegasus Rommerscheid', home: false, competition: BL, result: [18, 20] })
  game({ id: 'g-t1-3', team: 't1', when: at(-3, 5, 17), opponent: 'KC Albatros Castrop-Rauxel', home: true, competition: BL, result: [25, 14] })
  game({ id: 'g-t1-4', team: 't1', when: at(-1, 6, 14), opponent: 'KV Adler Rauxel', home: false, competition: BL, result: [23, 22], description: 'Stadtderby!' })
  const t1Squad = (() => {
    const w = inTeam('t1').filter((m) => m.gender === 'w').slice(0, 6)
    const m = inTeam('t1').filter((m) => m.gender === 'm').slice(0, 6)
    if (!w.some((x) => x.id === 'm-lena')) w[5] = members.find((x) => x.id === 'm-lena')!
    return [...w, ...m].map((x) => x.id)
  })()
  const derby = game({ id: 'g-t1-5', team: 't1', when: at(1, 5, 18), opponent: 'KC Grün-Weiß Castrop-Rauxel', home: true, competition: BL, description: 'Stadtderby! Bringt Familie & Freunde mit – volle Halle, volle Stimmung.', squad: t1Squad })
  game({ id: 'g-t1-6', team: 't1', when: at(3, 6, 15), opponent: 'TuS Schildgen', home: false, competition: BL })
  game({ id: 'g-t1-7', team: 't1', when: at(5, 5, 17), opponent: 'SG Pegasus Rommerscheid', home: true, competition: BL })
  game({ id: 'g-t1-8', team: 't1', when: at(7, 5, 16), opponent: 'KC Albatros Castrop-Rauxel', home: false, competition: BL })
  game({ id: 'g-t1-9', team: 't1', when: at(9, 6, 14), opponent: 'KV Adler Rauxel', home: true, competition: BL })

  const VL = 'Verbandsliga'
  game({ id: 'g-t2-1', team: 't2', when: at(-6, 6, 12), opponent: 'KC Albatros Castrop-Rauxel 2', home: false, competition: VL, result: [15, 15] })
  game({ id: 'g-t2-2', team: 't2', when: at(-2, 5, 15), opponent: 'KC Grün-Weiß Castrop-Rauxel 2', home: true, competition: VL, result: [19, 13] })
  const liveHour = now.getHours() >= 9 && now.getHours() <= 21
  const liveGame = game({
    id: 'g-t2-live',
    team: 't2',
    when: liveHour ? subMinutes(now, 43) : set(addDays(now, -1), { hours: 15, minutes: 0, seconds: 0, milliseconds: 0 }),
    opponent: 'KV Adler Rauxel 2',
    home: true,
    competition: VL,
    result: liveHour ? undefined : [17, 16],
  })
  game({ id: 'g-t2-3', team: 't2', when: at(2, 6, 12), opponent: 'TuS Schildgen 2', home: false, competition: VL })
  game({ id: 'g-t2-4', team: 't2', when: at(6, 5, 15), opponent: 'SG Pegasus Rommerscheid 2', home: true, competition: VL })

  game({ id: 'g-ta-1', team: 'ta', when: at(-4, 6, 11), opponent: 'KV Adler Rauxel', home: true, competition: 'A-Jugend-Liga', result: [16, 12], halfMinutes: 25 })
  game({ id: 'g-ta-2', team: 'ta', when: at(2, 6, 11), opponent: 'TuS Schildgen', home: false, competition: 'A-Jugend-Liga', halfMinutes: 25 })
  game({ id: 'g-td-1', team: 'td', when: at(1, 6, 11), opponent: 'KC Albatros Castrop-Rauxel', home: false, competition: 'D-Jugend-Liga', halfMinutes: 20 })
  game({ id: 'g-tf-1', team: 'tf', when: at(4, 5, 10), opponent: 'Mini-Spielfest (mehrere Vereine)', home: true, competition: 'Spielfest', halfMinutes: 10, description: 'Spielfest für alle Minis – ohne Tabelle, mit ganz viel Spaß. Eltern bitte Kuchen mitbringen 🍰' })

  const clubEvent = (id: string, title: string, start: Date, mins: number, venueId: string, description: string, visibility: ClubEvent['visibility'] = 'members') =>
    events.push({ id, kind: 'club', title, teamIds: [], start: iso(start), end: iso(addMinutes(start, mins)), venueId, description, rsvpEnabled: true, visibility, rsvpDeadline: iso(addDays(start, -3)) })
  clubEvent('c-mv', 'Mitgliederversammlung', at(3, 4, 19, 30), 120, 'v-heim', 'Tagesordnung: Berichte des Vorstands, Kassenbericht, Entlastung, Wahlen, Hallenzeiten 2027, Verschiedenes. Anträge bitte bis eine Woche vorher an den Vorstand.')
  clubEvent('c-fest', 'Herbstfest & Saisonfeier', at(4, 5, 15), 420, 'v-heim', 'Grillen, Kinderspiele, Korfball-Spaßturnier für alle Generationen und abends Party. Freunde & Familie sind herzlich willkommen!', 'public')
  clubEvent('c-turnier', 'SKC-Jugendturnier', at(6, 5, 9), 480, 'v-home', 'Unser großes Hallenturnier für C- bis F-Jugend mit Teams aus ganz NRW. Wir brauchen viele helfende Hände!', 'public')
  clubEvent('c-xmas', 'Weihnachtsfeier', at(10, 4, 18), 240, 'v-heim', 'Gemütlicher Jahresabschluss mit Wichteln. Jede:r bringt ein Geschenk im Wert von ca. 10 € mit.')

  // ---------------------------------------------------------------- Spielverläufe (Live-Ticker)
  const gameActions: GameAction[] = []
  const SHOT_WEIGHTS: [ShotType, number][] = [['distance', 0.36], ['close', 0.28], ['running_in', 0.16], ['penalty', 0.14], ['free_pass', 0.06]]
  const HIT_RATE: Record<ShotType, number> = { distance: 0.24, close: 0.42, running_in: 0.55, penalty: 0.72, free_pass: 0.6 }
  const pickShot = (): ShotType => {
    let r = rnd()
    for (const [s, w] of SHOT_WEIGHTS) if ((r -= w) <= 0) return s
    return 'distance'
  }
  let actionSeq = 0
  const pushAction = (a: Omit<GameAction, 'id'>) => gameActions.push({ id: `ga-${++actionSeq}`, ...a })
  const simulate = (ev: ClubEvent, us: number, them: number, untilMinute?: number, winner?: { memberId: string; shot: ShotType }) => {
    const half = ev.game!.halfMinutes
    const total = half * 2
    const end = untilMinute ?? total
    const scorers = ev.game!.squad.length ? members.filter((m) => ev.game!.squad.includes(m.id)) : inTeam(ev.teamIds[0])
    const weights = scorers.map((m, i) => (m.id === 'm-lena' ? 2.2 : 0.6 + ((i * 7919) % 10) / 10))
    const pickScorer = () => {
      let r = rnd() * weights.reduce((a, b) => a + b, 0)
      for (let i = 0; i < scorers.length; i++) if ((r -= weights[i]) <= 0) return scorers[i]
      return scorers[0]
    }
    const timeOf = (minute: number) => {
      const start = new Date(ev.start).getTime()
      const pause = minute > half ? 10 : 0
      return new Date(start + (minute + pause) * 60_000).toISOString()
    }
    const sides: ('us' | 'them')[] = [...Array(us).fill('us'), ...Array(them).fill('them')]
    for (let i = sides.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[sides[i], sides[j]] = [sides[j], sides[i]]
    }
    if (winner && sides[sides.length - 1] !== 'us') {
      const i = sides.lastIndexOf('us')
      ;[sides[i], sides[sides.length - 1]] = [sides[sides.length - 1], sides[i]]
    }
    const minutes = sides.map(() => 1 + Math.floor(rnd() * (end - 1))).sort((a, b) => a - b)
    pushAction({ eventId: ev.id, at: timeOf(0), period: 1, minute: 0, side: 'us', type: 'period', text: 'Anpfiff' })
    let halftimeLogged = false
    sides.forEach((side, i) => {
      const isWinner = winner && i === sides.length - 1
      const minute = isWinner ? end - 1 : minutes[i]
      if (!halftimeLogged && minute > half) {
        pushAction({ eventId: ev.id, at: timeOf(half), period: 1, minute: half, side: 'us', type: 'period', text: 'Halbzeit' })
        pushAction({ eventId: ev.id, at: timeOf(half + 0.01), period: 2, minute: half, side: 'us', type: 'period', text: 'Anpfiff 2. Halbzeit' })
        halftimeLogged = true
      }
      const period: 1 | 2 = minute > half ? 2 : 1
      if (side === 'us') {
        // Fehlwürfe bis zum Treffer – je nach Wurfart unterschiedlich wahrscheinlich
        let shot = isWinner ? winner.shot : pickShot()
        for (let k = 0; k < 6 && !isWinner && rnd() > HIT_RATE[shot]; k++) {
          pushAction({ eventId: ev.id, at: timeOf(minute - 0.2), period, minute, side: 'us', type: 'miss', shot, memberId: pickScorer().id })
          shot = pickShot()
        }
        pushAction({
          eventId: ev.id,
          at: timeOf(minute),
          period,
          minute,
          side: 'us',
          type: 'goal',
          shot,
          memberId: isWinner ? winner.memberId : pickScorer().id,
        })
      } else {
        pushAction({ eventId: ev.id, at: timeOf(minute), period, minute, side: 'them', type: 'goal' })
      }
    })
    if (!halftimeLogged && end > half) {
      pushAction({ eventId: ev.id, at: timeOf(half), period: 1, minute: half, side: 'us', type: 'period', text: 'Halbzeit' })
      pushAction({ eventId: ev.id, at: timeOf(half + 0.01), period: 2, minute: half, side: 'us', type: 'period', text: 'Anpfiff 2. Halbzeit' })
    }
    if (untilMinute == null) {
      pushAction({ eventId: ev.id, at: timeOf(total), period: 2, minute: total, side: 'us', type: 'period', text: 'Abpfiff' })
    }
  }
  for (const { ev, result } of gameEvents) {
    if (!result) continue
    simulate(ev, result[0], result[1], undefined, ev.id === 'g-t1-4' ? { memberId: 'm-lena', shot: 'distance' } : undefined)
  }
  if (liveHour) {
    // Laufendes Spiel: 2. Halbzeit seit wenigen Minuten
    const half = liveGame.game!.halfMinutes
    const periodStart = subMinutes(now, 3)
    simulate(liveGame, 12, 11, half + 3)
    liveGame.game!.status = 'live'
    liveGame.game!.period = 2
    liveGame.game!.periodStartedAt = iso(periodStart)
    liveGame.game!.scoreUs = 12
    liveGame.game!.scoreThem = 11
  }

  // ---------------------------------------------------------------- Rückmeldungen
  const REASONS: AbsenceReason[] = ['krank', 'arbeit', 'schule', 'privat', 'urlaub', 'verletzt']
  const rsvps: Rsvp[] = []
  const rosterOf = (ev: ClubEvent) => {
    if (ev.game?.squad.length) return members.filter((m) => ev.game!.squad.includes(m.id))
    if (ev.teamIds.length === 0) return members.filter((m) => m.teamIds.length > 0)
    return members.filter((m) => m.teamIds.some((t) => ev.teamIds.includes(t)))
  }
  const keepOpen = new Set<string>()
  const upcomingFor = (memberId: string) =>
    events
      .filter((e) => new Date(e.start) > now && rosterOf(e).some((m) => m.id === memberId) && !e.cancelled)
      .sort((a, b) => a.start.localeCompare(b.start))
  for (const id of ['m-lena', 'm-mia', 'm-paul']) upcomingFor(id).slice(0, 2).forEach((e) => keepOpen.add(`${e.id}|${id}`))
  keepOpen.add(`${derby.id}|m-lena`)

  for (const ev of events) {
    if (!ev.rsvpEnabled || ev.cancelled) continue
    const start = new Date(ev.start)
    const daysAhead = (start.getTime() - now.getTime()) / 86_400_000
    const optOut = ev.kind === 'training' && TEAMS.some((t) => ev.teamIds.includes(t.id) && t.trainingDefault === 'yes')
    for (const m of rosterOf(ev)) {
      if (keepOpen.has(`${ev.id}|${m.id}`)) continue
      const respondP = daysAhead < 0 ? 0.95 : daysAhead < 7 ? 0.6 : daysAhead < 21 ? 0.2 : 0.05
      if (!chance(optOut ? respondP * 0.15 : respondP)) continue
      const r = rnd()
      const status = optOut ? 'no' : r < 0.76 ? 'yes' : r < 0.92 ? 'no' : 'maybe'
      rsvps.push({
        eventId: ev.id,
        memberId: m.id,
        status,
        reason: status === 'no' ? pick(REASONS) : undefined,
        comment: status === 'maybe' ? pick(['Komme evtl. später', 'Muss noch Schicht klären', 'Entscheide spontan']) : status === 'no' && chance(0.3) ? pick(['Klausurphase', 'Familienfeier', 'Knie zwickt noch']) : undefined,
        updatedAt: iso(subMinutes(start, 60 * (24 + Math.floor(rnd() * 96)))),
        updatedBy: m.parentOf.length ? m.id : (members.find((p) => p.parentOf.includes(m.id))?.id ?? m.id),
      })
    }
  }
  // ---------------------------------------------------------------- Abwesenheiten
  const day = (d: Date) => format(d, 'yyyy-MM-dd')
  const absences: Absence[] = []
  const t1Players = inTeam('t1').filter((m) => m.id !== 'm-lena')
  absences.push({ id: 'abs-1', memberId: t1Players[2].id, from: day(addDays(now, -10)), to: day(addDays(now, 18)), reason: 'verletzt', note: 'Bänderdehnung – Reha läuft' })
  absences.push({ id: 'abs-2', memberId: inTeam('t2')[3].id, from: day(addDays(now, 3)), to: day(addDays(now, 12)), reason: 'urlaub', note: 'Herbsturlaub' })
  absences.push({ id: 'abs-3', memberId: inTeam('ta')[1].id, from: day(addDays(now, 5)), to: day(addDays(now, 9)), reason: 'schule', note: 'Klassenfahrt' })

  // ---------------------------------------------------------------- Fahrgemeinschaften
  const awayT1 = events.find((e) => e.id === 'g-t1-6')!
  const awayTd = events.find((e) => e.id === 'g-td-1')!
  const tdKids = inTeam('td')
  const tdParent = members.find((m) => m.parentOf.includes(tdKids[1].id))!
  const carpools: Carpool[] = [
    { id: 'cp-1', eventId: awayT1.id, driverId: t1Players[0].id, seats: 4, meetPoint: 'Parkplatz Sporthalle Bodelschwingher Str.', departAt: iso(subMinutes(new Date(awayT1.start), 120)), note: 'Platz für 2 Taschen im Kofferraum', passengerIds: [t1Players[4].id] },
    { id: 'cp-2', eventId: awayT1.id, driverId: t1Players[6].id, seats: 3, meetPoint: 'Schwerin, Kirche', departAt: iso(subMinutes(new Date(awayT1.start), 110)), passengerIds: [] },
    { id: 'cp-3', eventId: awayTd.id, driverId: tdParent.id, seats: 4, meetPoint: 'Vor der Halle', departAt: iso(subMinutes(new Date(awayTd.start), 60)), note: 'Kindersitze vorhanden', passengerIds: [tdKids[1].id, tdKids[3].id] },
  ]

  // ---------------------------------------------------------------- Helferlisten
  const derbyStart = new Date(derby.start)
  const shiftAt = (base: Date, h: number, m = 0) => iso(set(base, { hours: h, minutes: m, seconds: 0, milliseconds: 0 }))
  const adults = members.filter((m) => !m.birthYear || m.birthYear < 2008)
  const someAdults = (n: number) => {
    const out: string[] = []
    while (out.length < n) {
      const id = pick(adults).id
      if (!out.includes(id) && id !== 'm-lena' && id !== 'm-sabine') out.push(id)
    }
    return out
  }
  const fest = new Date(events.find((e) => e.id === 'c-fest')!.start)
  const turnier = new Date(events.find((e) => e.id === 'c-turnier')!.start)
  const helperLists: HelperList[] = [
    {
      id: 'hl-derby',
      title: 'Heimspieltag: Derby gegen Grün-Weiß',
      description: 'Volle Halle erwartet! Jede helfende Hand zählt – Helfer:innen bekommen Getränke gratis.',
      eventId: derby.id,
      venueId: 'v-home',
      date: day(derbyStart),
      createdBy: 'm-andrea',
      shifts: [
        { id: 'sh-1', title: 'Hallenaufbau', icon: 'wrench', start: shiftAt(derbyStart, 16), end: shiftAt(derbyStart, 17), slots: 4, signupIds: someAdults(2) },
        { id: 'sh-2', title: 'Kampfgericht & Zeitnahme', icon: 'clock', start: shiftAt(derbyStart, 17, 30), end: shiftAt(derbyStart, 20), slots: 2, signupIds: someAdults(1) },
        { id: 'sh-3', title: 'Kasse & Einlass', icon: 'cash', start: shiftAt(derbyStart, 17), end: shiftAt(derbyStart, 19), slots: 2, signupIds: someAdults(2) },
        { id: 'sh-4', title: 'Kuchen- & Getränkeverkauf', icon: 'cake', start: shiftAt(derbyStart, 17), end: shiftAt(derbyStart, 20), slots: 3, signupIds: someAdults(1) },
        { id: 'sh-5', title: 'Kuchen spenden', icon: 'heart', start: shiftAt(derbyStart, 17), end: shiftAt(derbyStart, 17), slots: 6, signupIds: someAdults(3) },
        { id: 'sh-6', title: 'Abbau & Fegen', icon: 'broom', start: shiftAt(derbyStart, 20), end: shiftAt(derbyStart, 21), slots: 4, signupIds: [] },
      ],
    },
    {
      id: 'hl-fest',
      title: 'Herbstfest & Saisonfeier',
      description: 'Damit alle feiern können, teilen wir uns die Arbeit in kurze Schichten.',
      eventId: 'c-fest',
      venueId: 'v-heim',
      date: day(fest),
      createdBy: 'm-andrea',
      shifts: [
        { id: 'sh-7', title: 'Grill', icon: 'grill', start: shiftAt(fest, 16), end: shiftAt(fest, 18), slots: 2, signupIds: someAdults(2) },
        { id: 'sh-8', title: 'Grill', icon: 'grill', start: shiftAt(fest, 18), end: shiftAt(fest, 20), slots: 2, signupIds: someAdults(1) },
        { id: 'sh-9', title: 'Kinderschminken & Spiele', icon: 'heart', start: shiftAt(fest, 15), end: shiftAt(fest, 17), slots: 3, signupIds: someAdults(1) },
        { id: 'sh-10', title: 'Fotos für Social Media', icon: 'camera', start: shiftAt(fest, 15), end: shiftAt(fest, 18), slots: 1, signupIds: [] },
        { id: 'sh-11', title: 'Aufräumen', icon: 'broom', start: shiftAt(fest, 21), end: shiftAt(fest, 22), slots: 5, signupIds: someAdults(1) },
      ],
    },
    {
      id: 'hl-turnier',
      title: 'SKC-Jugendturnier',
      description: 'Unser größtes Event im Jahr. Bitte tragt euch für mindestens eine Schicht ein – Eltern ausdrücklich erwünscht!',
      eventId: 'c-turnier',
      venueId: 'v-home',
      date: day(turnier),
      createdBy: 'm-andrea',
      shifts: [
        { id: 'sh-12', title: 'Turnierleitung', icon: 'clock', start: shiftAt(turnier, 8, 30), end: shiftAt(turnier, 13), slots: 2, signupIds: someAdults(1) },
        { id: 'sh-13', title: 'Turnierleitung', icon: 'clock', start: shiftAt(turnier, 13), end: shiftAt(turnier, 17), slots: 2, signupIds: [] },
        { id: 'sh-14', title: 'Cafeteria', icon: 'cake', start: shiftAt(turnier, 9), end: shiftAt(turnier, 12), slots: 3, signupIds: someAdults(1) },
        { id: 'sh-15', title: 'Cafeteria', icon: 'cake', start: shiftAt(turnier, 12), end: shiftAt(turnier, 15), slots: 3, signupIds: [] },
        { id: 'sh-16', title: 'Schiedsrichter:in', icon: 'clock', start: shiftAt(turnier, 9), end: shiftAt(turnier, 17), slots: 4, signupIds: someAdults(2) },
      ],
    },
  ]

  // ---------------------------------------------------------------- News & Umfragen
  const lastDerby = events.find((e) => e.id === 'g-t1-4')!
  const news: NewsPost[] = [
    {
      id: 'n-welcome',
      title: 'Willkommen in der neuen SKC-App! 🎉',
      body: 'Ab sofort laufen Zu- und Absagen, Helferlisten, Fahrgemeinschaften und Vereinsnews über diese App.\n\nSo geht’s los:\n• App über „Teilen → Zum Home-Bildschirm“ installieren\n• Benachrichtigungen erlauben\n• Abwesenheiten (Urlaub, Verletzung) einmal eintragen – dann wirst du automatisch abgemeldet\n\nFeedback gerne direkt an den Vorstand!',
      authorId: 'm-andrea',
      createdAt: iso(addDays(now, -2)),
      category: 'Info',
      pinned: true,
      visibility: 'public',
      reactions: { '👍': someAdults(9), '❤️': someAdults(5), '🔥': someAdults(3) },
    },
    {
      id: 'n-derby',
      title: 'Derby-Krimi in Rauxel: 23:22-Auswärtssieg!',
      body: 'Was für ein Spiel! 60 Minuten auf Augenhöhe, kein Team konnte sich absetzen. Beim Stand von 22:22 behielt Lena Hoffmann die Nerven und traf in der letzten Minute per Fernwurf zum Sieg.\n\nDanke an alle mitgereisten Fans – ihr wart lauter als die Heimfans! 💪\n\nAlle Körbe und Wurfquoten findet ihr im Live-Ticker des Spiels.',
      authorId: 'm-tim',
      createdAt: iso(addMinutes(new Date(lastDerby.end), 90)),
      category: 'Spielbericht',
      teamId: 't1',
      visibility: 'public',
      reactions: { '🔥': someAdults(14), '👏': someAdults(8), '❤️': someAdults(4) },
    },
    {
      id: 'n-weihnacht',
      title: 'Umfrage: Wie feiern wir Weihnachten?',
      body: 'Wir planen die Weihnachtsfeier. Stimmt bis Ende des Monats ab!',
      authorId: 'm-andrea',
      createdAt: iso(addDays(now, -4)),
      category: 'Verein',
      visibility: 'members',
      reactions: { '👍': someAdults(4) },
      poll: {
        id: 'p-1',
        question: 'Was wünscht ihr euch für die Weihnachtsfeier?',
        multi: false,
        closesAt: iso(addDays(now, 14)),
        options: [
          { id: 'p-1-a', label: '🎳 Bowling', voterIds: someAdults(7) },
          { id: 'p-1-b', label: '🍕 Essen im Vereinsheim', voterIds: someAdults(11) },
          { id: 'p-1-c', label: '⛸️ Eislaufen + Glühwein', voterIds: someAdults(5) },
        ],
      },
    },
    {
      id: 'n-jugend',
      title: 'D-Jugend: Starker Saisonstart',
      body: 'Unsere D-Jugend hat beim ersten Spieltag zwei von drei Spielen gewonnen. Besonders das Zusammenspiel im Angriff wird von Woche zu Woche besser. Weiter so! 💚❤️',
      authorId: youthCoaches[1].id,
      createdAt: iso(addDays(now, -9)),
      category: 'Jugend',
      teamId: 'td',
      visibility: 'public',
      reactions: { '❤️': someAdults(6), '👏': someAdults(5) },
    },
    {
      id: 'n-teamwear',
      title: 'Sammelbestellung Teamwear',
      body: 'Neue Trainingsanzüge, Hoodies und Taschen im SKC-Design! Bestellungen laufen über den Vereinsshop (Link unter „Specials“). Wer bis Monatsende bestellt, bekommt die Sachen gesammelt zum Training geliefert.',
      authorId: hobby[0].id,
      createdAt: iso(addDays(now, -12)),
      category: 'Verein',
      visibility: 'public',
      reactions: { '👍': someAdults(6) },
    },
  ]

  const specials: Special[] = [
    { id: 'sp-shop', title: 'SKC-Teamwear & Fanartikel', description: 'Trikots, Hoodies, Taschen und Tassen im Vereinsdesign – mit Namen und Nummer.', partner: 'Vereinsshop', category: 'Fanshop', url: club.shopUrl, highlight: true },
    { id: 'sp-physio', title: '15 % auf Sportphysiotherapie', description: 'Für alle Mitglieder: 15 % Rabatt auf Selbstzahler-Leistungen (Massage, Kinesio-Tape, Leistungsdiagnostik).', partner: 'Physio-Partner (Beispiel)', category: 'Sponsor', code: 'SKC15', validUntil: day(addDays(now, 90)) },
    { id: 'sp-sport', title: '10 % auf Hallenschuhe', description: 'Beim Sport-Partner vor Ort gegen Vorlage dieses Codes an der Kasse.', partner: 'Sporthaus-Partner (Beispiel)', category: 'Sponsor', code: 'KORFBALL10', validUntil: day(addDays(now, 60)) },
    { id: 'sp-friend', title: 'Mitglied wirbt Mitglied', description: 'Bring eine Freundin oder einen Freund zum Probetraining mit. Bei Vereinseintritt gibt’s für euch beide ein SKC-Shirt!', partner: club.name, category: 'Verein' },
    { id: 'sp-helper', title: 'Helfer-Bonus', description: 'Wer in einer Saison 5 Helferschichten übernimmt, bekommt einen Gutschein fürs Vereinsheim.', partner: club.name, category: 'Verein' },
  ]

  // ---------------------------------------------------------------- Tabellen
  const table = (name: string, teamId: string, ours: string, opponents: string[]): League => {
    const ourGames = gameEvents.filter((g) => g.ev.teamIds[0] === teamId && g.result)
    const rows: StandingRow[] = []
    const us: StandingRow = { team: ours, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, isUs: true }
    for (const g of ourGames) {
      const [a, b] = g.result!
      us.played++
      us.goalsFor += a
      us.goalsAgainst += b
      if (a > b) us.won++
      else if (a < b) us.lost++
      else us.drawn++
    }
    us.points = us.won * 2 + us.drawn
    rows.push(us)
    for (const o of opponents) {
      const played = us.played + (chance(0.5) ? 0 : -1 + Math.floor(rnd() * 2))
      const won = Math.floor(rnd() * (played + 1))
      const drawn = Math.min(played - won, chance(0.3) ? 1 : 0)
      const lost = played - won - drawn
      const goalsFor = played * (15 + Math.floor(rnd() * 8))
      const goalsAgainst = played * (15 + Math.floor(rnd() * 8))
      rows.push({ team: o, played, won, drawn, lost, goalsFor, goalsAgainst, points: won * 2 + drawn })
    }
    rows.sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst))
    return { id: `l-${teamId}`, name, season: '2026/27', teamId, rows }
  }
  const leagues = [
    table('Korfball-Bundesliga', 't1', club.name, ['KV Adler Rauxel', 'TuS Schildgen', 'SG Pegasus Rommerscheid', 'KC Grün-Weiß Castrop-Rauxel', 'KC Albatros Castrop-Rauxel']),
    table('Verbandsliga', 't2', `${club.name} 2`, ['KV Adler Rauxel 2', 'KC Grün-Weiß Castrop-Rauxel 2', 'KC Albatros Castrop-Rauxel 2', 'TuS Schildgen 2', 'SG Pegasus Rommerscheid 2']),
    table('A-Jugend-Liga (U19)', 'ta', club.name, ['KV Adler Rauxel', 'TuS Schildgen', 'KC Grün-Weiß Castrop-Rauxel']),
  ]

  // ---------------------------------------------------------------- Benachrichtigungen & Anfragen
  const notifications: AppNotification[] = []
  const notify = (memberId: string, n: Omit<AppNotification, 'id' | 'memberId' | 'read'>, read = false) =>
    notifications.push({ id: `nt-${notifications.length + 1}`, memberId, read, ...n })
  notify('m-lena', { kind: 'game', title: 'Du bist nominiert! 🏆', body: `Derby gegen Grün-Weiß am ${format(derbyStart, 'dd.MM.')} – bitte sag kurz zu oder ab.`, link: `/termine/${derby.id}`, createdAt: iso(subMinutes(now, 95)) })
  if (cancelled) notify('m-lena', { kind: 'event', title: 'Training fällt aus', body: `${format(new Date(cancelled.start), 'EEEE, dd.MM.')}: ${cancelled.cancelReason}`, link: `/termine/${cancelled.id}`, createdAt: iso(subMinutes(now, 60 * 5)) })
  notify('m-lena', { kind: 'helper', title: 'Helfer:innen gesucht', body: 'Für den Heimspieltag am Derby-Wochenende sind noch Schichten frei.', link: '/helfen/hl-derby', createdAt: iso(subMinutes(now, 60 * 26)) }, true)
  notify('m-lena', { kind: 'news', title: 'Neuer Spielbericht', body: 'Derby-Krimi in Rauxel: 23:22-Auswärtssieg!', link: '/news/n-derby', createdAt: iso(addMinutes(new Date(lastDerby.end), 90)) }, true)
  notify('m-tim', { kind: 'reminder', title: 'Noch 5 offene Rückmeldungen', body: 'Für das Derby gegen Grün-Weiß fehlen noch Antworten aus dem Kader.', link: `/termine/${derby.id}`, createdAt: iso(subMinutes(now, 40)) })
  notify('m-tim', { kind: 'event', title: 'Absage: Training Dienstag', body: '3 Absagen für das nächste Training der 1. Mannschaft.', link: '/termine', createdAt: iso(subMinutes(now, 60 * 3)) })
  notify('m-sabine', { kind: 'reminder', title: 'Rückmeldung für Mia fehlt', body: 'Bitte gib für Mias nächste Termine Bescheid.', link: '/', createdAt: iso(subMinutes(now, 70)) })
  notify('m-sabine', { kind: 'helper', title: 'Eltern-Schichten beim Jugendturnier', body: 'Cafeteria und Turnierleitung suchen noch Unterstützung.', link: '/helfen/hl-turnier', createdAt: iso(subMinutes(now, 60 * 30)) })
  notify('m-andrea', { kind: 'system', title: '2 neue Zugangsanfragen', body: 'Bitte prüfen und freischalten.', link: '/verwaltung', createdAt: iso(subMinutes(now, 50)) })

  const accessRequests: AccessRequest[] = [
    { id: 'ar-1', name: 'Jonas Overbeck', email: 'jonas.o@example.org', kind: 'player', teamId: 't2', message: 'Bin neu in Castrop und habe früher in den Niederlanden gespielt.', createdAt: iso(subMinutes(now, 60 * 20)), status: 'open' },
    { id: 'ar-2', name: 'Petra Brinkmann', email: 'petra.b@example.org', kind: 'parent', teamId: 'tf', childName: 'Lotta Brinkmann', createdAt: iso(subMinutes(now, 55)), status: 'open' },
  ]

  return {
    version: DEMO_VERSION,
    seededAt: iso(now),
    teams: TEAMS,
    venues: VENUES,
    members,
    events: events.sort((a, b) => a.start.localeCompare(b.start)),
    rsvps,
    absences,
    carpools,
    helperLists,
    news,
    specials,
    gameActions,
    leagues,
    notifications,
    accessRequests,
  }
}
