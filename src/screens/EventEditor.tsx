import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { format } from 'date-fns'
import { club } from '@/config/club'
import { api } from '@/data'
import type { ClubEvent, EventKind } from '@/data/types'
import { canManageEvent, isAdmin } from '@/lib/permissions'
import { useApiMutation, useClub, useEvent } from '@/state/queries'
import { useMe } from '@/state/session'
import { Button, Card, Field, Input, PageHeader, Segmented, Select, Spinner, Textarea, Toggle } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'

const at = (day: string, time: string) => new Date(`${day}T${time}`).toISOString()
const hhmm = (iso?: string) => (iso ? format(new Date(iso), 'HH:mm') : '')

export function EventEditor() {
  const { id } = useParams()
  const existing = useEvent(id)
  if (id && existing.isLoading) return <Spinner />
  return <EditorForm key={id ?? 'new'} initial={existing.data ?? undefined} />
}

function EditorForm({ initial }: { initial?: ClubEvent }) {
  const { me } = useMe()
  const { teams, venues, teamById } = useClub()
  const navigate = useNavigate()
  const toast = useToast()
  const allowedTeams = isAdmin(me) ? teams : teams.filter((t) => me?.coachOf.includes(t.id))

  const [kind, setKind] = useState<EventKind>(initial?.kind ?? 'training')
  const [teamId, setTeamId] = useState(initial?.teamIds[0] ?? allowedTeams[0]?.id ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [titleTouched, setTitleTouched] = useState(!!initial)
  const [day, setDay] = useState(initial ? initial.start.slice(0, 10) : format(new Date(Date.now() + 86_400_000), 'yyyy-MM-dd'))
  const [start, setStart] = useState(hhmm(initial?.start) || '19:00')
  const [end, setEnd] = useState(hhmm(initial?.end) || '21:00')
  const [meet, setMeet] = useState(hhmm(initial?.meetAt))
  const [deadlineHours, setDeadlineHours] = useState(() => (initial?.rsvpDeadline ? String(Math.round((new Date(initial.start).getTime() - new Date(initial.rsvpDeadline).getTime()) / 3600_000)) : '3'))
  const [venueId, setVenueId] = useState(initial?.venueId ?? venues[0]?.id ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isPublic, setPublic] = useState(initial ? initial.visibility === 'public' : true)
  const [rsvpEnabled, setRsvp] = useState(initial?.rsvpEnabled ?? true)
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState(format(new Date(Date.now() + 90 * 86_400_000), 'yyyy-MM-dd'))
  const [opponent, setOpponent] = useState(initial?.game?.opponent ?? '')
  const [home, setHome] = useState(initial?.game?.home ?? true)
  const [competition, setCompetition] = useState(initial?.game?.competition ?? teamById.get(teamId)?.league ?? 'Liga')
  const [halfMinutes, setHalf] = useState(initial?.game?.halfMinutes ?? 30)

  // Titel automatisch vorschlagen, solange er nicht von Hand geändert wurde
  useEffect(() => {
    if (titleTouched) return
    const team = teamById.get(teamId)
    if (kind === 'training') setTitle(`Training ${team?.name ?? ''}`.trim())
    else if (kind === 'game') setTitle(opponent ? (home ? `${club.name} – ${opponent}` : `${opponent} – ${club.name}`) : '')
  }, [kind, teamId, opponent, home, teamById, titleTouched])

  const save = useApiMutation(() => {
    const startIso = at(day, start)
    let endIso = at(day, end)
    if (endIso <= startIso) endIso = new Date(new Date(startIso).getTime() + 2 * 3600_000).toISOString()
    const ev: Omit<ClubEvent, 'id'> & { id?: string } = {
      id: initial?.id,
      kind,
      title,
      teamIds: kind === 'club' && !teamId ? [] : [teamId].filter(Boolean),
      start: startIso,
      end: endIso,
      venueId: venueId || undefined,
      meetAt: meet ? at(day, meet) : undefined,
      rsvpDeadline: rsvpEnabled && Number(deadlineHours) > 0 ? new Date(new Date(startIso).getTime() - Number(deadlineHours) * 3600_000).toISOString() : undefined,
      description: description || undefined,
      rsvpEnabled,
      visibility: isPublic ? 'public' : 'members',
      seriesId: initial?.seriesId,
      cancelled: initial?.cancelled,
      cancelReason: initial?.cancelReason,
      game:
        kind === 'game'
          ? {
              opponent,
              home,
              competition,
              halfMinutes,
              status: initial?.game?.status ?? 'scheduled',
              scoreUs: initial?.game?.scoreUs,
              scoreThem: initial?.game?.scoreThem,
              squad: initial?.game?.squad ?? [],
              period: initial?.game?.period,
              periodStartedAt: initial?.game?.periodStartedAt,
            }
          : undefined,
    }
    return api.saveEvent(ev, repeat && !initial ? { repeatWeeklyUntil: until } : undefined)
  }, ['events', 'notifications'])

  if (!me || (initial ? !canManageEvent(me, initial) : allowedTeams.length === 0)) return <Navigate to="/termine" replace />

  return (
    <div>
      <PageHeader back title={initial ? 'Termin bearbeiten' : 'Neuer Termin'} />
      <form
        className="space-y-4 px-4 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(undefined, {
            onSuccess: (ev) => {
              toast(initial ? 'Gespeichert' : repeat ? 'Serie angelegt' : 'Termin angelegt – Team wurde benachrichtigt')
              navigate(initial || !repeat ? `/termine/${ev.id}` : '/termine', { replace: true })
            },
            onError: (err) => toast(errorText(err), 'error'),
          })
        }}
      >
        {!initial && (
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'training', label: 'Training' },
              { value: 'game', label: 'Spiel' },
              ...(isAdmin(me) ? [{ value: 'club' as const, label: 'Verein' }] : []),
            ]}
          />
        )}
        <Field label="Team">
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {kind === 'club' && isAdmin(me) && <option value="">Ganzer Verein</option>}
            {allowedTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>

        {kind === 'game' && (
          <Card className="space-y-4 p-4">
            <Field label="Gegner">
              <Input required value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="z. B. KV Adler Rauxel" />
            </Field>
            <Segmented value={home ? 'home' : 'away'} onChange={(v) => setHome(v === 'home')} options={[{ value: 'home', label: 'Heimspiel' }, { value: 'away', label: 'Auswärts' }]} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Wettbewerb">
                <Input value={competition} onChange={(e) => setCompetition(e.target.value)} />
              </Field>
              <Field label="Halbzeit (Min.)">
                <Input type="number" min={5} max={45} value={halfMinutes} onChange={(e) => setHalf(Number(e.target.value))} />
              </Field>
            </div>
          </Card>
        )}

        <Field label="Titel">
          <Input
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleTouched(true)
            }}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Datum">
            <Input type="date" required value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Beginn">
            <Input type="time" required value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Ende">
            <Input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Treffpunkt (optional)">
            <Input type="time" value={meet} onChange={(e) => setMeet(e.target.value)} />
          </Field>
          <Field label="Ort">
            <Select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              <option value="">–</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Beschreibung">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Infos, Mitbringen, Besonderheiten …" />
        </Field>

        <Card className="divide-y divide-line px-4">
          <Toggle checked={rsvpEnabled} onChange={setRsvp} label="Zu-/Absagen abfragen" />
          {rsvpEnabled && (
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium">Rückmeldefrist</span>
              <Select value={deadlineHours} onChange={(e) => setDeadlineHours(e.target.value)} className="w-auto py-1.5 text-sm">
                <option value="0">keine</option>
                <option value="3">3 Std. vorher</option>
                <option value="24">1 Tag vorher</option>
                <option value="48">2 Tage vorher</option>
                <option value="72">3 Tage vorher</option>
                <option value="168">1 Woche vorher</option>
              </Select>
            </div>
          )}
          <Toggle checked={isPublic} onChange={setPublic} label="Öffentlich sichtbar" description="Auch Gäste sehen den Termin (ohne Teilnehmerliste)" />
          {!initial && <Toggle checked={repeat} onChange={setRepeat} label="Wöchentlich wiederholen" description="z. B. für feste Trainingszeiten" />}
          {repeat && !initial && (
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="font-medium">bis einschließlich</span>
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-auto py-1.5 text-sm" />
            </div>
          )}
        </Card>

        <Button type="submit" size="lg" className="w-full" loading={save.isPending}>
          {initial ? 'Speichern' : 'Anlegen & Team benachrichtigen'}
        </Button>
      </form>
    </div>
  )
}
