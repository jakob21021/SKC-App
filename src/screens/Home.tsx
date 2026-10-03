import { useMemo } from 'react'
import { Link } from 'react-router'
import { Bell, CalendarCheck, ChevronRight, Gift, HandHeart, Megaphone, Radio } from 'lucide-react'
import { club } from '@/config/club'
import type { ClubEvent } from '@/data/types'
import { effectiveRsvp, rosterFor, summarize } from '@/lib/attendance'
import { fmt, fmtDayLabel, greeting } from '@/lib/dates'
import { resultOf } from '@/lib/korfball'
import { cn, fullName } from '@/lib/util'
import { useAbsences, useClub, useEvents, useHelperLists, useNews, useNotifications, useRsvps, useSpecials } from '@/state/queries'
import { useMe } from '@/state/session'
import { useOpenResponses } from '@/components/AppShell'
import { EventCard, RsvpControl } from '@/components/events'
import { Avatar, Button, Card, Chip, IconButton, LiveDot, MoreLink, ProgressBar, SectionTitle, Skeleton } from '@/components/ui'
import { NewsCard } from './News'

export function Home() {
  const { me, guest, pending, email, family } = useMe()
  const { members, teams, memberById } = useClub()
  const events = useEvents()
  const notifications = useNotifications(!!me)
  const open = useOpenResponses()
  const unread = notifications.data?.filter((n) => !n.read).length ?? 0

  const now = Date.now()
  const all = events.data ?? []
  const live = all.filter((e) => e.game && (e.game.status === 'live' || e.game.status === 'halftime'))

  // Nächste Termine, die mich oder meine Kinder betreffen
  const mine = useMemo(() => {
    const upcoming = all.filter((e) => new Date(e.end).getTime() > now && !(e.game && e.game.status !== 'scheduled'))
    if (!me) return upcoming.filter((e) => e.kind !== 'training').slice(0, 4)
    const relevant = upcoming.filter((e) => {
      const roster = rosterFor(e, members)
      return family.some((f) => roster.some((r) => r.id === f.id)) || e.teamIds.some((t) => me.coachOf.includes(t)) || (e.kind === 'club' && e.teamIds.length === 0)
    })
    return relevant.slice(0, 5)
  }, [all, me, members, family, now])

  const rsvps = useRsvps(mine, !!me)
  const absences = useAbsences(!!me)

  const myTeams = new Set([...family.flatMap((f) => f.teamIds), ...(me?.coachOf ?? [])])
  const lastGame = [...all]
    .reverse()
    .find((e) => e.game?.status === 'finished' && (myTeams.size === 0 || e.teamIds.some((t) => myTeams.has(t))))

  return (
    <div>
      {/* Kopfbereich */}
      <div className="hero-stripes pt-safe relative overflow-hidden rounded-b-[28px] text-white md:mx-4 md:mt-4 md:rounded-[28px]">
        <div className="flex items-center gap-3 px-4 pt-3">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-10 drop-shadow md:hidden" />
          <div className="min-w-0 flex-1 leading-tight md:hidden">
            <div className="font-display text-xl font-bold uppercase italic">{club.name}</div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Korfball seit {club.founded}</div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {me && (
              <Link to="/benachrichtigungen">
                <IconButton label="Benachrichtigungen" badge={unread} className="text-white hover:bg-white/15">
                  <Bell className="size-[22px]" />
                </IconButton>
              </Link>
            )}
            {me ? (
              <Link to="/profil" aria-label="Mein Profil" className="ml-1 rounded-full ring-2 ring-white/40">
                <Avatar member={me} size={36} />
              </Link>
            ) : (
              <Link to="/login" className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-brand-700">
                Anmelden
              </Link>
            )}
          </div>
        </div>
        <div className="px-5 pb-6 pt-5">
          <h1 className="font-display text-[34px] font-bold uppercase italic leading-none">
            {me ? `${greeting()}, ${me.firstName}!` : 'Willkommen beim SKC!'}
          </h1>
          <p className="mt-2 text-[15px] text-white/85">
            {!me
              ? 'Spielplan, Ergebnisse und News – für alles Weitere einfach anmelden.'
              : open.length > 0
                ? `${open.length} ${open.length === 1 ? 'Termin wartet' : 'Termine warten'} auf ${family.length > 1 ? 'eure' : 'deine'} Rückmeldung.`
                : 'Alles beantwortet – stark! 💪'}
          </p>
        </div>
      </div>

      <div className="px-4">
        {/* Live-Spiele */}
        {live.map((e) => (
          <LiveBanner key={e.id} event={e} />
        ))}

        <SectionTitle action={<MoreLink to="/termine">Kalender</MoreLink>}>{me ? 'Als Nächstes' : 'Nächste Spiele & Events'}</SectionTitle>
        {events.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : mine.length === 0 ? (
          <Card className="p-5 text-center text-sm text-muted">
            <CalendarCheck className="mx-auto mb-2 size-6" /> Keine anstehenden Termine.
          </Card>
        ) : (
          <div className="space-y-3">
            {mine.map((e) => {
              const roster = rosterFor(e, members)
              const targets = family.filter((f) => roster.some((r) => r.id === f.id))
              const summary = me && e.rsvpEnabled ? summarize(e, members, rsvps.data ?? [], absences.data ?? [], teams) : null
              return (
                <EventCard
                  key={e.id}
                  event={e}
                  showDate
                  gender={summary && e.kind !== 'club' ? summary.yesByGender : undefined}
                  yesCount={summary && e.kind === 'club' ? summary.byStatus.yes.length : undefined}
                >
                  {me && e.rsvpEnabled && !e.cancelled
                    ? targets.map((f) => (
                        <RsvpControl
                          key={f.id}
                          event={e}
                          member={f}
                          compact
                          showName={targets.length > 1 || f.id !== me.id}
                          rsvp={effectiveRsvp(e, f.id, rsvps.data ?? [], absences.data ?? [], teams)}
                        />
                      ))
                    : null}
                </EventCard>
              )
            })}
          </div>
        )}

        {lastGame && <LastResult event={lastGame} />}

        {me && <HelperTeaser />}

        <NewsTeaser />

        <SpecialsTeaser />

        {pending && (
          <Card className="mt-6 border-amber-300 p-5 text-center dark:border-amber-800">
            <p className="font-bold">Fast geschafft!</p>
            <p className="mt-1 text-sm text-muted">
              Du bist als <b className="text-ink">{email}</b> angemeldet, aber noch keinem Mitglied zugeordnet. Stell eine Zugangsanfrage – der Vorstand schaltet dich frei.
            </p>
            <Link to="/zugang">
              <Button className="mt-4">Zugang anfragen</Button>
            </Link>
          </Card>
        )}
        {guest && (
          <Card className="mt-6 p-5 text-center">
            <p className="font-bold">Du bist Mitglied oder Elternteil?</p>
            <p className="mt-1 text-sm text-muted">Melde dich an, um zu- und abzusagen, Helferschichten zu übernehmen und Fahrgemeinschaften zu bilden.</p>
            <Link to="/login">
              <Button className="mt-4">Jetzt anmelden</Button>
            </Link>
          </Card>
        )}
        {me && memberById.size > 0 && (
          <p className="mt-8 text-center text-xs text-muted">
            Angemeldet als {fullName(me)} · {club.fullName}
          </p>
        )}
      </div>
    </div>
  )
}

function LiveBanner({ event }: { event: ClubEvent }) {
  const g = event.game!
  return (
    <Link
      to={`/termine/${event.id}`}
      className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-900 p-4 text-white shadow-lg shadow-black/10 transition active:scale-[0.99] dark:bg-zinc-800"
    >
      <span className="grid size-11 place-items-center rounded-xl bg-brand-600">
        <Radio className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-400">
          <LiveDot /> {g.status === 'halftime' ? 'Halbzeit' : `Live · ${g.period ?? 1}. Halbzeit`}
        </div>
        <div className="truncate font-semibold">
          {club.short} vs. {g.opponent}
        </div>
      </div>
      <span className="font-display text-3xl font-bold italic tabular-nums">
        {g.scoreUs ?? 0}:{g.scoreThem ?? 0}
      </span>
      <ChevronRight className="size-5 text-white/50" />
    </Link>
  )
}

function LastResult({ event }: { event: ClubEvent }) {
  const { teamById } = useClub()
  const g = event.game!
  const r = resultOf(g.scoreUs, g.scoreThem)
  const team = teamById.get(event.teamIds[0])
  return (
    <>
      <SectionTitle action={<MoreLink to="/spiele">Spiele</MoreLink>}>Letztes Ergebnis</SectionTitle>
      <Link to={`/termine/${event.id}`}>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between bg-surface-2/60 px-4 py-2 text-xs font-semibold text-muted">
            <span>
              {team?.name} · {g.competition}
            </span>
            <span>{fmtDayLabel(event.start)}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
            <div className="text-right">
              <div className="font-bold leading-tight">{g.home ? club.name : g.opponent}</div>
              <div className="text-xs text-muted">{g.home ? 'Heim' : ''}</div>
            </div>
            <div
              className={cn(
                'rounded-xl px-3 py-1 font-display text-4xl font-bold italic tabular-nums',
                r === 'win' ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400' : r === 'loss' ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400' : 'bg-surface-2',
              )}
            >
              {g.home ? `${g.scoreUs}:${g.scoreThem}` : `${g.scoreThem}:${g.scoreUs}`}
            </div>
            <div>
              <div className="font-bold leading-tight">{g.home ? g.opponent : club.name}</div>
              <div className="text-xs text-muted">{g.home ? '' : 'Auswärts'}</div>
            </div>
          </div>
        </Card>
      </Link>
    </>
  )
}

function HelperTeaser() {
  const lists = useHelperLists()
  const next = (lists.data ?? [])
    .filter((l) => new Date(`${l.date}T23:59`) > new Date())
    .sort((a, b) => a.date.localeCompare(b.date))
    .find((l) => l.shifts.some((s) => s.signupIds.length < s.slots))
  if (!next) return null
  const slots = next.shifts.reduce((a, s) => a + s.slots, 0)
  const filled = next.shifts.reduce((a, s) => a + Math.min(s.slots, s.signupIds.length), 0)
  return (
    <>
      <SectionTitle action={<MoreLink to="/helfen" />}>Helfer:innen gesucht</SectionTitle>
      <Link to={`/helfen/${next.id}`}>
        <Card className="flex items-center gap-4 p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <HandHeart className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{next.title}</div>
            <div className="mb-2 text-sm text-muted">
              {fmtDayLabel(next.date)} · noch {slots - filled} {slots - filled === 1 ? 'Platz' : 'Plätze'} frei
            </div>
            <ProgressBar value={filled} max={slots} />
          </div>
          <ChevronRight className="size-5 text-muted" />
        </Card>
      </Link>
    </>
  )
}

function NewsTeaser() {
  const news = useNews()
  const items = (news.data ?? []).slice(0, 2)
  if (!items.length) return null
  return (
    <>
      <SectionTitle action={<MoreLink to="/news" />}>
        <span className="flex items-center gap-1.5">
          <Megaphone className="size-3.5" /> Neues aus dem Verein
        </span>
      </SectionTitle>
      <div className="space-y-3">
        {items.map((n) => (
          <NewsCard key={n.id} post={n} compact />
        ))}
      </div>
    </>
  )
}

function SpecialsTeaser() {
  const specials = useSpecials()
  const items = specials.data ?? []
  if (!items.length) return null
  return (
    <>
      <SectionTitle action={<MoreLink to="/specials" />}>
        <span className="flex items-center gap-1.5">
          <Gift className="size-3.5" /> Specials
        </span>
      </SectionTitle>
      <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {items.map((s) => (
          <Link
            key={s.id}
            to="/specials"
            className={cn(
              'w-60 shrink-0 snap-start rounded-2xl border p-4 transition active:scale-[0.99]',
              s.highlight ? 'hero-stripes border-transparent text-white' : 'border-line bg-surface',
            )}
          >
            <Chip tone={s.highlight ? 'dark' : 'brand'}>{s.category}</Chip>
            <div className="mt-2 font-bold leading-snug">{s.title}</div>
            <div className={cn('mt-1 line-clamp-2 text-sm', s.highlight ? 'text-white/80' : 'text-muted')}>{s.description}</div>
            {s.validUntil && <div className={cn('mt-2 text-xs', s.highlight ? 'text-white/70' : 'text-muted')}>gültig bis {fmt(s.validUntil, 'dd.MM.yyyy')}</div>}
          </Link>
        ))}
      </div>
    </>
  )
}
