import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '@/data'
import type { ShiftIcon } from '@/data/types'
import { canManageHelpers } from '@/lib/permissions'
import { cn } from '@/lib/util'
import { useApiMutation, useClub, useEvents } from '@/state/queries'
import { useMe } from '@/state/session'
import { Button, Card, Field, Input, PageHeader, Select, Textarea } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'
import { SHIFT_ICON } from './Helpers'

interface ShiftDraft {
  title: string
  from: string
  to: string
  slots: number
  icon: ShiftIcon
}

const TEMPLATES: ShiftDraft[] = [
  { title: 'Aufbau', from: '13:00', to: '14:00', slots: 3, icon: 'wrench' },
  { title: 'Kampfgericht & Zeitnahme', from: '14:00', to: '16:00', slots: 2, icon: 'clock' },
  { title: 'Kuchenverkauf', from: '14:00', to: '17:00', slots: 2, icon: 'cake' },
  { title: 'Kasse', from: '14:00', to: '16:00', slots: 2, icon: 'cash' },
  { title: 'Abbau', from: '17:00', to: '18:00', slots: 3, icon: 'broom' },
]

export function HelperListEditor() {
  const { me } = useMe()
  const { venues } = useClub()
  const events = useEvents()
  const navigate = useNavigate()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10))
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const [eventId, setEventId] = useState('')
  const [shifts, setShifts] = useState<ShiftDraft[]>(TEMPLATES)
  const save = useApiMutation(
    () =>
      api.saveHelperList({
        title,
        description: description || undefined,
        date,
        venueId: venueId || undefined,
        eventId: eventId || undefined,
        shifts: shifts.map((s) => ({
          title: s.title,
          slots: s.slots,
          icon: s.icon,
          start: new Date(`${date}T${s.from}`).toISOString(),
          end: new Date(`${date}T${s.to}`).toISOString(),
        })),
      }),
    ['helpers', 'notifications'],
  )

  if (!canManageHelpers(me)) return <Navigate to="/helfen" replace />
  const upcomingEvents = (events.data ?? []).filter((e) => e.kind !== 'training' && new Date(e.start) > new Date())
  const update = (i: number, patch: Partial<ShiftDraft>) => setShifts(shifts.map((s, j) => (i === j ? { ...s, ...patch } : s)))

  return (
    <div>
      <PageHeader back title="Neue Helferliste" />
      <form
        className="space-y-4 px-4 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(undefined, {
            onSuccess: () => {
              toast('Helferliste veröffentlicht – alle wurden benachrichtigt')
              navigate('/helfen')
            },
            onError: (err) => toast(errorText(err), 'error'),
          })
        }}
      >
        <Field label="Titel">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Heimspieltag 1. & 2. Mannschaft" />
        </Field>
        <Field label="Beschreibung">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum">
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ort">
            <Select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Verknüpfter Termin (optional)">
          <Select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value)
              const ev = upcomingEvents.find((x) => x.id === e.target.value)
              if (ev) {
                setDate(ev.start.slice(0, 10))
                if (!title) setTitle(ev.title)
              }
            }}
          >
            <option value="">Keiner</option>
            {upcomingEvents.map((e) => (
              <option key={e.id} value={e.id}>
                {e.start.slice(0, 10)} · {e.title}
              </option>
            ))}
          </Select>
        </Field>

        <h2 className="pt-2 font-bold">Schichten</h2>
        {shifts.map((s, i) => (
          <Card key={i} className="space-y-3 p-4">
            <div className="flex gap-2">
              <Input value={s.title} onChange={(e) => update(i, { title: e.target.value })} required />
              <Button type="button" variant="danger" onClick={() => setShifts(shifts.filter((_, j) => j !== i))} aria-label="Schicht entfernen">
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input type="time" value={s.from} onChange={(e) => update(i, { from: e.target.value })} aria-label="Von" />
              <Input type="time" value={s.to} onChange={(e) => update(i, { to: e.target.value })} aria-label="Bis" />
              <Input type="number" min={1} max={30} value={s.slots} onChange={(e) => update(i, { slots: Number(e.target.value) })} aria-label="Plätze" />
            </div>
            <div className="flex gap-1.5">
              {(Object.keys(SHIFT_ICON) as ShiftIcon[]).map((ic) => {
                const Icon = SHIFT_ICON[ic]
                return (
                  <button type="button" key={ic} onClick={() => update(i, { icon: ic })} className={cn('grid size-9 place-items-center rounded-lg border', s.icon === ic ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'border-line text-muted')}>
                    <Icon className="size-4" />
                  </button>
                )
              })}
            </div>
          </Card>
        ))}
        <Button type="button" variant="outline" className="w-full border-dashed" icon={<Plus className="size-4" />} onClick={() => setShifts([...shifts, { title: 'Neue Schicht', from: '14:00', to: '16:00', slots: 2, icon: 'heart' }])}>
          Schicht hinzufügen
        </Button>
        <Button type="submit" size="lg" className="w-full" loading={save.isPending} disabled={!shifts.length}>
          Veröffentlichen
        </Button>
      </form>
    </div>
  )
}
