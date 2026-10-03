import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ArrowRight, Eye, EyeOff, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { club } from '@/config/club'
import { api } from '@/data'
import { PERSONAS } from '@/data/demo/seed'
import { useMe } from '@/state/session'
import { Button, Field, Input } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'
import { cn } from '@/lib/util'

/** Im lokalen Betrieb (npm run lokal) landen Anmeldecodes in einem Test-Postfach */
const LOCAL_MAIL = import.meta.env.VITE_LOCAL_MAIL_URL as string | undefined

const PERSONA_HUE: Record<string, number> = { 'm-lena': 350, 'm-tim': 210, 'm-sabine': 30, 'm-andrea': 140 }

export function Login() {
  const { me, signInDemo, afterSignIn, continueAsGuest } = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mode, setMode] = useState<'code' | 'password'>('code')
  const [codeSent, setCodeSent] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  if (me) return <Navigate to="/" replace />

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    void run('form', async () => {
      if (mode === 'password') {
        await api.signInWithPassword(email, password)
      } else if (!codeSent) {
        await api.sendLoginCode(email)
        setCodeSent(true)
        return
      } else {
        await api.verifyLoginCode(email, code)
      }
      await afterSignIn()
      navigate('/')
    })
  }

  const demo = (id: string) =>
    run(id, async () => {
      await signInDemo(id)
      navigate('/')
    })

  return (
    <div className="min-h-dvh bg-app">
      <div className="hero-stripes pt-safe relative overflow-hidden pb-24 text-white">
        <div className="mx-auto flex max-w-md flex-col items-center px-6 pt-10 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-24 drop-shadow-[0_8px_24px_rgb(0_0_0/0.35)]" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-white/80">{club.fullName}</p>
          <h1 className="mt-1 font-display text-5xl font-bold uppercase italic leading-none">Unsere App</h1>
          <p className="mt-3 max-w-xs text-[15px] text-white/85">Trainings, Spiele, Live-Ticker, Helferlisten und alles rund um den {club.short} – in einer App.</p>
        </div>
      </div>

      <div className="relative mx-auto -mt-16 max-w-md px-4 pb-10">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl shadow-black/5">
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-xl font-bold">Anmelden</h2>
            <Field label="E-Mail">
              <Input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="name@beispiel.de"
                value={email}
                disabled={codeSent}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {mode === 'password' && (
              <Field label="Passwort">
                <div className="relative">
                  <Input type={showPw ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-muted" aria-label={showPw ? 'Passwort verbergen' : 'Passwort anzeigen'}>
                    {showPw ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </Field>
            )}
            {mode === 'code' && codeSent && (
              <>
                <div className="flex items-start gap-3 rounded-2xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
                  <Mail className="mt-0.5 size-5 shrink-0" />
                  <span>
                    Wir haben dir einen 6-stelligen Code an <b>{email}</b> geschickt.
                    {api.mode === 'demo' && ' (Demo: beliebige 6 Ziffern eingeben)'}
                  </span>
                </div>
                <Field label="Anmeldecode">
                  <Input
                    autoFocus
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-2xl tracking-[0.5em]"
                  />
                </Field>
              </>
            )}
            <Button type="submit" size="lg" className="w-full" loading={busy === 'form'}>
              {mode === 'password' ? 'Anmelden' : codeSent ? 'Code bestätigen' : 'Anmeldecode per E-Mail senden'}
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-brand-600 dark:text-brand-400">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'code' ? 'password' : 'code')
                  setCodeSent(false)
                }}
              >
                {mode === 'password' ? 'Passwort vergessen? Mit Code anmelden' : 'Mit Passwort anmelden'}
              </button>
              {codeSent && (
                <button type="button" onClick={() => (setCodeSent(false), setCode(''))}>
                  Andere E-Mail
                </button>
              )}
            </div>
            <p className="flex items-start gap-2 text-xs text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              {api.mode === 'demo'
                ? 'Demo-Modus: Alle Daten sind Beispiele und bleiben nur auf diesem Gerät.'
                : LOCAL_MAIL
                  ? 'Lokaler Betrieb: Alle Daten liegen in der Datenbank auf diesem PC.'
                  : 'Kein Passwort nötig. Du bleibst auf diesem Gerät angemeldet, deine Daten liegen auf Servern in der EU.'}
            </p>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              continueAsGuest()
              navigate('/')
            }}
            className="rounded-2xl border border-line bg-surface p-4 text-left transition hover:bg-surface-2"
          >
            <span className="block font-bold">Als Gast ansehen</span>
            <span className="mt-0.5 block text-xs text-muted">Spielplan, Ergebnisse, Tabellen & News</span>
          </button>
          <Link to="/zugang" className="rounded-2xl border border-line bg-surface p-4 transition hover:bg-surface-2">
            <span className="block font-bold">Zugang anfragen</span>
            <span className="mt-0.5 block text-xs text-muted">Für Mitglieder, Eltern & Neue</span>
          </Link>
        </div>

        {LOCAL_MAIL && (
          <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <h2 className="font-bold">Lokaler Testbetrieb auf diesem PC</h2>
            <p className="mt-1">
              Es werden keine echten E-Mails verschickt. Den Anmeldecode findest du im{' '}
              <a href={LOCAL_MAIL} target="_blank" rel="noreferrer" className="font-semibold underline">
                lokalen Postfach
              </a>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PERSONAS.map((p) => {
                const mail = `${p.who.split(' ')[0].toLowerCase()}@example.org`
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setMode('code')
                      setCodeSent(false)
                      setEmail(mail)
                    }}
                    className="rounded-full border border-amber-400 bg-white/70 px-3 py-1 font-semibold dark:bg-transparent"
                  >
                    {p.role}: {mail}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {api.mode === 'demo' && (
          <section className="mt-8">
            <h2 className="mb-1 flex items-center gap-2 px-1 font-bold">
              <Sparkles className="size-4 text-brand-600" /> Demo ausprobieren
            </h2>
            <p className="mb-3 px-1 text-sm text-muted">Wähle eine Rolle – jede sieht die App etwas anders.</p>
            <div className="grid gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => demo(p.id)}
                  disabled={!!busy}
                  className={cn('flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 active:scale-[0.99] dark:hover:bg-brand-950/20', busy === p.id && 'opacity-60')}
                >
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, hsl(${PERSONA_HUE[p.id]} 62% 52%), hsl(${(PERSONA_HUE[p.id] + 30) % 360} 62% 40%))` }}
                  >
                    {p.who.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">{p.role}</span>
                    <span className="block font-semibold">{p.who}</span>
                    <span className="block truncate text-xs text-muted">{p.detail}</span>
                  </span>
                  <ArrowRight className="size-5 text-muted" />
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          <Link to="/datenschutz" className="underline">Datenschutz</Link> · {club.fullName}
        </p>
      </div>
    </div>
  )
}
