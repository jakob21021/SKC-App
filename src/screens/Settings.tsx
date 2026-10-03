import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { BellRing, Monitor, Moon, RotateCcw, Smartphone, Sun, Users } from 'lucide-react'
import { api } from '@/data'
import { useMe } from '@/state/session'
import { useTheme, type ThemePref } from '@/state/theme'
import { enablePush, pushState, syncPush } from '@/lib/push'
import { Button, Card, PageHeader, SectionTitle, Segmented, Toggle } from '@/components/ui'
import { useToast } from '@/components/Toast'

const PREFS_KEY = 'skc-notify-prefs'
const DEFAULT_PREFS = { reminders: true, cancellations: true, nominations: true, live: true, helpers: true, news: false }
type Prefs = typeof DEFAULT_PREFS

function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
    } catch {
      return DEFAULT_PREFS
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* egal */
    }
    // Einstellungen auch serverseitig hinterlegen, damit nur Gewünschtes gepusht wird
    syncPush(prefs).catch(() => {})
  }, [prefs])
  return [prefs, (k: keyof Prefs, v: boolean) => setPrefs((p) => ({ ...p, [k]: v }))] as const
}

type InstallEvent = Event & { prompt(): Promise<void> }

export function Settings() {
  const [theme, setTheme] = useTheme()
  const [prefs, setPref] = usePrefs()
  const { signOut } = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [permission, setPermission] = useState(pushState)
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  return (
    <div>
      <PageHeader back title="Einstellungen" />
      <div className="px-4 pb-10">
        <SectionTitle>Darstellung</SectionTitle>
        <Segmented<ThemePref>
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="size-4" />Auto</span> },
            { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-4" />Hell</span> },
            { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-4" />Dunkel</span> },
          ]}
        />

        {!standalone && (
          <>
            <SectionTitle>App installieren</SectionTitle>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 size-5 shrink-0 text-brand-600" />
                <div className="text-sm">
                  {installEvent ? (
                    <>
                      <p>Installiere die SKC-App auf deinem Startbildschirm – startet schneller und funktioniert auch offline.</p>
                      <Button className="mt-3" size="sm" onClick={() => installEvent.prompt()}>
                        Jetzt installieren
                      </Button>
                    </>
                  ) : ios ? (
                    <p>
                      Tippe in Safari auf <b>Teilen</b> (Quadrat mit Pfeil) und dann auf <b>„Zum Home-Bildschirm“</b>. Danach startet der SKC wie eine richtige App – inklusive Push-Benachrichtigungen.
                    </p>
                  ) : (
                    <p>Öffne das Browser-Menü und wähle „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.</p>
                  )}
                </div>
              </div>
            </Card>
          </>
        )}

        <SectionTitle>Benachrichtigungen</SectionTitle>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 size-5 shrink-0 text-brand-600" />
            <div className="flex-1 text-sm">
              {permission === 'granted' ? (
                <p>Push-Benachrichtigungen sind auf diesem Gerät aktiv. ✓</p>
              ) : permission === 'denied' ? (
                <p>Benachrichtigungen sind blockiert. Du kannst sie in den Einstellungen deines Geräts bzw. Browsers für diese App wieder erlauben.</p>
              ) : permission === 'unsupported' ? (
                <p>{ios ? 'Auf dem iPhone funktionieren Push-Benachrichtigungen, sobald die App zum Home-Bildschirm hinzugefügt wurde.' : 'Dieser Browser unterstützt keine Push-Benachrichtigungen.'}</p>
              ) : (
                <>
                  <p>Erhalte Erinnerungen, Absagen und Live-Ergebnisse direkt aufs Handy.</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={async () => {
                      try {
                        const p = await enablePush(prefs)
                        setPermission(p)
                        if (p === 'granted') toast('Benachrichtigungen aktiviert')
                      } catch {
                        toast('Benachrichtigungen konnten nicht aktiviert werden.', 'error')
                      }
                    }}
                  >
                    Aktivieren
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
        <Card className="mt-3 divide-y divide-line px-4">
          <Toggle checked={prefs.reminders} onChange={(v) => setPref('reminders', v)} label="Erinnerungen" description="Wenn eine Rückmeldung fehlt (24 h vor der Frist)" />
          <Toggle checked={prefs.cancellations} onChange={(v) => setPref('cancellations', v)} label="Absagen & Änderungen" description="Training fällt aus, Uhrzeit oder Halle geändert" />
          <Toggle checked={prefs.nominations} onChange={(v) => setPref('nominations', v)} label="Nominierungen" description="Wenn du für ein Spiel nominiert wirst" />
          <Toggle checked={prefs.live} onChange={(v) => setPref('live', v)} label="Live-Spiele" description="Anpfiff und Endstand deiner Teams" />
          <Toggle checked={prefs.helpers} onChange={(v) => setPref('helpers', v)} label="Helferlisten" description="Neue Listen und Erinnerung vor deiner Schicht" />
          <Toggle checked={prefs.news} onChange={(v) => setPref('news', v)} label="Alle News" description="Jeden neuen Beitrag (angepinnte kommen immer)" />
        </Card>

        {api.mode === 'demo' && (
          <>
            <SectionTitle>Demo</SectionTitle>
            <Card className="space-y-2 p-4">
              <Button
                variant="secondary"
                className="w-full"
                icon={<Users className="size-4" />}
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
              >
                Andere Rolle ausprobieren
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                icon={<RotateCcw className="size-4" />}
                onClick={() => {
                  api.reset?.()
                  toast('Demo-Daten zurückgesetzt')
                }}
              >
                Demo-Daten zurücksetzen
              </Button>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
