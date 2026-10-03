import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CircleSlash, Flag, Target } from 'lucide-react'
import { club } from '@/config/club'
import type { ClubEvent, GameAction, GameInfo, Member } from '@/data/types'
import { SHOT_LABEL, SHOT_TYPES, score, zoneSwitch } from '@/lib/korfball'
import { pct, playerStats, teamShotStats } from '@/lib/stats'
import { cn, shortName } from '@/lib/util'
import { Avatar, Chip, EmptyState, LiveDot } from './ui'

export function useNow(intervalMs = 1000, active = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, active])
  return now
}

/** Spielminute aus Halbzeit-Start berechnen, z. B. 34 oder "30+2" */
export function gameClock(g: GameInfo, now: number) {
  if (!g.periodStartedAt || !g.period) return { minute: 0, label: '0′', seconds: 0 }
  const elapsed = Math.max(0, now - new Date(g.periodStartedAt).getTime())
  const minuteInPeriod = Math.floor(elapsed / 60_000) + 1
  const base = g.period === 2 ? g.halfMinutes : 0
  const over = minuteInPeriod - g.halfMinutes
  const label = over > 0 ? `${base + g.halfMinutes}+${over}′` : `${base + minuteInPeriod}′`
  const secs = Math.floor(elapsed / 1000)
  const mm = String(Math.floor(secs / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')
  return { minute: Math.min(base + g.halfMinutes, base + minuteInPeriod), label, seconds: secs, stopwatch: `${mm}:${ss}` }
}

export function statusLabel(g: GameInfo) {
  switch (g.status) {
    case 'scheduled':
      return 'Anpfiff folgt'
    case 'live':
      return `${g.period ?? 1}. Halbzeit`
    case 'halftime':
      return 'Halbzeit'
    case 'finished':
      return 'Endstand'
  }
}

export function Scoreboard({ event, compact }: { event: ClubEvent; compact?: boolean }) {
  const g = event.game!
  const live = g.status === 'live'
  const now = useNow(1000, live)
  const clock = gameClock(g, now)
  const us = g.scoreUs ?? 0
  const them = g.scoreThem ?? 0
  const left = g.home ? { name: club.name, score: us, ours: true } : { name: g.opponent, score: them, ours: false }
  const right = g.home ? { name: g.opponent, score: them, ours: false } : { name: club.name, score: us, ours: true }
  const started = g.status !== 'scheduled'

  return (
    <div className={cn('hero-stripes relative overflow-hidden text-white', compact ? 'rounded-2xl p-4' : 'rounded-3xl p-5')}>
      <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80">
        {live || g.status === 'halftime' ? (
          <Chip tone="dark" className="bg-white/15">
            <LiveDot /> {g.status === 'halftime' ? 'Halbzeit' : `Live · ${clock.label}`}
          </Chip>
        ) : (
          <span>
            {g.competition} · {statusLabel(g)}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamName {...left} />
        <div className={cn('font-display font-bold italic tabular-nums leading-none', compact ? 'text-5xl' : 'text-6xl')}>
          {started ? (
            <>
              {left.score}
              <span className="mx-1 text-white/60">:</span>
              {right.score}
            </>
          ) : (
            <span className="text-4xl text-white/80">vs.</span>
          )}
        </div>
        <TeamName {...right} />
      </div>
    </div>
  )
}

function TeamName({ name, ours }: { name: string; ours: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {ours ? (
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mb-1.5 size-12 drop-shadow" />
      ) : (
        <span className="mb-1.5 grid size-12 place-items-center rounded-full bg-white/15 font-display text-lg font-bold uppercase">
          {name
            .split(' ')
            .filter((w) => /^[A-ZÄÖÜ]/.test(w))
            .slice(0, 2)
            .map((w) => w[0])
            .join('')}
        </span>
      )}
      <span className="line-clamp-2 text-sm font-bold leading-tight">{name}</span>
    </div>
  )
}

// ------------------------------------------------------------------ Live-Ticker

export function Ticker({ event, actions, memberById }: { event: ClubEvent; actions: GameAction[]; memberById: Map<string, Member> }) {
  const g = event.game!
  if (!actions.length)
    return (
      <EmptyState icon={<Flag className="size-7" />} title="Noch keine Ereignisse">
        Sobald das Spiel läuft, erscheinen hier alle Körbe live.
      </EmptyState>
    )
  // Laufenden Spielstand mitführen, neueste oben
  let us = 0
  let them = 0
  const rows = actions.map((a) => {
    if (a.type === 'goal') a.side === 'us' ? us++ : them++
    return { a, us, them }
  })
  const zone = zoneSwitch(us + them)
  return (
    <div>
      {(g.status === 'live' || g.status === 'halftime') && (
        <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-muted">
          Fächerwechsel in {zone.untilSwitch} {zone.untilSwitch === 1 ? 'Korb' : 'Körben'} · bisher {zone.switches} Wechsel
        </p>
      )}
      <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[27px] before:top-2 before:w-px before:bg-[var(--border)]">
        {rows
          .slice()
          .reverse()
          .map(({ a, us, them }) => {
            const m = a.memberId ? memberById.get(a.memberId) : undefined
            if (a.type === 'period')
              return (
                <li key={a.id} className="relative flex items-center gap-3 py-2">
                  <span className="z-10 w-14 text-center text-xs font-bold text-muted">{a.minute}′</span>
                  <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                    {a.text} {a.text !== 'Anpfiff' && a.text !== 'Anpfiff 2. Halbzeit' && `· ${us}:${them}`}
                  </span>
                </li>
              )
            const goal = a.type === 'goal'
            const ours = a.side === 'us'
            return (
              <li key={a.id} className={cn('relative flex items-center gap-3 rounded-xl py-2 pr-2', goal && ours && 'bg-green-50/70 dark:bg-green-950/20')}>
                <span className="z-10 flex w-14 justify-center">
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-full text-xs font-bold ring-4 ring-surface',
                      goal ? (ours ? 'bg-green-600 text-white' : 'bg-zinc-800 text-white dark:bg-zinc-600') : 'bg-surface-2 text-muted',
                    )}
                  >
                    {a.minute}′
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {goal ? (ours ? `Korb! ${m ? shortName(m) : club.short}` : `Korb ${g.opponent}`) : `Fehlwurf ${m ? shortName(m) : ''}`}
                  </div>
                  {a.shot && <div className="text-xs text-muted">{SHOT_LABEL[a.shot]}</div>}
                </div>
                {goal && (
                  <span className="font-display text-xl font-bold italic tabular-nums">
                    {us}:{them}
                  </span>
                )}
              </li>
            )
          })}
      </ol>
    </div>
  )
}

// ------------------------------------------------------------------ Statistik

export function ShotBars({ actions }: { actions: GameAction[] }) {
  const t = teamShotStats(actions)
  if (!t.attempts) return null
  return (
    <div className="space-y-2.5">
      {SHOT_TYPES.map((s) => {
        const v = t.byShot[s]
        if (!v.attempts) return null
        return (
          <div key={s}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-semibold">{SHOT_LABEL[s]}</span>
              <span className="tabular-nums text-muted">
                {v.goals}/{v.attempts} · <b className="text-ink">{pct(v.goals, v.attempts)} %</b>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct(v.goals, v.attempts)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ScorerTable({ actions, memberById, limit }: { actions: GameAction[]; memberById: Map<string, Member>; limit?: number }) {
  const stats = playerStats(actions).slice(0, limit)
  if (!stats.length)
    return (
      <EmptyState icon={<Target className="size-7" />} title="Noch keine Statistik">
        Statistiken entstehen automatisch aus dem Live-Ticker.
      </EmptyState>
    )
  const max = stats[0]?.goals || 1
  return (
    <div className="divide-y divide-line">
      {stats.map((s, i) => {
        const m = memberById.get(s.memberId)
        if (!m) return null
        return (
          <Link key={s.memberId} to={`/statistik/${m.id}`} className="flex items-center gap-3 py-2.5">
            <span className={cn('w-5 text-center text-sm font-bold', i < 3 ? 'text-brand-600' : 'text-muted')}>{i + 1}</span>
            <Avatar member={m} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{shortName(m)}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={cn('h-full rounded-full', m.gender === 'w' ? 'bg-female' : 'bg-male')} style={{ width: `${(s.goals / max) * 100}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl font-bold leading-none tabular-nums">{s.goals}</div>
              <div className="text-[11px] text-muted tabular-nums">{pct(s.goals, s.attempts)} %</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export function StatTiles({ actions, games }: { actions: GameAction[]; games?: number }) {
  const t = teamShotStats(actions)
  const s = score(actions)
  const tiles = [
    { label: 'Körbe', value: games ? (t.goals / games).toFixed(1) : t.goals, sub: games ? 'pro Spiel' : undefined },
    { label: 'Würfe', value: games ? Math.round(t.attempts / games) : t.attempts, sub: games ? 'pro Spiel' : undefined },
    { label: 'Quote', value: `${pct(t.goals, t.attempts)} %` },
    { label: 'Gegenkörbe', value: games ? (s.them / games).toFixed(1) : s.them, sub: games ? 'pro Spiel' : undefined },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {tiles.map((x) => (
        <div key={x.label} className="rounded-xl bg-surface-2 px-2 py-2.5 text-center">
          <div className="font-display text-2xl font-bold leading-none tabular-nums">{x.value}</div>
          <div className="mt-1 text-[11px] font-semibold text-muted">{x.label}</div>
          {x.sub && <div className="text-[10px] text-muted">{x.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function MissIcon() {
  return <CircleSlash className="size-4" />
}
