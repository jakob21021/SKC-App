import { NavLink, Outlet, useLocation } from 'react-router'
import { useEffect, useMemo } from 'react'
import { CalendarDays, HandHeart, House, LayoutGrid, Trophy } from 'lucide-react'
import { club } from '@/config/club'
import { api } from '@/data'
import { useMe } from '@/state/session'
import { useAbsences, useClub, useEvents, useRsvps } from '@/state/queries'
import { effectiveRsvp, rosterFor } from '@/lib/attendance'
import { cn } from '@/lib/util'

const TABS = [
  { to: '/', label: 'Start', icon: House, end: true },
  { to: '/termine', label: 'Termine', icon: CalendarDays },
  { to: '/spiele', label: 'Spiele', icon: Trophy },
  { to: '/helfen', label: 'Helfen', icon: HandHeart },
  { to: '/mehr', label: 'Mehr', icon: LayoutGrid },
]

/** Anzahl offener Rückmeldungen (für mich und meine Kinder) in den nächsten 14 Tagen */
export function useOpenResponses() {
  const { me, family } = useMe()
  const { members, teams } = useClub()
  const events = useEvents()
  const upcoming = useMemo(() => {
    const now = Date.now()
    const horizon = now + 14 * 86_400_000
    return (events.data ?? []).filter((e) => {
      const t = new Date(e.start).getTime()
      return t > now && t < horizon && e.rsvpEnabled && !e.cancelled
    })
  }, [events.data])
  const rsvps = useRsvps(upcoming, !!me)
  const absences = useAbsences(!!me)
  return useMemo(() => {
    const open: { eventId: string; memberId: string }[] = []
    for (const e of upcoming) {
      const roster = rosterFor(e, members)
      for (const f of family) {
        if (!roster.some((r) => r.id === f.id)) continue
        const r = effectiveRsvp(e, f.id, rsvps.data ?? [], absences.data ?? [], teams)
        if (r.status === 'open') open.push({ eventId: e.id, memberId: f.id })
      }
    }
    return open
  }, [upcoming, members, family, rsvps.data, absences.data, teams])
}

export function AppShell() {
  const { pathname } = useLocation()
  const open = useOpenResponses()
  // Block statt Ausdruck: Neuere Browser geben bei scrollTo ein Promise zurück,
  // das React sonst als Aufräumfunktion aufrufen würde.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh md:flex">
      {/* Seitenleiste ab Tablet-Breite */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="mb-6 flex items-center gap-3 px-2">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="size-11" />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold uppercase">{club.name}</div>
            <div className="text-xs text-muted">Korfball seit {club.founded}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold transition',
                  isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <t.icon className="size-5" />
              {t.label}
              {t.to === '/termine' && open.length > 0 && (
                <span className="ml-auto rounded-full bg-brand-600 px-2 text-xs font-bold text-white">{open.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        {api.mode === 'demo' && (
          <div className="mt-auto rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <b>Demo-Modus</b> – alle Daten sind Beispiele und bleiben nur auf diesem Gerät.
          </div>
        )}
      </aside>

      <main className="mx-auto w-full max-w-2xl pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-10">
        <Outlet />
      </main>

      {/* Tab-Leiste auf dem Handy */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-2xl">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn('relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-semibold transition', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-muted')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition', isActive && 'bg-brand-50 dark:bg-brand-950/60')}>
                    <t.icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {t.label}
                  {t.to === '/termine' && open.length > 0 && (
                    <span className="absolute right-[calc(50%-22px)] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                      {open.length}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
