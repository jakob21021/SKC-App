import { Link, useParams } from 'react-router'
import { Banknote, Brush, Cake, Camera, Clock, Flame, HandHeart, Heart, MapPin, Plus, Wrench } from 'lucide-react'
import { api } from '@/data'
import type { HelperList, HelperShift, Member, ShiftIcon } from '@/data/types'
import { fmt, fmtDayLabel, fmtDayLong, fmtTime } from '@/lib/dates'
import { canManageHelpers } from '@/lib/permissions'
import { cn, shortName } from '@/lib/util'
import { useApiMutation, useClub, useHelperLists } from '@/state/queries'
import { useMe } from '@/state/session'
import { Avatar, Button, Card, EmptyState, IconButton, PageHeader, ProgressBar, SectionTitle, Skeleton } from '@/components/ui'
import { errorText, useToast } from '@/components/Toast'
import { LoginRequired } from './More'

export const SHIFT_ICON: Record<ShiftIcon, typeof Cake> = {
  cake: Cake,
  cash: Banknote,
  clock: Clock,
  wrench: Wrench,
  grill: Flame,
  broom: Brush,
  camera: Camera,
  heart: Heart,
}

const filled = (l: HelperList) => l.shifts.reduce((a, s) => a + Math.min(s.slots, s.signupIds.length), 0)
const total = (l: HelperList) => l.shifts.reduce((a, s) => a + s.slots, 0)

export function Helpers() {
  const { me, family } = useMe()
  const lists = useHelperLists()
  if (!me) return <LoginRequired title="Helfen" />
  const ids = new Set([me.id, ...family.map((f) => f.id)])
  const upcoming = (lists.data ?? []).filter((l) => new Date(`${l.date}T23:59`) > new Date()).sort((a, b) => a.date.localeCompare(b.date))
  const myShifts = upcoming.flatMap((l) => l.shifts.filter((s) => s.signupIds.some((x) => ids.has(x))).map((s) => ({ l, s })))
  const totalOpen = upcoming.reduce((a, l) => a + total(l) - filled(l), 0)

  return (
    <div>
      <PageHeader
        large
        title="Helfen"
        subtitle={totalOpen > 0 ? `${totalOpen} Plätze noch frei – jede Hand zählt!` : 'Alle Schichten besetzt – danke!'}
        actions={
          canManageHelpers(me) && (
            <Link to="/helfen/neu">
              <IconButton label="Neue Helferliste" className="bg-brand-600 text-white hover:bg-brand-700">
                <Plus className="size-5" />
              </IconButton>
            </Link>
          )
        }
      />
      <div className="px-4 pb-8">
        {myShifts.length > 0 && (
          <>
            <SectionTitle>Meine Einsätze</SectionTitle>
            <Card className="divide-y divide-line">
              {myShifts.map(({ l, s }) => {
                const Icon = SHIFT_ICON[s.icon]
                return (
                  <Link key={s.id} to={`/helfen/${l.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.title}</div>
                      <div className="truncate text-sm text-muted">
                        {fmtDayLabel(s.start)}, {shiftTime(s)} · {l.title}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </Card>
          </>
        )}

        <SectionTitle>Anstehende Helferlisten</SectionTitle>
        {lists.isLoading ? (
          <Skeleton className="h-32" />
        ) : upcoming.length === 0 ? (
          <EmptyState icon={<HandHeart className="size-7" />} title="Gerade keine Helferlisten" />
        ) : (
          <div className="space-y-3">
            {upcoming.map((l) => {
              const f = filled(l)
              const t = total(l)
              return (
                <Link key={l.id} to={`/helfen/${l.id}`} className="block">
                  <Card className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-surface-2 py-1.5">
                        <span className="text-[11px] font-bold uppercase text-brand-600 dark:text-brand-400">{fmt(l.date, 'EEE')}</span>
                        <span className="font-display text-2xl font-bold leading-none">{fmt(l.date, 'd')}</span>
                        <span className="text-[11px] font-semibold text-muted">{fmt(l.date, 'MMM')}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold leading-snug">{l.title}</h3>
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{l.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1">
                        <ProgressBar value={f} max={t} tone={f >= t ? 'yes' : 'brand'} />
                      </div>
                      <span className="text-sm font-bold tabular-nums">
                        {f}/{t}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {l.shifts.map((s) => {
                        const Icon = SHIFT_ICON[s.icon]
                        const full = s.signupIds.length >= s.slots
                        return (
                          <span key={s.id} className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', full ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-surface-2 text-muted')}>
                            <Icon className="size-3" /> {s.title}
                          </span>
                        )
                      })}
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const shiftTime = (s: HelperShift) => (s.start === s.end ? `ab ${fmtTime(s.start)} Uhr` : `${fmtTime(s.start)}–${fmtTime(s.end)} Uhr`)

export function HelperListDetail() {
  const { id } = useParams()
  const { me, family } = useMe()
  const { memberById, venueById } = useClub()
  const lists = useHelperLists()
  const toast = useToast()
  const signup = useApiMutation((v: { shift: string; member: string }) => api.signupShift(v.shift, v.member), ['helpers'])
  const leave = useApiMutation((v: { shift: string; member: string }) => api.leaveShift(v.shift, v.member), ['helpers'])

  if (!me) return <LoginRequired title="Helfen" />
  const list = lists.data?.find((l) => l.id === id)
  if (lists.isLoading) return <Skeleton className="m-4 h-60" />
  if (!list) return <EmptyState icon={<HandHeart className="size-7" />} title="Helferliste nicht gefunden" />
  const venue = list.venueId ? venueById.get(list.venueId) : undefined
  // Erwachsene im Haushalt dürfen sich eintragen (ich + ggf. Kinder ab 14)
  const helpers: Member[] = [me, ...family.filter((f) => f.id !== me.id && f.birthYear && new Date().getFullYear() - f.birthYear >= 14)]

  return (
    <div>
      <PageHeader back title="Helferliste" subtitle={fmtDayLong(list.date)} />
      <div className="px-4 pb-8">
        <h1 className="mt-5 text-2xl font-bold leading-tight">{list.title}</h1>
        {venue && (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4" /> {venue.name}
          </p>
        )}
        {list.description && <p className="mt-3 text-[15px] leading-relaxed">{list.description}</p>}
        {list.eventId && (
          <Link to={`/termine/${list.eventId}`} className="mt-2 inline-block text-sm font-semibold text-brand-600">
            Zum Termin →
          </Link>
        )}
        <div className="mt-4">
          <ProgressBar value={filled(list)} max={total(list)} tone={filled(list) >= total(list) ? 'yes' : 'brand'} />
          <p className="mt-1.5 text-xs font-semibold text-muted">
            {filled(list)} von {total(list)} Plätzen besetzt
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {list.shifts.map((s) => {
            const Icon = SHIFT_ICON[s.icon]
            const full = s.signupIds.length >= s.slots
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3">
                  <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl', full ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300')}>
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{s.title}</div>
                    <div className="text-sm text-muted">{shiftTime(s)}</div>
                  </div>
                  <span className={cn('text-sm font-bold tabular-nums', full && 'text-green-600 dark:text-green-400')}>
                    {s.signupIds.length}/{s.slots}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.signupIds.map((mid) => {
                    const m = memberById.get(mid)
                    return m ? (
                      <span key={mid} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold">
                        <Avatar member={m} size={20} /> {mid === me.id ? 'Ich' : shortName(m)}
                      </span>
                    ) : null
                  })}
                  {Array.from({ length: Math.max(0, s.slots - s.signupIds.length) }).map((_, i) => (
                    <span key={i} className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted">
                      frei
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {helpers.map((h) => {
                    const signed = s.signupIds.includes(h.id)
                    const label = h.id === me.id ? '' : ` (${h.firstName})`
                    return signed ? (
                      <Button key={h.id} size="sm" variant="secondary" onClick={() => leave.mutate({ shift: s.id, member: h.id }, { onSuccess: () => toast('Ausgetragen') })}>
                        Austragen{label}
                      </Button>
                    ) : (
                      <Button
                        key={h.id}
                        size="sm"
                        disabled={full}
                        onClick={() =>
                          signup.mutate(
                            { shift: s.id, member: h.id },
                            { onSuccess: () => toast('Danke fürs Helfen! 💚'), onError: (e) => toast(errorText(e), 'error') },
                          )
                        }
                      >
                        {full ? 'Voll' : `Ich helfe${label}`}
                      </Button>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
