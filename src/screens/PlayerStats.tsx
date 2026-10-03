import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { UserX } from 'lucide-react'
import { trainingRate } from '@/lib/attendance'
import { fmtDayLabel } from '@/lib/dates'
import { SHOT_LABEL, SHOT_TYPES } from '@/lib/korfball'
import { roleLabel } from '@/lib/permissions'
import { pct, playerStats } from '@/lib/stats'
import { fullName } from '@/lib/util'
import { useAbsences, useClub, useEvents, useGameActions, useRsvps } from '@/state/queries'
import { useMe } from '@/state/session'
import { Avatar, Card, Chip, EmptyState, PageHeader, SectionTitle, Spinner } from '@/components/ui'

export function PlayerStats() {
  const { memberId = '' } = useParams()
  const { me } = useMe()
  const { memberById, teamById, teams, members, isLoading } = useClub()
  const member = memberById.get(memberId)
  const events = useEvents()
  const games = useMemo(() => (events.data ?? []).filter((e) => e.game?.status === 'finished' && member && e.teamIds.some((t) => member.teamIds.includes(t))), [events.data, member])
  const actions = useGameActions(games.map((g) => g.id))
  const pastTrainings = useMemo(
    () => (events.data ?? []).filter((e) => e.kind === 'training' && new Date(e.end) < new Date() && member && e.teamIds.some((t) => member.teamIds.includes(t))),
    [events.data, member],
  )
  const rsvps = useRsvps(pastTrainings, !!me)
  const absences = useAbsences(!!me)

  if (isLoading) return <Spinner />
  if (!member) return <EmptyState icon={<UserX className="size-7" />} title="Mitglied nicht gefunden" />

  const stats = playerStats((actions.data ?? []).filter((a) => a.memberId === member.id))[0]
  const rate = me ? trainingRate(member.id, pastTrainings, rsvps.data ?? [], absences.data ?? [], teams, members) : null
  const perGame = games
    .map((g) => {
      const mine = (actions.data ?? []).filter((a) => a.eventId === g.id && a.memberId === member.id)
      return { g, goals: mine.filter((a) => a.type === 'goal').length, attempts: mine.length }
    })
    .filter((x) => x.attempts > 0)
    .reverse()

  return (
    <div>
      <PageHeader back title="Spielerstatistik" />
      <div className="px-4 pb-8">
        <div className="mt-5 flex items-center gap-4">
          <Avatar member={member} size={72} />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{fullName(member)}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {member.jerseyNumber != null && <Chip tone="brand">#{member.jerseyNumber}</Chip>}
              {member.teamIds.map((t) => (
                <Chip key={t}>{teamById.get(t)?.name}</Chip>
              ))}
              <Chip tone="outline">{roleLabel(member)}</Chip>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Tile value={stats?.goals ?? 0} label="Körbe" />
          <Tile value={`${pct(stats?.goals ?? 0, stats?.attempts ?? 0)} %`} label="Trefferquote" />
          <Tile value={rate ? `${Math.round(rate.rate * 100)} %` : '–'} label="Training" />
        </div>

        {stats && (
          <>
            <SectionTitle>Nach Wurfart</SectionTitle>
            <Card className="divide-y divide-line px-4 py-1">
              {SHOT_TYPES.map((s) => {
                const v = stats.byShot[s]
                return (
                  <div key={s} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-semibold">{SHOT_LABEL[s]}</span>
                    <span className="tabular-nums text-muted">
                      {v.goals} / {v.attempts} Würfe · <b className="text-ink">{pct(v.goals, v.attempts)} %</b>
                    </span>
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {perGame.length > 0 && (
          <>
            <SectionTitle>Spiele</SectionTitle>
            <Card className="divide-y divide-line">
              {perGame.map(({ g, goals, attempts }) => (
                <Link key={g.id} to={`/termine/${g.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{g.game!.home ? `vs. ${g.game!.opponent}` : `@ ${g.game!.opponent}`}</div>
                    <div className="text-xs text-muted">
                      {fmtDayLabel(g.start, true)} · {g.game!.scoreUs}:{g.game!.scoreThem}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-xl font-bold leading-none">{goals}</div>
                    <div className="text-[11px] text-muted">{attempts} Würfe</div>
                  </div>
                </Link>
              ))}
            </Card>
          </>
        )}
        {!stats && <p className="mt-6 text-center text-sm text-muted">Noch keine Spielaktionen erfasst.</p>}
      </div>
    </div>
  )
}

function Tile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <Card className="px-2 py-3 text-center">
      <div className="font-display text-3xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-semibold text-muted">{label}</div>
    </Card>
  )
}
