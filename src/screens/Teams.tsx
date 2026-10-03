import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { Clock, MapPin, Users } from 'lucide-react'
import type { Gender } from '@/data/types'
import { fmt, fmtTime } from '@/lib/dates'
import { byName, fullName, shortName } from '@/lib/util'
import { useClub, useEvents } from '@/state/queries'
import { useMe } from '@/state/session'
import { EventCard } from '@/components/events'
import { Avatar, Card, Chip, EmptyState, ListRow, PageHeader, SectionTitle } from '@/components/ui'

export function Teams() {
  const { teams, members } = useClub()
  return (
    <div>
      <PageHeader back title="Teams" />
      <div className="px-4 pb-8 pt-4">
        <Card className="divide-y divide-line overflow-hidden">
          {teams.map((t) => {
            const n = members.filter((m) => m.teamIds.includes(t.id)).length
            return (
              <ListRow
                key={t.id}
                to={`/teams/${t.id}`}
                icon={<span className="font-display text-sm font-bold">{t.short}</span>}
                title={t.name}
                subtitle={[t.league, `${n} Spieler:innen`].filter(Boolean).join(' · ')}
              />
            )
          })}
        </Card>
      </div>
    </div>
  )
}

export function TeamDetail() {
  const { id = '' } = useParams()
  const { me } = useMe()
  const { teamById, members, venueById } = useClub()
  const events = useEvents()
  const team = teamById.get(id)
  const players = members.filter((m) => m.teamIds.includes(id)).sort(byName)
  const coaches = members.filter((m) => m.coachOf.includes(id))
  // Trainingszeiten aus den Serienterminen ableiten
  const schedule = useMemo(() => {
    const seen = new Map<string, { day: string; time: string; venue?: string }>()
    for (const e of events.data ?? []) {
      if (e.kind !== 'training' || !e.teamIds.includes(id) || !e.seriesId || seen.has(e.seriesId)) continue
      seen.set(e.seriesId, { day: fmt(e.start, 'EEEE'), time: `${fmtTime(e.start)}–${fmtTime(e.end)} Uhr`, venue: e.venueId ? venueById.get(e.venueId)?.name : undefined })
    }
    return [...seen.values()]
  }, [events.data, id, venueById])
  const nextGame = (events.data ?? []).find((e) => e.kind === 'game' && e.teamIds.includes(id) && new Date(e.start) > new Date())

  if (!team) return <EmptyState icon={<Users className="size-7" />} title="Team nicht gefunden" />
  return (
    <div>
      <PageHeader back title={team.name} subtitle={team.league} />
      <div className="px-4 pb-8">
        <SectionTitle>Trainingszeiten</SectionTitle>
        <Card className="divide-y divide-line">
          {schedule.length === 0 && <p className="p-4 text-sm text-muted">Keine regelmäßigen Trainings eingetragen.</p>}
          {schedule.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Clock className="size-5 text-muted" />
              <div className="flex-1">
                <div className="font-semibold">{s.day}</div>
                <div className="text-sm text-muted">{s.time}</div>
              </div>
              {s.venue && (
                <span className="flex items-center gap-1 text-sm text-muted">
                  <MapPin className="size-3.5" /> {s.venue}
                </span>
              )}
            </div>
          ))}
        </Card>
        <p className="mt-2 px-1 text-xs text-muted">Neu hier? Komm gern zum Probetraining vorbei – einfach vorher kurz beim Trainerteam melden.</p>

        {coaches.length > 0 && (
          <>
            <SectionTitle>Trainerteam</SectionTitle>
            <Card className="divide-y divide-line">
              {coaches.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar member={c} size={40} />
                  <div>
                    <div className="font-semibold">{fullName(c)}</div>
                    <div className="text-sm text-muted">{c.title ?? 'Trainer:in'}</div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {nextGame && (
          <>
            <SectionTitle>Nächstes Spiel</SectionTitle>
            <EventCard event={nextGame} showDate />
          </>
        )}

        {me && (
          <>
            <SectionTitle action={<span className="text-xs font-semibold text-muted">{players.length}</span>}>Kader</SectionTitle>
            {(['w', 'm'] as Gender[]).map((g) => {
              const list = players.filter((p) => p.gender === g)
              if (!list.length) return null
              return (
                <Card key={g} className="mb-3 p-4">
                  <h3 className="mb-3 text-sm font-bold text-muted">
                    {g === 'w' ? 'Damen' : 'Herren'} · {list.length}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {list.map((p) => (
                      <Link key={p.id} to={`/statistik/${p.id}`} className="flex items-center gap-2">
                        <Avatar member={p} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{shortName(p)}</span>
                          {p.jerseyNumber != null && <Chip className="mt-0.5">#{p.jerseyNumber}</Chip>}
                        </span>
                      </Link>
                    ))}
                  </div>
                </Card>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
