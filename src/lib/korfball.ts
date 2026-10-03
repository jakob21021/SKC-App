import { GOALS_PER_ZONE_SWITCH, LINEUP } from '@/config/club'
import type { Gender, GameAction, ShotType } from '@/data/types'

export const SHOT_TYPES: ShotType[] = ['distance', 'close', 'running_in', 'penalty', 'free_pass']

export const SHOT_LABEL: Record<ShotType, string> = {
  distance: 'Fernwurf',
  close: 'Nahwurf',
  running_in: 'Durchlaufball',
  penalty: 'Strafwurf',
  free_pass: 'Freiwurf',
}

export const SHOT_SHORT: Record<ShotType, string> = {
  distance: 'FW',
  close: 'NW',
  running_in: 'DL',
  penalty: 'SW',
  free_pass: 'FrW',
}

export const GENDER_LABEL: Record<Gender, { one: string; many: string }> = {
  w: { one: 'Dame', many: 'Damen' },
  m: { one: 'Herr', many: 'Herren' },
}

export function score(actions: GameAction[]) {
  let us = 0
  let them = 0
  for (const a of actions) {
    if (a.type !== 'goal') continue
    if (a.side === 'us') us++
    else them++
  }
  return { us, them }
}

/** Fächerwechsel: nach jeweils zwei Körben tauschen Angriff und Verteidigung. */
export function zoneSwitch(totalGoals: number) {
  const untilSwitch = GOALS_PER_ZONE_SWITCH - (totalGoals % GOALS_PER_ZONE_SWITCH)
  return { untilSwitch, switches: Math.floor(totalGoals / GOALS_PER_ZONE_SWITCH) }
}

/** Wie viele Damen/Herren fehlen noch für eine vollständige 4+4-Aufstellung? */
export function lineupGap(count: Record<Gender, number>) {
  return {
    w: Math.max(0, LINEUP.w - count.w),
    m: Math.max(0, LINEUP.m - count.m),
  }
}

export function resultOf(us?: number, them?: number): 'win' | 'draw' | 'loss' | null {
  if (us == null || them == null) return null
  if (us > them) return 'win'
  if (us < them) return 'loss'
  return 'draw'
}
