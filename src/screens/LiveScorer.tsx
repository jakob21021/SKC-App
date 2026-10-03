import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { CircleSlash, Flag, Pause, Play, Shield, Undo2, X } from 'lucide-react'
import { club } from '@/config/club'
import { api } from '@/data'
import type { GameAction, Member, ShotType } from '@/data/types'
import { SHOT_LABEL, SHOT_TYPES, score, zoneSwitch } from '@/lib/korfball'
import { canScore } from '@/lib/permissions'
import { byName, cn, shortName } from '@/lib/util'
import { useApiMutation, useClub, useEvent, useGameActions } from '@/state/queries'
import { useMe } from '@/state/session'
import { gameClock, useNow } from '@/components/game'
import { Avatar, Button, Sheet, Spinner } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'

/** Bildschirm während der Erfassung wach halten */
function useWakeLock() {
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [])
}

export function LiveScorer() {
  const { id = '' } = useParams()
  const { me } = useMe()
  const { members } = useClub()
  const event = useEvent(id)
  const actions = useGameActions([id])
  const navigate = useNavigate()
  const toast = useToast()
  const [player, setPlayer] = useState<Member | null>(null)
  useWakeLock()

  const g = event.data?.game
  const live = g?.status === 'live'
  const now = useNow(1000, live)
  const clock = g ? gameClock(g, now) : { minute: 0, label: '', stopwatch: '00:00' }

  const add = useApiMutation((a: Omit<GameAction, 'id'>) => api.addGameAction(a), ['gameActions', 'events'])
  const undo = useApiMutation((actionId: string) => api.removeGameAction(actionId), ['gameActions', 'events'])
  const status = useApiMutation(
    async (v: { text: string; status: 'live' | 'halftime' | 'finished'; period?: 1 | 2; minute: number }) => {
      await api.addGameAction({ eventId: id, at: new Date().toISOString(), period: v.period ?? g?.period ?? 1, minute: v.minute, side: 'us', type: 'period', text: v.text })
      await api.setGameStatus(id, v.status, v.period)
    },
    ['gameActions', 'events'],
  )

  const list = actions.data ?? []
  const players = useMemo(() => {
    if (!event.data) return []
    const squad = event.data.game?.squad ?? []
    const pool = squad.length ? members.filter((m) => squad.includes(m.id)) : members.filter((m) => m.teamIds.some((t) => event.data!.teamIds.includes(t)))
    return pool.sort(byName)
  }, [event.data, members])
  const goalsBy = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of list) if (a.type === 'goal' && a.memberId) map.set(a.memberId, (map.get(a.memberId) ?? 0) + 1)
    return map
  }, [list])

  if (event.isLoading) return <Spinner />
  if (!event.data || !g) return <Navigate to="/" replace />
  if (!canScore(me, event.data)) return <Navigate to={`/termine/${id}`} replace />

  const s = score(list)
  const zone = zoneSwitch(s.us + s.them)
  const period: 1 | 2 = g.period ?? 1
  const minute = g.status === 'live' ? clock.minute : period === 2 ? g.halfMinutes * 2 : g.halfMinutes

  const log = (side: 'us' | 'them', type: 'goal' | 'miss', shot?: ShotType, memberId?: string) => {
    if (g.status !== 'live') return toast('Erst anpfeifen, dann erfassen.', 'error')
    navigator.vibrate?.(type === 'goal' ? [40, 30, 40] : 20)
    add.mutate(
      { eventId: id, at: new Date().toISOString(), period, minute, side, type, shot, memberId },
      { onError: (e) => toast(errorText(e), 'error') },
    )
    setPlayer(null)
  }

  const recent = list.filter((a) => a.type !== 'period').slice(-6).reverse()

  return (
    <div className="dark min-h-dvh bg-zinc-950 text-white">
      <header className="pt-safe sticky top-0 z-20 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-2">
          <button onClick={() => navigate(`/termine/${id}`)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Schließen">
            <X className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-brand-400">Live-Erfassung</div>
            <div className="truncate text-sm font-semibold">
              {club.short} vs. {g.opponent}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pb-10">
        {/* Anzeigetafel */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center rounded-3xl bg-zinc-900 p-4">
          <div className="text-center">
            <div className="text-xs font-bold uppercase text-white/60">{club.short}</div>
            <div className="font-display text-7xl font-bold italic tabular-nums leading-none">{s.us}</div>
          </div>
          <div className="text-center">
            <div className={cn('font-mono text-2xl font-bold tabular-nums', live ? 'text-brand-400' : 'text-white/50')}>{g.status === 'scheduled' ? '00:00' : clock.stopwatch}</div>
            <div className="mt-1 text-xs font-semibold text-white/60">
              {g.status === 'scheduled' ? 'Vor dem Spiel' : g.status === 'halftime' ? 'Halbzeitpause' : g.status === 'finished' ? 'Beendet' : `${period}. Halbzeit · ${clock.label}`}
            </div>
          </div>
          <div className="text-center">
            <div className="truncate text-xs font-bold uppercase text-white/60">Gegner</div>
            <div className="font-display text-7xl font-bold italic tabular-nums leading-none">{s.them}</div>
          </div>
        </div>

        {/* Spielsteuerung */}
        <div className="mt-3">
          {g.status === 'scheduled' && (
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" icon={<Play className="size-5" />} loading={status.isPending} onClick={() => status.mutate({ text: 'Anpfiff', status: 'live', period: 1, minute: 0 })}>
              Anpfiff
            </Button>
          )}
          {g.status === 'live' && period === 1 && (
            <Button size="lg" variant="secondary" className="w-full bg-zinc-800 text-white" icon={<Pause className="size-5" />} loading={status.isPending} onClick={() => status.mutate({ text: 'Halbzeit', status: 'halftime', minute: g.halfMinutes })}>
              Halbzeit
            </Button>
          )}
          {g.status === 'halftime' && (
            <Button size="lg" className="w-full bg-green-600 hover:bg-green-700" icon={<Play className="size-5" />} loading={status.isPending} onClick={() => status.mutate({ text: 'Anpfiff 2. Halbzeit', status: 'live', period: 2, minute: g.halfMinutes })}>
              2. Halbzeit anpfeifen
            </Button>
          )}
          {g.status === 'live' && period === 2 && (
            <Button
              size="lg"
              variant="secondary"
              className="w-full bg-zinc-800 text-white"
              icon={<Flag className="size-5" />}
              loading={status.isPending}
              onClick={() => confirm('Spiel wirklich beenden?') && status.mutate({ text: 'Abpfiff', status: 'finished', minute: g.halfMinutes * 2 })}
            >
              Abpfiff
            </Button>
          )}
          {g.status === 'finished' && <p className="rounded-2xl bg-zinc-900 p-4 text-center text-sm text-white/70">Spiel beendet. Korrekturen sind über „Rückgängig“ weiterhin möglich.</p>}
        </div>

        {(g.status === 'live' || g.status === 'halftime') && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm">
            <Shield className="size-4 text-brand-400" />
            <span>
              Fächerwechsel in <b>{zone.untilSwitch}</b> {zone.untilSwitch === 1 ? 'Korb' : 'Körben'}
            </span>
          </div>
        )}

        {/* Spieler:innen */}
        <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-white/50">Korb oder Fehlwurf – Spieler:in antippen</h2>
        {(['w', 'm'] as const).map((gender) => (
          <div key={gender}>
          <div className={cn('mb-1.5 text-xs font-bold', gender === 'w' ? 'text-fuchsia-400' : 'text-blue-400')}>{gender === 'w' ? 'Damen' : 'Herren'}</div>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {players
              .filter((p) => p.gender === gender)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlayer(p)}
                  disabled={g.status !== 'live'}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-2xl border bg-zinc-900 p-2.5 transition active:scale-95 disabled:opacity-40',
                    gender === 'w' ? 'border-fuchsia-500/30' : 'border-blue-500/30',
                  )}
                >
                  <Avatar member={p} size={40} />
                  <span className="w-full truncate text-center text-xs font-semibold">{shortName(p)}</span>
                  {p.jerseyNumber != null && <span className="absolute left-2 top-1.5 text-[10px] font-bold text-white/50">#{p.jerseyNumber}</span>}
                  {!!goalsBy.get(p.id) && (
                    <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-green-600 text-[11px] font-bold">{goalsBy.get(p.id)}</span>
                  )}
                </button>
              ))}
          </div>
          </div>
        ))}

        <Button
          size="lg"
          variant="secondary"
          className="mt-2 w-full border border-white/10 bg-zinc-800 text-white"
          disabled={g.status !== 'live'}
          onClick={() => log('them', 'goal')}
        >
          Korb Gegner (+1)
        </Button>

        {/* Letzte Aktionen */}
        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-white/50">Zuletzt erfasst</h2>
        <div className="divide-y divide-white/10 rounded-2xl bg-zinc-900">
          {recent.length === 0 && <p className="p-4 text-center text-sm text-white/50">Noch nichts erfasst.</p>}
          {recent.map((a) => {
            const m = members.find((x) => x.id === a.memberId)
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-9 text-xs font-bold text-white/50">{a.minute}′</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {a.side === 'them' ? `Korb ${g.opponent}` : `${a.type === 'goal' ? 'Korb' : 'Fehlwurf'} ${m ? shortName(m) : ''}`}
                  {a.shot && <span className="text-white/50"> · {SHOT_LABEL[a.shot]}</span>}
                </span>
                <button onClick={() => undo.mutate(a.id)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-white/70 hover:bg-white/10" aria-label="Rückgängig">
                  <Undo2 className="size-4" /> Rückgängig
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <Sheet open={!!player} onClose={() => setPlayer(null)} title={player ? `${player.firstName} ${player.lastName}` : ''}>
        {player && (
          <div className="pb-2">
            <h3 className="mb-2 text-sm font-bold text-green-600 dark:text-green-400">Korb ✓</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SHOT_TYPES.map((s) => (
                <Button key={s} size="lg" className="bg-green-600 hover:bg-green-700" onClick={() => log('us', 'goal', s, player.id)}>
                  {SHOT_LABEL[s]}
                </Button>
              ))}
            </div>
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-sm font-bold text-muted">
              <CircleSlash className="size-4" /> Fehlwurf
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {SHOT_TYPES.map((s) => (
                <Button key={s} variant="secondary" onClick={() => log('us', 'miss', s, player.id)}>
                  {SHOT_LABEL[s]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
