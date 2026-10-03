import { Globe, Mail, MapPin, Navigation, ShoppingBag } from 'lucide-react'
import { club } from '@/config/club'
import { api } from '@/data'
import { fullName, mapsUrl } from '@/lib/util'
import { useClub } from '@/state/queries'
import { Avatar, Card, PageHeader, SectionTitle } from '@/components/ui'

export function Venues() {
  const { venues } = useClub()
  return (
    <div>
      <PageHeader back title="Hallen & Orte" />
      <div className="space-y-3 px-4 pb-8 pt-4">
        {venues.map((v) => (
          <Card key={v.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{v.name}</div>
                <div className="text-sm text-muted">{[v.street, v.city].filter(Boolean).join(', ')}</div>
                {v.notes && <p className="mt-1.5 text-sm">{v.notes}</p>}
              </div>
              <a href={mapsUrl(v)} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white">
                <Navigation className="size-3.5" /> Route
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function Contact() {
  const { members } = useClub()
  const board = members.filter((m) => m.roles.includes('board') || m.roles.includes('admin'))
  return (
    <div>
      <PageHeader back title="Kontakt & Vorstand" />
      <div className="px-4 pb-8">
        <Card className="mt-4 p-5 text-center">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="mx-auto size-20" />
          <h1 className="mt-3 text-xl font-bold">{club.fullName}</h1>
          <p className="mt-1 text-sm text-muted">{club.address}</p>
          <p className="mt-2 text-sm italic text-muted">{club.claim}</p>
        </Card>
        <Card className="mt-3 divide-y divide-line">
          <a href={`mailto:${club.email}`} className="flex items-center gap-3 px-4 py-3">
            <Mail className="size-5 text-muted" />
            <span className="font-semibold">{club.email}</span>
          </a>
          <a href={club.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3">
            <Globe className="size-5 text-muted" />
            <span className="font-semibold">{club.website.replace('https://', '')}</span>
          </a>
          <a href={club.shopUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3">
            <ShoppingBag className="size-5 text-muted" />
            <span className="font-semibold">Fanshop</span>
          </a>
        </Card>
        {board.length > 0 && (
          <>
            <SectionTitle>Vorstand & Ansprechpartner:innen</SectionTitle>
            <Card className="divide-y divide-line">
              {board.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar member={m} size={40} />
                  <div>
                    <div className="font-semibold">{fullName(m)}</div>
                    <div className="text-sm text-muted">{m.title ?? 'Vorstand'}</div>
                  </div>
                </div>
              ))}
            </Card>
            {api.mode === 'demo' && <p className="mt-2 px-1 text-xs text-muted">Demo: Namen sind frei erfunden.</p>}
          </>
        )}
      </div>
    </div>
  )
}

export function Privacy() {
  return (
    <div className="min-h-dvh bg-app">
      <PageHeader back title="Datenschutz & Impressum" />
      <article className="mx-auto max-w-2xl space-y-4 px-4 py-5 text-[15px] leading-relaxed">
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Platzhalter – vor dem Livegang durch den Vorstand prüfen und vervollständigen lassen.
        </p>
        <h2 className="text-lg font-bold">Verantwortlich</h2>
        <p>
          {club.fullName}
          <br />
          {club.address}
          <br />
          E-Mail: {club.email}
        </p>
        <h2 className="text-lg font-bold">Welche Daten speichert die App?</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Name, E-Mail und Teamzugehörigkeit zur Organisation des Spielbetriebs</li>
          <li>Zu- und Absagen sowie freiwillig angegebene Gründe (nur für Trainer:innen sichtbar)</li>
          <li>Eintragungen in Helferlisten und Fahrgemeinschaften</li>
          <li>Spielstatistiken (Körbe, Würfe) aus dem Live-Ticker</li>
        </ul>
        <h2 className="text-lg font-bold">Wo liegen die Daten?</h2>
        <p>Die Daten werden in einer Datenbank in einem Rechenzentrum in der EU (Frankfurt) gespeichert. Zugriff haben nur angemeldete Mitglieder – jeweils nur auf das, was sie für ihre Rolle brauchen.</p>
        <h2 className="text-lg font-bold">Deine Rechte</h2>
        <p>Du kannst jederzeit Auskunft, Berichtigung oder Löschung deiner Daten verlangen. Schreib dazu einfach an {club.email}.</p>
        <h2 className="text-lg font-bold">Keine Werbung, kein Tracking</h2>
        <p>Die App verwendet keine Tracking- oder Werbedienste.</p>
      </article>
    </div>
  )
}
