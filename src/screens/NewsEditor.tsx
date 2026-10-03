import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { Plus, X } from 'lucide-react'
import { api } from '@/data'
import type { NewsCategory } from '@/data/types'
import { canPostNews, isAdmin } from '@/lib/permissions'
import { useApiMutation, useClub } from '@/state/queries'
import { useMe } from '@/state/session'
import { Button, Card, Field, Input, PageHeader, Segmented, Select, Textarea, Toggle } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'

export function NewsEditor() {
  const { me } = useMe()
  const { teams } = useClub()
  const navigate = useNavigate()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<NewsCategory>('Verein')
  const [teamId, setTeamId] = useState(isAdmin(me) ? '' : (me?.coachOf[0] ?? ''))
  const [pinned, setPinned] = useState(false)
  const [isPublic, setPublic] = useState(true)
  const [withPoll, setWithPoll] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [multi, setMulti] = useState(false)

  const save = useApiMutation(
    () =>
      api.createPost({
        title,
        body,
        category,
        teamId: teamId || undefined,
        pinned,
        visibility: isPublic && !withPoll ? 'public' : 'members',
        poll: withPoll ? { question: question || title, options: options.filter(Boolean), multi } : undefined,
      }),
    ['news', 'notifications'],
  )
  if (!canPostNews(me)) return <Navigate to="/news" replace />
  const teamOptions = isAdmin(me) ? teams : teams.filter((t) => me!.coachOf.includes(t.id))

  return (
    <div>
      <PageHeader back title="Neuer Beitrag" />
      <form
        className="space-y-4 px-4 py-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(undefined, {
            onSuccess: () => {
              toast('Veröffentlicht – alle wurden benachrichtigt')
              navigate('/news')
            },
            onError: (err) => toast(errorText(err), 'error'),
          })
        }}
      >
        <Field label="Kategorie">
          <Segmented
            value={category}
            onChange={setCategory}
            options={(['Verein', 'Spielbericht', 'Jugend', 'Info'] as NewsCategory[]).map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="Titel">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Text">
          <Textarea required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Für">
          <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {isAdmin(me) && <option value="">Ganzen Verein</option>}
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Card className="divide-y divide-line px-4">
          {isAdmin(me) && <Toggle checked={pinned} onChange={setPinned} label="Oben anpinnen" />}
          <Toggle checked={isPublic} onChange={setPublic} label="Öffentlich" description="Auch für Gäste ohne Anmeldung sichtbar" />
          <Toggle checked={withPoll} onChange={setWithPoll} label="Mit Umfrage" />
        </Card>
        {withPoll && (
          <Card className="space-y-3 p-4">
            <Field label="Frage">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={title} />
            </Field>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} placeholder={`Option ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                {options.length > 2 && (
                  <Button type="button" variant="ghost" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Option entfernen">
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" icon={<Plus className="size-4" />} onClick={() => setOptions([...options, ''])}>
              Option
            </Button>
            <Toggle checked={multi} onChange={setMulti} label="Mehrfachauswahl erlauben" />
          </Card>
        )}
        <Button type="submit" size="lg" className="w-full" loading={save.isPending}>
          Veröffentlichen
        </Button>
      </form>
    </div>
  )
}
