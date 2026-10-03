import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CalendarOff, CalendarPlus, ChartColumn, LogOut, Phone, Plane, Plus, Settings, Trash2 } from 'lucide-react'
import { api } from '@/data'
import type { AbsenceReason } from '@/data/types'
import { REASON_LABEL, REASONS, trainingRate } from '@/lib/attendance'
import { fmt } from '@/lib/dates'
import { buildIcs, downloadIcs } from '@/lib/ics'
import { roleLabel } from '@/lib/permissions'
import { playerStats } from '@/lib/stats'
import { cn, fullName } from '@/lib/util'
import { useAbsences, useApiMutation, useClub, useEvents, useGameActions, useHelperLists, useRsvps } from '@/state/queries'
import { useMe } from '@/state/session'
import { Avatar, Button, Card, Chip, Field, Input, ListRow, PageHeader, SectionTitle, Select, Sheet } from '@/components/ui'
import { useToast } from '@/components/Toast'
import { LoginRequired } from './More'

export function Profile() {
  const { me, family, signOut } = useMe()
  const { teamById, teams, members, venues } = useClub()
  const events = useEvents()
  const absences = useAbsences(!!me)
  const helpers = useHelperLists()
  const navigate = useNavigate()
  const toast = useToast()
  const [absenceOpen, setAbsenceOpen] = useState(false)
  const pastTrainings = useMemo(
    () => (events.data ?? []).filter((e) => e.kind === 'training' && new Date(e.end) < new Date() && me && e.teamIds.some((t) => me.teamIds.includes(t))),
    [events.data, me],
  )
  const rsvps = useRsvps(pastTrainings, !!me)
  const finishedGames = useMemo(() => (events.data ?? []).filter((e) => e.game?.status === 'finished'), [events.data])
  const actions = useGameActions(finishedGames.map((g) => g.id))
  const removeAbsence = useApiMutation((id: string) => api.removeAbsence(id), ['absences'])

  if (!me) return <LoginRequired title="Profil" />

  const rate = trainingRate(me.id, pastTrainings, rsvps.data ?? [], absences.data ?? [], teams, members)
  const myStats = playerStats((actions.data ?? []).filter((a) => a.memberId === me.id))[0]
  const shifts = (helpers.data ?? []).flatMap((l) => l.shifts).filter((s) => s.signupIds.includes(me.id)).length
  const familyIds = new Set([me.id, ...family.map((f) => f.id)])
  const myAbsences = (absences.data ?? []).filter((a) => familyIds.has(a.memberId) && a.to >= new Date().toISOString().slice(0, 10))
  const kids = family.filter((f) => f.id !== me.id)

  const exportMine = () => {
    const teamIds = new Set([...family.flatMap((f) => f.teamIds), ...me.coachOf])
    const list = (events.data ?? []).filter((e) => new Date(e.end) > new Date() && (e.teamIds.length === 0 || e.teamIds.some((t) => teamIds.has(t))))
    downloadIcs('meine-skc-termine.ics', buildIcs(list, venues, 'SKC – Meine Termine'))
    toast(`${list.length} Termine exportiert`)
  }

  return (
    <div>
      <PageHeader
        back
        title="Mein Profil"
        actions={
          <Link to="/einstellungen" aria-label="Einstellungen" className="grid size-10 place-items-center rounded-full hover:bg-surface-2">
            <Settings className="size-5" />
          </Link>
        }
      />
      <div className="px-4 pb-10">
        <div className="mt-5 flex flex-col items-center text-center">
          <Avatar member={me} size={88} />
          <h1 className="mt-3 text-2xl font-bold">{fullName(me)}</h1>
          <p className="text-sm text-muted">{roleLabel(me)}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {me.teamIds.map((t) => (
              <Chip key={t} tone="brand">
                {teamById.get(t)?.name}
              </Chip>
            ))}
            {me.jerseyNumber != null && <Chip>#{me.jerseyNumber}</Chip>}
          </div>
        </div>

        {me.teamIds.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <StatTile value={rate.total ? `${Math.round(rate.rate * 100)} %` : '–'} label="Training" sub={`${rate.attended}/${rate.total}`} />
            <StatTile value={myStats?.goals ?? 0} label="Körbe" sub={myStats ? `${myStats.games} Spiele` : 'Saison'} />
            <StatTile value={shifts} label="Helfereinsätze" sub="anstehend" />
          </div>
        )}

        {kids.length > 0 && (
          <>
            <SectionTitle>Meine Kinder</SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              {kids.map((k) => (
                <ListRow key={k.id} to={`/statistik/${k.id}`} icon={<Avatar member={k} size={36} />} title={fullName(k)} subtitle={k.teamIds.map((t) => teamById.get(t)?.name).join(', ')} />
              ))}
            </Card>
            <p className="mt-2 px-1 text-xs text-muted">Du kannst für deine Kinder zu- und absagen, sie zu Fahrgemeinschaften anmelden und Abwesenheiten eintragen.</p>
          </>
        )}

        <SectionTitle
          action={
            <button onClick={() => setAbsenceOpen(true)} className="flex items-center gap-1 text-sm font-semibold text-brand-600 dark:text-brand-400">
              <Plus className="size-4" /> Eintragen
            </button>
          }
        >
          Abwesenheiten
        </SectionTitle>
        <Card className="p-1">
          {myAbsences.length === 0 ? (
            <div className="flex items-center gap-3 p-3 text-sm text-muted">
              <Plane className="size-5 shrink-0" />
              Urlaub, Verletzung oder Klassenfahrt? Einmal eintragen – du wirst automatisch für alle Termine in dem Zeitraum abgemeldet.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {myAbsences.map((a) => {
                const who = members.find((m) => m.id === a.memberId)
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                      <CalendarOff className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {fmt(a.from, 'd. MMM')} – {fmt(a.to, 'd. MMM yyyy')}
                      </div>
                      <div className="truncate text-sm text-muted">
                        {REASON_LABEL[a.reason]}
                        {a.note && ` · ${a.note}`}
                        {who && who.id !== me.id && ` · ${who.firstName}`}
                      </div>
                    </div>
                    <button onClick={() => removeAbsence.mutate(a.id)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Abwesenheit löschen">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <SectionTitle>Mehr</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          {me.teamIds.length > 0 && <ListRow to={`/statistik/${me.id}`} icon={<ChartColumn className="size-5" />} title="Meine Statistik" subtitle="Körbe, Wurfquoten, Spiele" />}
          <ListRow onClick={exportMine} icon={<CalendarPlus className="size-5" />} title="Meine Termine in den Kalender" subtitle="iPhone-, Google- oder Outlook-Kalender" />
          <ContactRow />
          <ListRow
            onClick={async () => {
              await signOut()
              navigate('/login')
            }}
            icon={<LogOut className="size-5" />}
            title="Abmelden"
            chevron={false}
          />
        </Card>
      </div>
      <AbsenceSheet open={absenceOpen} onClose={() => setAbsenceOpen(false)} />
    </div>
  )
}

function StatTile({ value, label, sub }: { value: React.ReactNode; label: string; sub?: string }) {
  return (
    <Card className="px-2 py-3 text-center">
      <div className="font-display text-3xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs font-semibold">{label}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </Card>
  )
}

function ContactRow() {
  const { me } = useMe()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState(me?.phone ?? '')
  const toast = useToast()
  const save = useApiMutation(() => api.updateMember(me!.id, { phone: phone || undefined }), ['members'])
  return (
    <>
      <ListRow onClick={() => setOpen(true)} icon={<Phone className="size-5" />} title="Kontaktdaten" subtitle={me?.phone ?? 'Telefonnummer hinterlegen'} />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Kontaktdaten"
        footer={
          <Button className="w-full" loading={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => (setOpen(false), toast('Gespeichert')) })}>
            Speichern
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="E-Mail" hint="Änderungen bitte über den Vorstand.">
            <Input value={me?.email ?? ''} disabled />
          </Field>
          <Field label="Telefon" hint="Nur für Trainer:innen und Vorstand sichtbar – z. B. für kurzfristige Absagen.">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+49 …" />
          </Field>
        </div>
      </Sheet>
    </>
  )
}

function AbsenceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, family } = useMe()
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [memberId, setMemberId] = useState(me?.id ?? '')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [reason, setReason] = useState<AbsenceReason>('urlaub')
  const [note, setNote] = useState('')
  const people = me ? [me, ...family.filter((f) => f.id !== me.id)] : []
  const save = useApiMutation(() => api.addAbsence({ memberId: memberId || me!.id, from, to: to < from ? from : to, reason, note: note || undefined }), ['absences'])
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Abwesenheit eintragen"
      footer={
        <Button
          className="w-full"
          loading={save.isPending}
          onClick={() =>
            save.mutate(undefined, {
              onSuccess: () => {
                onClose()
                toast('Eingetragen – Termine im Zeitraum sind automatisch abgesagt')
              },
            })
          }
        >
          Speichern
        </Button>
      }
    >
      <div className="space-y-4">
        {people.length > 1 && (
          <Field label="Für">
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === me?.id ? 'Mich' : p.firstName}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Von">
            <Input type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Bis">
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Grund">
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-full border px-3.5 py-2 text-sm font-semibold', reason === r ? 'border-brand-600 bg-brand-600 text-white' : 'border-line')}>
                {REASON_LABEL[r]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notiz (optional)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Sommerurlaub" />
        </Field>
      </div>
    </Sheet>
  )
}
