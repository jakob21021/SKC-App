import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Trophy } from 'lucide-react'
import type { ClubEvent } from '@/data/types'
import { summarize, trainingRate } from '@/lib/attendance'
import { fmtDayLabel } from '@/lib/dates'
import { resultOf } from '@/lib/korfball'
import { pct } from '@/lib/stats'
import { cn, shortName } from '@/lib/util'
import { useAbsences, useClub, useEvents, useGameActions, useLeagues, useRsvps } from '@/state/queries'
import { useMe } from '@/state/session'
import { EventCard } from '@/components/events'
import { ScorerTable, ShotBars, StatTiles } from '@/components/game'
import { Avatar, Card, EmptyState, FilterChips, PageHeader, SectionTitle, Segmented, Skeleton } from '@/components/ui'

type Tab = 'plan' | 'results' | 'table' | 'stats'

export function Games() {
  const { me, family } = useMe()
  const { teams } = useClub()
  const events = useEvents()
  const gameTeams = useMemo(() => {
    const ids = new Set((events.data ?? []).filter((e) => e.kind === 'game').flatMap((e) => e.teamIds))
    return teams.filter((t) => ids.has(t.id))
  }, [events.data, teams])
  const preferred = [...family.flatMap((f) => f.teamIds), ...(me?.coachOf ?? [])].find((t) => gameTeams.some((g) => g.id === t))
  const [teamId, setTeamId] = useState<string>(preferred ?? 't1')
  const [tab, setTab] = useState<Tab>('plan')

  const games = useMemo(() => (events.data ?? []).filter((e) => e.kind === 'game' && e.teamIds.includes(teamId)), [events.data, teamId])
  const now = Date.now()
  const upcoming = games.filter((e) => e.game!.status !== 'finished' && new Date(e.end).getTime() > now - 3 * 3600_000)
  const finished = games.filter((e) => e.game!.status === 'finished').reverse()

  return (
    <div>
      <PageHeader large title="Spiele" />
      <div className="space-y-3 px-4 pt-1">
        <FilterChips value={teamId} onChange={setTeamId} options={gameTeams.map((t) => ({ value: t.id, label: t.name }))} />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'plan', label: 'Spielplan' },
            { value: 'results', label: 'Ergebnisse' },
            { value: 'table', label: 'Tabelle' },
            { value: 'stats', label: 'Statistik' },
          ]}
        />
      </div>
      <div className="px-4 pb-6">
        {events.isLoading ? (
          <Skeleton className="mt-4 h-40" />
        ) : (
          <>
            {tab === 'plan' && <GameList games={upcoming} empty="Keine anstehenden Spiele" />}
            {tab === 'results' && (
              <>
                <FormStrip games={finished} />
                <GameList games={finished} empty="Noch keine Ergebnisse" />
              </>
            )}
            {tab === 'table' && <Table teamId={teamId} />}
            {tab === 'stats' && <TeamStats teamId={teamId} games={finished} />}
          </>
        )}
      </div>
    </div>
  )
}

function GameList({ games, empty }: { games: ClubEvent[]; empty: string }) {
  if (!games.length) return <EmptyState icon={<Trophy className="size-7" />} title={empty} />
  return (
    <div className="mt-4 space-y-3">
      {games.map((e) => (
        <div key={e.id}>
          <div className="mb-1.5 px-1 text-xs font-bold text-muted">
            {fmtDayLabel(e.start, true)} · {e.game!.competition}
          </div>
          <EventCard event={e} />
        </div>
      ))}
    </div>
  )
}

function FormStrip({ games }: { games: ClubEvent[] }) {
  if (!games.length) return null
  const last = games.slice(0, 5)
  const w = games.filter((g) => resultOf(g.game!.scoreUs, g.game!.scoreThem) === 'win').length
  const d = games.filter((g) => resultOf(g.game!.scoreUs, g.game!.scoreThem) === 'draw').length
  const l = games.length - w - d
  return (
    <Card className="mt-4 flex items-center justify-between p-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Form</div>
        <div className="mt-1.5 flex gap-1">
          {last.map((g) => {
            const r = resultOf(g.game!.scoreUs, g.game!.scoreThem)
            return (
              <Link
                key={g.id}
                to={`/termine/${g.id}`}
                className={cn('grid size-7 place-items-center rounded-lg text-xs font-bold text-white', r === 'win' ? 'bg-green-600' : r === 'loss' ? 'bg-red-600' : 'bg-zinc-400')}
              >
                {r === 'win' ? 'S' : r === 'loss' ? 'N' : 'U'}
              </Link>
            )
          })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-3xl font-bold tabular-nums">
          {w}-{d}-{l}
        </div>
        <div className="text-xs text-muted">Siege · Remis · Niederl.</div>
      </div>
    </Card>
  )
}

function Table({ teamId }: { teamId: string }) {
  const leagues = useLeagues()
  const league = leagues.data?.find((l) => l.teamId === teamId)
  if (leagues.isLoading) return <Skeleton className="mt-4 h-60" />
  if (!league) return <EmptyState icon={<Trophy className="size-7" />} title="Keine Tabelle">Für dieses Team gibt es keine Liga-Tabelle.</EmptyState>
  return (
    <>
      <SectionTitle>
        {league.name} · {league.season}
      </SectionTitle>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2 pl-3 text-left font-semibold">#</th>
              <th className="py-2 text-left font-semibold">Team</th>
              <th className="px-1 py-2 text-center font-semibold">Sp</th>
              <th className="hidden px-1 py-2 text-center font-semibold sm:table-cell">S-U-N</th>
              <th className="px-1 py-2 text-center font-semibold">Körbe</th>
              <th className="py-2 pr-3 text-right font-semibold">Pkt</th>
            </tr>
          </thead>
          <tbody>
            {league.rows.map((r, i) => (
              <tr key={r.team} className={cn('border-b border-line last:border-0', r.isUs && 'bg-brand-50 font-bold dark:bg-brand-950/40')}>
                <td className="py-2.5 pl-3 tabular-nums">
                  <span className={cn('grid size-6 place-items-center rounded-md text-xs', i === 0 && 'bg-amber-400 text-amber-950')}>{i + 1}</span>
                </td>
                <td className="py-2.5 pr-2 leading-tight">{r.team}</td>
                <td className="px-1 py-2.5 text-center tabular-nums">{r.played}</td>
                <td className="hidden px-1 py-2.5 text-center tabular-nums sm:table-cell">
                  {r.won}-{r.drawn}-{r.lost}
                </td>
                <td className="px-1 py-2.5 text-center tabular-nums text-muted">
                  {r.goalsFor}:{r.goalsAgainst}
                </td>
                <td className="py-2.5 pr-3 text-right font-display text-lg font-bold tabular-nums">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 px-1 text-xs text-muted">Sieg = 2 Punkte, Unentschieden = 1 Punkt.</p>
    </>
  )
}

function TeamStats({ teamId, games }: { teamId: string; games: ClubEvent[] }) {
  const { memberById, members, teams } = useClub()
  const { me } = useMe()
  const ids = useMemo(() => games.map((g) => g.id), [games])
  const actions = useGameActions(ids)
  const events = useEvents()
  const pastTrainings = useMemo(
    () => (events.data ?? []).filter((e) => e.kind === 'training' && e.teamIds.includes(teamId) && new Date(e.end) < new Date() && !e.cancelled),
    [events.data, teamId],
  )
  const rsvps = useRsvps(pastTrainings, !!me)
  const absences = useAbsences(!!me)
  const list = actions.data ?? []

  const attendance = useMemo(() => {
    if (!me) return []
    return members
      .filter((m) => m.teamIds.includes(teamId))
      .map((m) => ({ m, ...trainingRate(m.id, pastTrainings, rsvps.data ?? [], absences.data ?? [], teams, members) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.rate - a.rate)
  }, [me, members, teamId, pastTrainings, rsvps.data, absences.data, teams])

  const avgTraining = useMemo(() => {
    if (!pastTrainings.length || !me) return null
    const counts = pastTrainings.map((e) => summarize(e, members, rsvps.data ?? [], absences.data ?? [], teams).byStatus.yes.length)
    return Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
  }, [pastTrainings, members, rsvps.data, absences.data, teams, me])

  if (!games.length) return <EmptyState icon={<Trophy className="size-7" />} title="Noch keine Statistik">Statistiken entstehen automatisch aus den Live-Tickern.</EmptyState>
  return (
    <>
      <SectionTitle>Saison · {games.length} Spiele</SectionTitle>
      <Card className="p-4">
        <StatTiles actions={list} games={games.length} />
      </Card>
      <SectionTitle>Torschützenliste</SectionTitle>
      <Card className="px-4 py-1">
        <ScorerTable actions={list} memberById={memberById} limit={10} />
      </Card>
      <SectionTitle>Wurfquoten</SectionTitle>
      <Card className="p-4">
        <ShotBars actions={list} />
      </Card>
      {me && attendance.length > 0 && (
        <>
          <SectionTitle action={avgTraining != null && <span className="text-xs font-semibold text-muted">Ø {avgTraining} pro Training</span>}>Trainingsbeteiligung</SectionTitle>
          <Card className="divide-y divide-line px-4 py-1">
            {attendance.slice(0, 12).map(({ m, attended, total, rate }) => (
              <Link key={m.id} to={`/statistik/${m.id}`} className="flex items-center gap-3 py-2.5">
                <Avatar member={m} size={30} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{shortName(m)}</span>
                <span className="text-xs text-muted tabular-nums">
                  {attended}/{total}
                </span>
                <span className={cn('w-12 text-right font-bold tabular-nums', rate >= 0.8 ? 'text-green-600 dark:text-green-400' : rate < 0.5 ? 'text-red-600 dark:text-red-400' : '')}>
                  {pct(attended, total)} %
                </span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
