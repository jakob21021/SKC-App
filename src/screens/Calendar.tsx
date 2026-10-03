import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarPlus, CalendarX2, History, Plus } from 'lucide-react'
import type { ClubEvent } from '@/data/types'
import { effectiveRsvp, rosterFor, summarize } from '@/lib/attendance'
import { dayKey, fmtDayLabel } from '@/lib/dates'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { isAdmin, isCoach } from '@/lib/permissions'
import { useAbsences, useClub, useEvents, useRsvps } from '@/state/queries'
import { useMe } from '@/state/session'
import { EventCard, RsvpControl } from '@/components/events'
import { Button, EmptyState, FilterChips, IconButton, PageHeader, Select, Skeleton } from '@/components/ui'
import { useToast } from '@/components/Toast'

type Kind = 'all' | ClubEvent['kind']

export function Calendar() {
  const { me, family } = useMe()
  const { teams, members, venues } = useClub()
  const events = useEvents()
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('all')
  const myTeamIds = useMemo(() => [...new Set([...family.flatMap((f) => f.teamIds), ...(me?.coachOf ?? [])])], [family, me])
  const [team, setTeam] = useState<string>(myTeamIds.length ? 'mine' : 'all')
  const [past, setPast] = useState(false)

  const filtered = useMemo(() => {
    const now = Date.now()
    return (events.data ?? [])
      .filter((e) => (past ? new Date(e.end).getTime() < now : new Date(e.end).getTime() >= now))
      .filter((e) => kind === 'all' || e.kind === kind)
      .filter((e) => {
        if (team === 'all') return true
        if (team === 'mine') return e.teamIds.length === 0 || e.teamIds.some((t) => myTeamIds.includes(t))
        return e.teamIds.includes(team) || e.teamIds.length === 0
      })
      .sort((a, b) => (past ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)))
      .slice(0, 80)
  }, [events.data, kind, team, myTeamIds, past])

  const rsvps = useRsvps(filtered, !!me)
  const absences = useAbsences(!!me)

  const groups = useMemo(() => {
    const map = new Map<string, ClubEvent[]>()
    for (const e of filtered) {
      const k = dayKey(e.start)
      map.set(k, [...(map.get(k) ?? []), e])
    }
    return [...map.entries()]
  }, [filtered])

  const exportIcs = () => {
    const upcoming = (events.data ?? []).filter((e) => new Date(e.end) > new Date() && (team === 'all' || e.teamIds.length === 0 || e.teamIds.some((t) => (team === 'mine' ? myTeamIds : [team]).includes(t))))
    downloadIcs('skc-termine.ics', buildIcs(upcoming, venues))
    toast(`${upcoming.length} Termine exportiert – einfach in deinen Kalender importieren.`)
  }

  const canCreate = isAdmin(me) || isCoach(me)

  return (
    <div>
      <PageHeader
        large
        title="Termine"
        actions={
          <>
            <IconButton label="In Kalender exportieren" onClick={exportIcs}>
              <CalendarPlus className="size-[22px]" />
            </IconButton>
            {canCreate && (
              <Link to="/termine/neu">
                <IconButton label="Neuer Termin" className="bg-brand-600 text-white hover:bg-brand-700">
                  <Plus className="size-5" />
                </IconButton>
              </Link>
            )}
          </>
        }
      />
      <div className="space-y-3 px-4 pb-2 pt-1">
        <FilterChips<Kind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'training', label: 'Training' },
            { value: 'game', label: 'Spiele' },
            { value: 'club', label: 'Verein' },
          ]}
        />
        <div className="flex gap-2">
          <Select value={team} onChange={(e) => setTeam(e.target.value)} className="flex-1 py-2 text-sm font-semibold" aria-label="Team filtern">
            {myTeamIds.length > 0 && <option value="mine">Meine Teams</option>}
            <option value="all">Alle Teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button variant={past ? 'primary' : 'outline'} size="md" onClick={() => setPast(!past)} icon={<History className="size-4" />} className="h-auto">
            Vergangene
          </Button>
        </div>
      </div>

      <div className="px-4">
        {events.isLoading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState icon={<CalendarX2 className="size-7" />} title="Keine Termine gefunden">
            Passe die Filter an.
          </EmptyState>
        ) : (
          groups.map(([day, list]) => (
            <section key={day}>
              <h2 className="sticky top-[calc(env(safe-area-inset-top)+64px)] z-10 -mx-4 mb-2 mt-4 bg-app/90 px-5 py-1.5 text-sm font-bold backdrop-blur md:top-[72px]">
                {fmtDayLabel(day, true)}
              </h2>
              <div className="space-y-3">
                {list.map((e) => {
                  const roster = rosterFor(e, members)
                  const targets = family.filter((f) => roster.some((r) => r.id === f.id))
                  const summary = me && e.rsvpEnabled ? summarize(e, members, rsvps.data ?? [], absences.data ?? [], teams) : null
                  return (
                    <EventCard
                      key={e.id}
                      event={e}
                      gender={summary && e.kind !== 'club' ? summary.yesByGender : undefined}
                      yesCount={summary && e.kind === 'club' ? summary.byStatus.yes.length : undefined}
                    >
                      {!past && me && e.rsvpEnabled
                        ? targets.map((f) => (
                            <RsvpControl
                              key={f.id}
                              event={e}
                              member={f}
                              compact
                              showName={targets.length > 1 || f.id !== me.id}
                              rsvp={effectiveRsvp(e, f.id, rsvps.data ?? [], absences.data ?? [], teams)}
                            />
                          ))
                        : null}
                    </EventCard>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
