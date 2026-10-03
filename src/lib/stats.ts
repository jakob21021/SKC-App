import type { GameAction, ID, ShotType } from '@/data/types'
import { SHOT_TYPES } from './korfball'

export interface PlayerStat {
  memberId: ID
  goals: number
  attempts: number
  games: number
  byShot: Record<ShotType, { goals: number; attempts: number }>
}

const emptyByShot = () =>
  Object.fromEntries(SHOT_TYPES.map((s) => [s, { goals: 0, attempts: 0 }])) as PlayerStat['byShot']

/** Aggregiert Live-Ticker-Aktionen zu Spielerstatistiken (Körbe, Würfe, Quote je Wurfart). */
export function playerStats(actions: GameAction[]): PlayerStat[] {
  const map = new Map<ID, PlayerStat & { gameIds: Set<ID> }>()
  for (const a of actions) {
    if (a.side !== 'us' || !a.memberId || (a.type !== 'goal' && a.type !== 'miss')) continue
    let s = map.get(a.memberId)
    if (!s) {
      s = { memberId: a.memberId, goals: 0, attempts: 0, games: 0, byShot: emptyByShot(), gameIds: new Set() }
      map.set(a.memberId, s)
    }
    s.gameIds.add(a.eventId)
    s.attempts++
    if (a.type === 'goal') s.goals++
    if (a.shot) {
      s.byShot[a.shot].attempts++
      if (a.type === 'goal') s.byShot[a.shot].goals++
    }
  }
  return [...map.values()]
    .map(({ gameIds, ...s }) => ({ ...s, games: gameIds.size }))
    .sort((a, b) => b.goals - a.goals || a.attempts - b.attempts)
}

export function teamShotStats(actions: GameAction[], side: 'us' | 'them' = 'us') {
  const byShot = emptyByShot()
  let goals = 0
  let attempts = 0
  for (const a of actions) {
    if (a.side !== side || (a.type !== 'goal' && a.type !== 'miss')) continue
    attempts++
    if (a.type === 'goal') goals++
    if (a.shot) {
      byShot[a.shot].attempts++
      if (a.type === 'goal') byShot[a.shot].goals++
    }
  }
  return { goals, attempts, byShot }
}

export const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)
