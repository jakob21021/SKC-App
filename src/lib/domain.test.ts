import { describe, expect, it } from 'vitest'
import { createSeed } from '@/data/demo/seed'
import { effectiveRsvp, summarize, trainingRate } from './attendance'
import { score, zoneSwitch, lineupGap } from './korfball'
import { playerStats } from './stats'
import { buildIcs } from './ics'
import { canManageEvent, canRespondFor } from './permissions'

const db = createSeed(new Date('2026-10-03T14:14:00Z'))

describe('Demo-Daten', () => {
  it('erzeugt Teams, Mitglieder, Termine und Spiele', () => {
    expect(db.teams.length).toBeGreaterThanOrEqual(7)
    expect(db.members.length).toBeGreaterThan(80)
    expect(db.events.filter((e) => e.kind === 'training').length).toBeGreaterThan(100)
    expect(db.events.filter((e) => e.kind === 'game').length).toBeGreaterThan(10)
  })

  it('Spielstände passen zum Live-Ticker', () => {
    for (const ev of db.events.filter((e) => e.game?.status === 'finished' || e.game?.status === 'live')) {
      const s = score(db.gameActions.filter((a) => a.eventId === ev.id))
      expect(s).toEqual({ us: ev.game!.scoreUs, them: ev.game!.scoreThem })
    }
  })

  it('Derby-Siegtreffer stammt von Lena (Fernwurf) beim Stand von 22:22', () => {
    const goals = db.gameActions.filter((a) => a.eventId === 'g-t1-4' && a.type === 'goal')
    const last = goals[goals.length - 1]
    expect(last.side).toBe('us')
    expect(last.memberId).toBe('m-lena')
    expect(last.shot).toBe('distance')
    expect(score(goals.slice(0, -1))).toEqual({ us: 22, them: 22 })
  })

  it('Lena hat für das Derby noch nicht geantwortet', () => {
    const derby = db.events.find((e) => e.id === 'g-t1-5')!
    expect(effectiveRsvp(derby, 'm-lena', db.rsvps, db.absences, db.teams).status).toBe('open')
    expect(derby.game!.squad).toContain('m-lena')
  })

  it('läuft deterministisch', () => {
    const again = createSeed(new Date('2026-10-03T14:14:00Z'))
    expect(again.members.map((m) => m.firstName + m.lastName)).toEqual(db.members.map((m) => m.firstName + m.lastName))
  })
})

describe('Rückmeldungen', () => {
  const training = db.events.find((e) => e.kind === 'training' && e.teamIds[0] === 't1' && !e.cancelled)!

  it('Abwesenheit führt zu automatischer Absage', () => {
    const day = training.start.slice(0, 10)
    const abs = [{ id: 'x', memberId: 'm-lena', from: day, to: day, reason: 'urlaub' as const }]
    const r = effectiveRsvp(training, 'm-lena', [], abs, db.teams)
    expect(r).toMatchObject({ status: 'no', source: 'absence', reason: 'urlaub' })
  })

  it('eigene Antwort schlägt Abwesenheit', () => {
    const day = training.start.slice(0, 10)
    const abs = [{ id: 'x', memberId: 'm-lena', from: day, to: day, reason: 'urlaub' as const }]
    const rsvps = [{ eventId: training.id, memberId: 'm-lena', status: 'yes' as const, updatedAt: '', updatedBy: 'm-lena' }]
    expect(effectiveRsvp(training, 'm-lena', rsvps, abs, db.teams).status).toBe('yes')
  })

  it('Hobby-Team: Training gilt als zugesagt (Opt-out)', () => {
    const hobby = db.events.find((e) => e.kind === 'training' && e.teamIds[0] === 'th')!
    expect(effectiveRsvp(hobby, 'm-sabine', [], [], db.teams)).toMatchObject({ status: 'yes', source: 'default' })
  })

  it('zählt Zusagen nach Damen/Herren', () => {
    const s = summarize(training, db.members, db.rsvps, db.absences, db.teams)
    expect(s.yesByGender.w + s.yesByGender.m).toBe(s.byStatus.yes.length)
    expect(s.entries.length).toBe(db.members.filter((m) => m.teamIds.includes('t1')).length)
  })

  it('berechnet die Trainingsquote', () => {
    const past = db.events.filter((e) => e.kind === 'training' && new Date(e.end) < new Date('2026-10-03T14:14:00Z'))
    const r = trainingRate('m-lena', past, db.rsvps, db.absences, db.teams, db.members)
    expect(r.total).toBeGreaterThan(10)
    expect(r.rate).toBeGreaterThan(0)
    expect(r.rate).toBeLessThanOrEqual(1)
  })
})

describe('Korfball-Logik', () => {
  it('Fächerwechsel nach je zwei Körben', () => {
    expect(zoneSwitch(0).untilSwitch).toBe(2)
    expect(zoneSwitch(1).untilSwitch).toBe(1)
    expect(zoneSwitch(2)).toEqual({ untilSwitch: 2, switches: 1 })
  })
  it('fehlende Damen/Herren für 4+4', () => {
    expect(lineupGap({ w: 3, m: 6 })).toEqual({ w: 1, m: 0 })
  })
  it('Spielerstatistik: Lena ist Top-Torschützin', () => {
    const stats = playerStats(db.gameActions)
    expect(stats[0].memberId).toBe('m-lena')
    const lena = stats[0]
    expect(lena.attempts).toBeGreaterThanOrEqual(lena.goals)
    const byShotGoals = Object.values(lena.byShot).reduce((a, b) => a + b.goals, 0)
    expect(byShotGoals).toBe(lena.goals)
  })
})

describe('Rechte', () => {
  const lena = db.members.find((m) => m.id === 'm-lena')!
  const tim = db.members.find((m) => m.id === 'm-tim')!
  const sabine = db.members.find((m) => m.id === 'm-sabine')!
  it('Trainer darf eigene Teams verwalten, Spielerin nicht', () => {
    expect(canManageEvent(tim, { teamIds: ['t1'] })).toBe(true)
    expect(canManageEvent(tim, { teamIds: ['td'] })).toBe(false)
    expect(canManageEvent(lena, { teamIds: ['t1'] })).toBe(false)
  })
  it('Eltern dürfen für ihre Kinder antworten', () => {
    expect(canRespondFor(sabine, 'm-mia')).toBe(true)
    expect(canRespondFor(sabine, 'm-lena')).toBe(false)
  })
})

describe('Kalender-Export', () => {
  it('erzeugt gültiges iCalendar', () => {
    const ics = buildIcs(db.events.slice(0, 3), db.venues)
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(3)
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true)
  })
})
