import { Link } from 'react-router'
import { Bell, Building2, ChartColumn, Gift, Lock, Mail, MapPin, Megaphone, Settings, ShieldCheck, ShoppingBag, UserCog, Users, Vote } from 'lucide-react'
import { club } from '@/config/club'
import { api } from '@/data'
import { isAdmin } from '@/lib/permissions'
import { fullName } from '@/lib/util'
import { useAccessRequests, useNews, useNotifications } from '@/state/queries'
import { useMe } from '@/state/session'
import { Avatar, Button, Card, Chip, ListRow, PageHeader, SectionTitle } from '@/components/ui'
import { roleLabel } from '@/lib/permissions'

export function More() {
  const { me } = useMe()
  const news = useNews()
  const notifications = useNotifications(!!me)
  const requests = useAccessRequests(isAdmin(me))
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0
  const polls = news.data?.filter((n) => n.poll).length ?? 0
  const openRequests = requests.data?.filter((r) => r.status === 'open').length ?? 0

  return (
    <div>
      <PageHeader large title="Mehr" />
      <div className="px-4 pb-8">
        {me ? (
          <Link to="/profil">
            <Card className="mt-2 flex items-center gap-4 p-4">
              <Avatar member={me} size={56} />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold">{fullName(me)}</div>
                <div className="text-sm text-muted">{roleLabel(me)}</div>
              </div>
              <Chip tone="brand">Profil</Chip>
            </Card>
          </Link>
        ) : (
          <Card className="mt-2 p-5 text-center">
            <p className="font-bold">Du bist als Gast unterwegs</p>
            <Link to="/login">
              <Button className="mt-3">Anmelden</Button>
            </Link>
          </Card>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Tile to="/news" icon={<Megaphone className="size-6" />} label="News" />
          <Tile to="/news?umfragen=1" icon={<Vote className="size-6" />} label="Umfragen" badge={me ? polls : 0} />
          <Tile to="/specials" icon={<Gift className="size-6" />} label="Specials" />
          <Tile to="/teams" icon={<Users className="size-6" />} label="Teams" />
          <Tile to="/spiele" icon={<ChartColumn className="size-6" />} label="Statistik" />
          <Tile to="/hallen" icon={<MapPin className="size-6" />} label="Hallen" />
        </div>

        {me && (
          <>
            <SectionTitle>Persönlich</SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              <ListRow to="/benachrichtigungen" icon={<Bell className="size-5" />} title="Benachrichtigungen" right={unread > 0 && <Chip tone="live">{unread}</Chip>} />
              <ListRow to="/profil" icon={<UserCog className="size-5" />} title="Profil & Abwesenheiten" />
              <ListRow to="/einstellungen" icon={<Settings className="size-5" />} title="Einstellungen" />
            </Card>
          </>
        )}

        {isAdmin(me) && (
          <>
            <SectionTitle>Verwaltung</SectionTitle>
            <Card className="divide-y divide-line overflow-hidden">
              <ListRow to="/verwaltung" icon={<ShieldCheck className="size-5" />} title="Zugänge & Mitglieder" subtitle="Anfragen freischalten, Rollen verwalten" right={openRequests > 0 && <Chip tone="live">{openRequests}</Chip>} />
            </Card>
          </>
        )}

        <SectionTitle>Verein</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <ListRow to="/kontakt" icon={<Building2 className="size-5" />} title="Kontakt & Vorstand" />
          <a href={club.shopUrl} target="_blank" rel="noreferrer" className="block">
            <ListRow icon={<ShoppingBag className="size-5" />} title="Fanshop" subtitle="Trikots & Teamwear" />
          </a>
          <a href={`mailto:${club.email}`} className="block">
            <ListRow icon={<Mail className="size-5" />} title="E-Mail an den Vorstand" subtitle={club.email} />
          </a>
          <ListRow to="/datenschutz" icon={<Lock className="size-5" />} title="Datenschutz & Impressum" />
        </Card>

        <p className="mt-8 text-center text-xs text-muted">
          {club.fullName}
          <br />
          SKC-App v0.1 · {api.mode === 'demo' ? 'Demo-Modus' : 'Live'}
        </p>
      </div>
    </div>
  )
}

function Tile({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Link to={to} className="relative flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-4 text-sm font-semibold transition active:scale-[0.97] hover:bg-surface-2">
      <span className="text-brand-600 dark:text-brand-400">{icon}</span>
      {label}
      {!!badge && <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{badge}</span>}
    </Link>
  )
}

export function LoginRequired({ title }: { title: string }) {
  return (
    <div>
      <PageHeader large title={title} />
      <div className="px-4">
        <Card className="mt-4 p-6 text-center">
          <Lock className="mx-auto size-8 text-muted" />
          <p className="mt-3 font-bold">Nur für Mitglieder</p>
          <p className="mt-1 text-sm text-muted">Melde dich an, um diesen Bereich zu sehen.</p>
          <Link to="/login">
            <Button className="mt-4">Anmelden</Button>
          </Link>
        </Card>
      </div>
    </div>
  )
}
