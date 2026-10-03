import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Ban,
  BellRing,
  CalendarPlus,
  Car,
  Clock,
  Hourglass,
  MapPin,
  MoreHorizontal,
  Navigation,
  Pencil,
  Radio,
  Share2,
  Trash2,
  Users,
  UserPlus,
} from 'lucide-react'
import { club } from '@/config/club'
import { api } from '@/data'
import type { ClubEvent, Gender } from '@/data/types'
import { REASON_LABEL, STATUS_LABEL, summarize, effectiveRsvp, rosterFor, type EffectiveStatus } from '@/lib/attendance'
import { fmtCountdown, fmtDayLong, fmtRange, fmtTime } from '@/lib/dates'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { canManageEvent, canSeeReasons } from '@/lib/permissions'
import { byName, cn, fullName, mapsUrl, shareOrCopy, shortName } from '@/lib/util'
import { useAbsences, useApiMutation, useCarpools, useClub, useEvent, useGameActions, useRsvps } from '@/state/queries'
import { useMe } from '@/state/session'
import { GenderBalance, KindIcon, KIND_META, RsvpControl } from '@/components/events'
import { Scoreboard, ScorerTable, ShotBars, StatTiles, Ticker } from '@/components/game'
import { Avatar, Button, Card, Chip, EmptyState, Field, IconButton, Input, PageHeader, Segmented, SectionTitle, Sheet, Spinner, Textarea } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'
import { ResultImageButton } from '@/components/ResultImage'

export function EventDetail() {
  const { id } = useParams()
  const event = useEvent(id)
  const live = event.data?.game?.status === 'live' || event.data?.game?.status === 'halftime'
  const actions = useGameActions(id ? [id] : [], live)
  const [chosenTab, setTab] = useState<'info' | 'ticker' | 'stats' | null>(null)
  const tab = chosenTab ?? (live ? 'ticker' : 'info')

  if (event.isLoading) return <Spinner />
  if (!event.data) return <EmptyState icon={<Ban className="size-7" />} title="Termin nicht gefunden" />
  const e = event.data
  const isGame = !!e.game
  const hasTicker = isGame && (e.game!.status !== 'scheduled' || (actions.data?.length ?? 0) > 0)

  return (
    <div>
      <DetailHeader event={e} />
      <div className="px-4 pt-4">
        {isGame ? <Scoreboard event={e} /> : <EventHero event={e} />}

        {e.cancelled && (
          <div className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <Ban className="mt-0.5 size-5 shrink-0" />
            <div>
              <div className="font-bold">Dieser Termin fällt aus</div>
              {e.cancelReason && <div className="mt-0.5 text-sm">{e.cancelReason}</div>}
            </div>
          </div>
        )}

        {hasTicker && (
          <Segmented
            className="mt-4"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'info', label: 'Übersicht' },
              { value: 'ticker', label: live ? <span className="flex items-center gap-1.5"><span className="size-2 animate-pulse-dot rounded-full bg-brand-600" />Ticker</span> : 'Ticker' },
              { value: 'stats', label: 'Statistik' },
            ]}
          />
        )}

        {(!hasTicker || tab === 'info') && <InfoTab event={e} />}
        {hasTicker && tab === 'ticker' && <TickerTab event={e} />}
        {hasTicker && tab === 'stats' && <StatsTab event={e} />}
      </div>
    </div>
  )
}

function DetailHeader({ event }: { event: ClubEvent }) {
  const { me } = useMe()
  const { venues } = useClub()
  const navigate = useNavigate()
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const cancel = useApiMutation(() => api.cancelEvent(event.id, reason), ['events', 'notifications'])
  const del = useApiMutation(() => api.deleteEvent(event.id), ['events'])
  const manage = canManageEvent(me, event)

  const share = async () => {
    const g = event.game
    const text = g
      ? g.status === 'finished'
        ? `${club.name} ${g.scoreUs}:${g.scoreThem} ${g.opponent} (${g.competition})`
        : `${event.title} – ${fmtDayLong(event.start)}, ${fmtTime(event.start)} Uhr`
      : `${event.title} – ${fmtDayLong(event.start)}, ${fmtTime(event.start)} Uhr`
    const r = await shareOrCopy({ title: event.title, text, url: window.location.href })
    if (r === 'copied') toast('In die Zwischenablage kopiert')
  }

  return (
    <>
      <PageHeader
        back
        title={KIND_META[event.kind].label}
        subtitle={fmtDayLong(event.start)}
        actions={
          <>
            <IconButton label="Teilen" onClick={share}>
              <Share2 className="size-5" />
            </IconButton>
            <IconButton
              label="Zum Kalender hinzufügen"
              onClick={() => downloadIcs(`${event.title}.ics`, buildIcs([event], venues))}
            >
              <CalendarPlus className="size-5" />
            </IconButton>
            {manage && (
              <IconButton label="Mehr" onClick={() => setMenu(true)}>
                <MoreHorizontal className="size-5" />
              </IconButton>
            )}
          </>
        }
      />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Termin verwalten">
        <div className="space-y-2 pb-2">
          <Button variant="secondary" className="w-full justify-start" icon={<Pencil className="size-4" />} onClick={() => navigate(`/termine/${event.id}/bearbeiten`)}>
            Bearbeiten
          </Button>
          {!event.cancelled && (
            <Button variant="secondary" className="w-full justify-start" icon={<Ban className="size-4" />} onClick={() => (setMenu(false), setCancelOpen(true))}>
              Absagen & alle benachrichtigen
            </Button>
          )}
          <Button
            variant="danger"
            className="w-full justify-start"
            icon={<Trash2 className="size-4" />}
            onClick={() => {
              if (!confirm('Termin endgültig löschen?')) return
              del.mutate(undefined, { onSuccess: () => (toast('Termin gelöscht'), navigate('/termine')) })
            }}
          >
            Löschen
          </Button>
        </div>
      </Sheet>
      <Sheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Termin absagen"
        footer={
          <Button
            className="w-full"
            loading={cancel.isPending}
            onClick={() =>
              cancel.mutate(undefined, {
                onSuccess: () => {
                  setCancelOpen(false)
                  toast('Abgesagt – alle wurden benachrichtigt')
                },
                onError: (e) => toast(errorText(e), 'error'),
              })
            }
          >
            Absagen
          </Button>
        }
      >
        <Field label="Grund (wird allen angezeigt)">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. Halle gesperrt" />
        </Field>
      </Sheet>
    </>
  )
}

function EventHero({ event }: { event: ClubEvent }) {
  const { teamById } = useClub()
  return (
    <div className="flex items-start gap-4">
      <KindIcon kind={event.kind} size={56} />
      <div className="min-w-0">
        <h1 className={cn('text-2xl font-bold leading-tight', event.cancelled && 'line-through')}>{event.title}</h1>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {event.teamIds.length ? event.teamIds.map((t) => <Chip key={t}>{teamById.get(t)?.name}</Chip>) : <Chip tone="brand">Ganzer Verein</Chip>}
          {event.visibility === 'public' && <Chip tone="outline">öffentlich</Chip>}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Übersicht

function InfoTab({ event }: { event: ClubEvent }) {
  const { me, family } = useMe()
  const { members, teams, venueById } = useClub()
  const rsvps = useRsvps([event], !!me)
  const absences = useAbsences(!!me)
  const venue = event.venueId ? venueById.get(event.venueId) : undefined
  const roster = rosterFor(event, members)
  const targets = family.filter((f) => roster.some((r) => r.id === f.id))
  const upcoming = new Date(event.end) > new Date()
  const manage = canManageEvent(me, event)
  const g = event.game
  const isToday = new Date(event.start).toDateString() === new Date().toDateString()

  return (
    <div className="pb-6">
      <Card className="mt-4 divide-y divide-line">
        <InfoRow icon={<Clock className="size-5" />} title={fmtRange(event.start, event.end)} subtitle={fmtDayLong(event.start)} />
        {event.meetAt && <InfoRow icon={<Users className="size-5" />} title={`Treffpunkt ${fmtTime(event.meetAt)} Uhr`} subtitle={g && !g.home ? 'Abfahrt bzw. Treffen am Auto' : 'In der Halle, umgezogen'} />}
        {venue && (
          <InfoRow
            icon={<MapPin className="size-5" />}
            title={venue.name}
            subtitle={[venue.street, venue.city].filter(Boolean).join(', ')}
            right={
              <a href={mapsUrl(venue)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                <Navigation className="size-3.5" /> Route
              </a>
            }
          />
        )}
        {event.rsvpDeadline && new Date(event.start) > new Date() && event.rsvpEnabled && (
          <InfoRow icon={<Hourglass className="size-5" />} title={`Rückmeldung bis ${fmtTime(event.rsvpDeadline)} Uhr`} subtitle={`${fmtDayLong(event.rsvpDeadline)} · ${fmtCountdown(event.rsvpDeadline)}`} />
        )}
        {(event.description || venue?.notes) && (
          <div className="whitespace-pre-line px-4 py-3 text-[15px] leading-relaxed">
            {event.description}
            {venue?.notes && <p className="mt-2 text-sm text-muted">ℹ️ {venue.notes}</p>}
          </div>
        )}
      </Card>

      {g && manage && upcoming && g.status !== 'finished' && (
        <Link to={`/termine/${event.id}/live`}>
          <Button size="lg" className="mt-4 w-full" icon={<Radio className="size-5" />}>
            {g.status === 'scheduled' ? (isToday ? 'Live-Ticker starten' : 'Live-Erfassung öffnen') : 'Zur Live-Erfassung'}
          </Button>
        </Link>
      )}
      {g?.status === 'finished' && <ResultImageButton event={event} />}

      {me && event.rsvpEnabled && targets.length > 0 && !event.cancelled && upcoming && (
        <>
          <SectionTitle>{targets.length > 1 ? 'Eure Rückmeldung' : 'Deine Rückmeldung'}</SectionTitle>
          <Card className="space-y-4 p-4">
            {targets.map((f) => (
              <RsvpControl key={f.id} event={event} member={f} showName={targets.length > 1 || f.id !== me.id} rsvp={effectiveRsvp(event, f.id, rsvps.data ?? [], absences.data ?? [], teams)} />
            ))}
          </Card>
        </>
      )}

      {g && manage && <SquadCard event={event} />}

      {me && event.rsvpEnabled && <Attendance event={event} />}

      {me && (g || event.kind === 'club') && upcoming && !event.cancelled && <Carpools event={event} />}
    </div>
  )
}

function InfoRow({ icon, title, subtitle, right }: { icon: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        {subtitle && <div className="text-sm text-muted">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

function Attendance({ event }: { event: ClubEvent }) {
  const { me } = useMe()
  const { members, teams, memberById } = useClub()
  const rsvps = useRsvps([event])
  const absences = useAbsences()
  const toast = useToast()
  const [tab, setTab] = useState<EffectiveStatus>('yes')
  const s = useMemo(() => summarize(event, members, rsvps.data ?? [], absences.data ?? [], teams), [event, members, rsvps.data, absences.data, teams])
  const showReasons = canSeeReasons(me, event)
  const manage = canManageEvent(me, event)
  const remind = useApiMutation(() => api.remindOpen(event.id, s.byStatus.open.map((m) => m.id)), ['notifications'])
  const list = s.entries.filter((x) => x.rsvp.status === tab).sort((a, b) => byName(a.member, b.member))
  const upcoming = new Date(event.end) > new Date()

  return (
    <>
      <SectionTitle>Wer ist dabei?</SectionTitle>
      <Card className="p-4">
        {event.kind !== 'club' && <GenderBalance count={s.yesByGender} />}
        <Segmented
          className="mt-3"
          value={tab}
          onChange={setTab}
          options={(['yes', 'maybe', 'no', 'open'] as EffectiveStatus[]).map((st) => ({ value: st, label: STATUS_LABEL[st].replace('Nicht dabei', 'Absage'), count: s.byStatus[st].length }))}
        />
        <ul className="mt-2 divide-y divide-line">
          {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Niemand</li>}
          {list.map(({ member, rsvp }) => {
            const by = rsvp.rsvp && rsvp.rsvp.updatedBy !== member.id ? memberById.get(rsvp.rsvp.updatedBy) : undefined
            return (
              <li key={member.id} className="flex items-center gap-3 py-2.5">
                <Avatar member={member} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate font-semibold">
                    {fullName(member)}
                    {member.gender && <GenderDot g={member.gender} />}
                    {member.jerseyNumber != null && <span className="text-xs font-bold text-muted">#{member.jerseyNumber}</span>}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {rsvp.source === 'absence' && 'Abwesenheit eingetragen'}
                    {rsvp.source === 'default' && 'Standard-Zusage'}
                    {rsvp.source === 'explicit' && by && `über ${by.firstName}`}
                    {showReasons && rsvp.reason && ` · ${REASON_LABEL[rsvp.reason]}`}
                    {rsvp.comment && (showReasons || rsvp.status !== 'no') && ` · „${rsvp.comment}“`}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {manage && upcoming && s.byStatus.open.length > 0 && (
          <Button
            variant="secondary"
            className="mt-2 w-full"
            icon={<BellRing className="size-4" />}
            loading={remind.isPending}
            onClick={() => remind.mutate(undefined, { onSuccess: (n) => toast(`${n} Erinnerungen verschickt`) })}
          >
            {s.byStatus.open.length} offene erinnern
          </Button>
        )}
      </Card>
    </>
  )
}

const GenderDot = ({ g }: { g: Gender }) => (
  <span title={g === 'w' ? 'Dame' : 'Herr'} className={cn('inline-block size-2 rounded-full', g === 'w' ? 'bg-female' : 'bg-male')} />
)

// ------------------------------------------------------------------ Kader (Nominierung)

function SquadCard({ event }: { event: ClubEvent }) {
  const { members } = useClub()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const g = event.game!
  const teamPlayers = members.filter((m) => m.teamIds.some((t) => event.teamIds.includes(t))).sort(byName)
  const [sel, setSel] = useState<string[]>(g.squad)
  const save = useApiMutation(() => api.setSquad(event.id, sel), ['events', 'notifications'])
  const squad = members.filter((m) => g.squad.includes(m.id))
  const count = (ids: string[], gender: Gender) => members.filter((m) => ids.includes(m.id) && m.gender === gender).length

  return (
    <>
      <SectionTitle
        action={
          new Date(event.end) > new Date() && (
            <button onClick={() => (setSel(g.squad), setOpen(true))} className="flex items-center gap-1 text-sm font-semibold text-brand-600">
              <UserPlus className="size-4" /> {g.squad.length ? 'Ändern' : 'Nominieren'}
            </button>
          )
        }
      >
        Kader
      </SectionTitle>
      <Card className="p-4">
        {squad.length === 0 ? (
          <p className="text-sm text-muted">Noch kein Kader nominiert – aktuell ist das ganze Team angefragt.</p>
        ) : (
          <>
            <GenderBalance count={{ w: count(g.squad, 'w'), m: count(g.squad, 'm') }} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {squad.sort(byName).map((m) => (
                <Chip key={m.id} tone="outline">
                  {m.gender && <GenderDot g={m.gender} />} {shortName(m)}
                </Chip>
              ))}
            </div>
          </>
        )}
      </Card>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Kader nominieren"
        footer={
          <Button
            className="w-full"
            loading={save.isPending}
            onClick={() =>
              save.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false)
                  toast('Kader gespeichert – Nominierte wurden benachrichtigt')
                },
              })
            }
          >
            {sel.length} nominieren ({count(sel, 'w')} D / {count(sel, 'm')} H)
          </Button>
        }
      >
        {(['w', 'm'] as Gender[]).map((gender) => (
          <div key={gender} className="mb-4">
            <h3 className="mb-2 text-sm font-bold text-muted">{gender === 'w' ? 'Damen' : 'Herren'}</h3>
            <div className="grid grid-cols-2 gap-2">
              {teamPlayers
                .filter((m) => m.gender === gender)
                .map((m) => {
                  const on = sel.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSel(on ? sel.filter((x) => x !== m.id) : [...sel, m.id])}
                      className={cn('flex items-center gap-2 rounded-xl border p-2 text-left text-sm font-semibold transition', on ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/40' : 'border-line')}
                    >
                      <Avatar member={m} size={28} />
                      <span className="truncate">{shortName(m)}</span>
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </Sheet>
    </>
  )
}

// ------------------------------------------------------------------ Fahrgemeinschaften

function Carpools({ event }: { event: ClubEvent }) {
  const { me, family } = useMe()
  const { memberById } = useClub()
  const carpools = useCarpools(event.id)
  const toast = useToast()
  const [offer, setOffer] = useState(false)
  const [seats, setSeats] = useState(3)
  const [meetPoint, setMeetPoint] = useState('')
  const [departAt, setDepartAt] = useState(() => {
    const d = new Date(new Date(event.meetAt ?? event.start).getTime() - 30 * 60_000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const [note, setNote] = useState('')
  const join = useApiMutation((v: { id: string; member: string }) => api.joinCarpool(v.id, v.member), ['carpools'])
  const leave = useApiMutation((v: { id: string; member: string }) => api.leaveCarpool(v.id, v.member), ['carpools'])
  const remove = useApiMutation((id: string) => api.removeCarpool(id), ['carpools'])
  const create = useApiMutation(() => {
    const [h, m] = departAt.split(':').map(Number)
    const d = new Date(event.start)
    d.setHours(h, m, 0, 0)
    return api.offerCarpool({ eventId: event.id, driverId: me!.id, seats, meetPoint, departAt: d.toISOString(), note: note || undefined })
  }, ['carpools'])
  const riders = family.length ? family : me ? [me] : []
  const list = carpools.data ?? []
  const free = list.reduce((a, c) => a + Math.max(0, c.seats - c.passengerIds.length), 0)

  return (
    <>
      <SectionTitle action={<span className="text-xs font-semibold text-muted">{free} freie Plätze</span>}>Fahrgemeinschaften</SectionTitle>
      <div className="space-y-3">
        {list.map((c) => {
          const driver = memberById.get(c.driverId)
          const mine = c.driverId === me?.id
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                  <Car className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{driver ? fullName(driver) : 'Unbekannt'} fährt</div>
                  <div className="truncate text-sm text-muted">
                    {fmtTime(c.departAt)} Uhr · {c.meetPoint}
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {c.passengerIds.length}/{c.seats}
                </span>
              </div>
              {c.note && <p className="mt-2 text-sm text-muted">„{c.note}“</p>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {Array.from({ length: c.seats }).map((_, i) => {
                  const p = c.passengerIds[i] ? memberById.get(c.passengerIds[i]) : undefined
                  return p ? (
                    <Chip key={i} tone="outline">
                      {shortName(p)}
                    </Chip>
                  ) : (
                    <span key={i} className="rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-muted">
                      frei
                    </span>
                  )
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mine ? (
                  <Button size="sm" variant="danger" onClick={() => remove.mutate(c.id)}>
                    Angebot zurückziehen
                  </Button>
                ) : (
                  riders.map((r) => {
                    const inCar = c.passengerIds.includes(r.id)
                    const label = r.id === me?.id ? '' : ` (${r.firstName})`
                    return inCar ? (
                      <Button key={r.id} size="sm" variant="secondary" onClick={() => leave.mutate({ id: c.id, member: r.id })}>
                        Aussteigen{label}
                      </Button>
                    ) : (
                      <Button
                        key={r.id}
                        size="sm"
                        variant="outline"
                        disabled={c.passengerIds.length >= c.seats}
                        onClick={() =>
                          join.mutate(
                            { id: c.id, member: r.id },
                            { onSuccess: () => toast('Mitfahrt eingetragen 🚗'), onError: (e) => toast(errorText(e), 'error') },
                          )
                        }
                      >
                        Mitfahren{label}
                      </Button>
                    )
                  })
                )}
              </div>
            </Card>
          )
        })}
        <Button variant="outline" className="w-full border-dashed" icon={<Car className="size-4" />} onClick={() => setOffer(true)}>
          Ich kann fahren
        </Button>
      </div>
      <Sheet
        open={offer}
        onClose={() => setOffer(false)}
        title="Fahrt anbieten"
        footer={
          <Button
            className="w-full"
            disabled={!meetPoint}
            loading={create.isPending}
            onClick={() =>
              create.mutate(undefined, {
                onSuccess: () => {
                  setOffer(false)
                  toast('Danke fürs Fahren! 🙌')
                },
              })
            }
          >
            Fahrt anbieten
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Freie Plätze">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => setSeats(n)} className={cn('h-11 flex-1 rounded-xl border font-bold', seats === n ? 'border-brand-600 bg-brand-600 text-white' : 'border-line')}>
                  {n}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Treffpunkt">
            <Input value={meetPoint} onChange={(e) => setMeetPoint(e.target.value)} placeholder="z. B. Parkplatz an der Halle" />
          </Field>
          <Field label="Abfahrt">
            <Input type="time" value={departAt} onChange={(e) => setDepartAt(e.target.value)} />
          </Field>
          <Field label="Hinweis (optional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Kindersitz vorhanden" />
          </Field>
        </div>
      </Sheet>
    </>
  )
}

// ------------------------------------------------------------------ Ticker & Statistik

function TickerTab({ event }: { event: ClubEvent }) {
  const { memberById } = useClub()
  const actions = useGameActions([event.id], event.game?.status === 'live' || event.game?.status === 'halftime')
  return (
    <Card className="mt-4 p-3">
      <Ticker event={event} actions={actions.data ?? []} memberById={memberById} />
    </Card>
  )
}

function StatsTab({ event }: { event: ClubEvent }) {
  const { memberById } = useClub()
  const actions = useGameActions([event.id])
  const list = actions.data ?? []
  return (
    <div className="pb-6">
      <Card className="mt-4 p-4">
        <StatTiles actions={list} />
      </Card>
      <SectionTitle>Torschützen</SectionTitle>
      <Card className="px-4 py-1">
        <ScorerTable actions={list} memberById={memberById} />
      </Card>
      <SectionTitle>Wurfquoten nach Wurfart</SectionTitle>
      <Card className="p-4">
        <ShotBars actions={list} />
      </Card>
    </div>
  )
}

