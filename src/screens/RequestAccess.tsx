import { useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck } from 'lucide-react'
import { api } from '@/data'
import type { AccessRequest, Gender } from '@/data/types'
import { useClub } from '@/state/queries'
import { Button, Field, Input, PageHeader, Segmented, Select, Textarea } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'

export function RequestAccess() {
  const { teams } = useClub()
  const toast = useToast()
  const [kind, setKind] = useState<AccessRequest['kind']>('player')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [teamId, setTeamId] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [childName, setChildName] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.requestAccess({
        kind,
        name: name.trim(),
        email: email.trim(),
        teamId: teamId || undefined,
        gender: gender || undefined,
        childName: kind === 'parent' ? childName.trim() : undefined,
        message: message.trim() || undefined,
      })
      setDone(true)
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-app">
      <PageHeader title="Zugang anfragen" back="/login" />
      <div className="mx-auto max-w-md px-4 py-5">
        {done ? (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center">
            <CircleCheck className="mx-auto size-14 text-green-600" />
            <h2 className="mt-3 text-xl font-bold">Danke, {name.split(' ')[0]}!</h2>
            <p className="mt-2 text-muted">Der Vorstand prüft deine Anfrage. Sobald du freigeschaltet bist, bekommst du eine E-Mail mit deinem Login-Link.</p>
            <Link to="/login" className="mt-6 inline-block font-semibold text-brand-600">
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-3xl border border-line bg-surface p-5">
            <Field label="Ich bin …">
              <Segmented
                value={kind}
                onChange={setKind}
                options={[
                  { value: 'player', label: 'Spieler:in' },
                  { value: 'parent', label: 'Elternteil' },
                  { value: 'coach', label: 'Trainer:in' },
                  { value: 'fan', label: 'Fan' },
                ]}
              />
            </Field>
            <Field label="Vor- und Nachname">
              <Input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="E-Mail">
              <Input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {kind === 'parent' && (
              <Field label="Name deines Kindes">
                <Input required value={childName} onChange={(e) => setChildName(e.target.value)} />
              </Field>
            )}
            {kind !== 'fan' && (
              <Field label={kind === 'parent' ? 'Team deines Kindes' : 'Team'}>
                <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                  <option value="">Weiß ich noch nicht</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {kind === 'player' && (
              <Field label="In der Aufstellung zähle ich als" hint="Korfball wird mit 4 Damen und 4 Herren gespielt – wichtig für die Kaderplanung.">
                <Segmented value={gender || ('' as Gender)} onChange={(v) => setGender(v)} options={[{ value: 'w', label: 'Dame' }, { value: 'm', label: 'Herr' }]} />
              </Field>
            )}
            <Field label="Nachricht (optional)">
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="z. B. „Ich möchte gern ein Probetraining machen.“" />
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-brand-600" />
              <span className="text-muted">
                Ich bin einverstanden, dass meine Angaben zur Bearbeitung der Anfrage gespeichert werden. <Link to="/datenschutz" className="font-semibold text-brand-600 underline">Datenschutz</Link>
              </span>
            </label>
            <Button type="submit" size="lg" className="w-full" loading={busy}>
              Anfrage senden
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
