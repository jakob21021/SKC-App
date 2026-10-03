import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Ban, Check, CircleHelp, Clock, MapPin, PartyPopper, Trophy, Dumbbell, X } from 'lucide-react'
import { api } from '@/data'
import type { RsvpInput } from '@/data/api'
import type { AbsenceReason, ClubEvent, Gender, Member, Rsvp, RsvpStatus } from '@/data/types'
import { REASON_LABEL, REASONS, type EffectiveRsvp } from '@/lib/attendance'
import { fmt, fmtTime } from '@/lib/dates'
import { GENDER_LABEL, lineupGap, resultOf } from '@/lib/korfball'
import { canManageEvent } from '@/lib/permissions'
import { cn } from '@/lib/util'
import { useClub, useApiMutation } from '@/state/queries'
import { useMe } from '@/state/session'
import { LINEUP } from '@/config/club'
import { Avatar, Button, Chip, Input, LiveDot, Sheet } from './ui'
import { errorText, useToast } from './Toast'

export const KIND_META = {
  training: { label: 'Training', icon: Dumbbell, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  game: { label: 'Spiel', icon: Trophy, cls: 'bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300' },
  club: { label: 'Verein', icon: PartyPopper, cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' },
} as const

export function KindIcon({ kind, size = 40 }: { kind: ClubEvent['kind']; size?: number }) {
  const meta = KIND_META[kind]
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-xl', meta.cls)} style={{ width: size, height: size }}>
      <meta.icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}

// ------------------------------------------------------------------ Zu-/Absage

const STATUS_BTN: Record<RsvpStatus, { label: string; short: string; icon: typeof Check; on: string }> = {
  yes: { label: 'Dabei', short: 'Dabei', icon: Check, on: 'bg-green-600 text-white border-green-600 shadow-sm shadow-green-900/20' },
  maybe: { label: 'Vielleicht', short: '?', icon: CircleHelp, on: 'bg-amber-500 text-white border-amber-500' },
  no: { label: 'Absage', short: 'Absage', icon: X, on: 'bg-red-600 text-white border-red-600' },
}

function useSetRsvp() {
  const qc = useQueryClient()
  const { me } = useMe()
  return useApiMutation(
    async (input: RsvpInput) => {
      // Optimistisch: sofort anzeigen, Server-Antwort folgt
      qc.setQueriesData<Rsvp[]>({ queryKey: ['rsvps'] }, (old) => {
        if (!old) return old
        const rest = old.filter((r) => !(r.eventId === input.eventId && r.memberId === input.memberId))
        return [...rest, { ...input, updatedAt: new Date().toISOString(), updatedBy: me?.id ?? input.memberId }]
      })
      await api.setRsvp(input)
    },
    ['rsvps'],
  )
}

export function RsvpControl({
  event,
  member,
  rsvp,
  compact,
  showName,
}: {
  event: ClubEvent
  member: Member
  rsvp: EffectiveRsvp
  compact?: boolean
  showName?: boolean
}) {
  const { me } = useMe()
  const toast = useToast()
  const setRsvp = useSetRsvp()
  const [sheet, setSheet] = useState<null | 'no' | 'maybe'>(null)
  const [reason, setReason] = useState<AbsenceReason | undefined>(rsvp.reason)
  const [comment, setComment] = useState(rsvp.source === 'explicit' ? (rsvp.comment ?? '') : '')
  const self = me?.id === member.id
  const deadlinePassed = !!event.rsvpDeadline && new Date(event.rsvpDeadline) < new Date()
  const locked = (deadlinePassed && !canManageEvent(me, event)) || new Date(event.end) < new Date()

  const send = (status: RsvpStatus, extra?: { reason?: AbsenceReason; comment?: string }) => {
    setRsvp.mutate(
      { eventId: event.id, memberId: member.id, status, reason: extra?.reason, comment: extra?.comment || undefined },
      {
        onSuccess: () => {
          const who = self ? '' : `${member.firstName}: `
          toast(status === 'yes' ? `${who}Zugesagt – bis dann! 💪` : status === 'no' ? `${who}Abgesagt` : `${who}Als „vielleicht“ gemerkt`)
        },
        onError: (e) => toast(errorText(e), 'error'),
      },
    )
    setSheet(null)
  }

  const current = rsvp.status
  const order: RsvpStatus[] = ['yes', 'maybe', 'no']

  return (
    <div>
      <div className="flex items-center gap-2">
        {showName && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Avatar member={member} size={28} />
            <span className="truncate text-sm font-semibold">{self ? 'Ich' : member.firstName}</span>
          </div>
        )}
        <div className={cn('flex gap-1.5', !showName && 'flex-1')}>
          {order.map((s) => {
            const b = STATUS_BTN[s]
            const active = current === s
            return (
              <button
                key={s}
                disabled={locked || setRsvp.isPending}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (s === 'yes') send('yes')
                  else setSheet(s)
                }}
                aria-pressed={active}
                aria-label={`${member.firstName}: ${s === 'no' ? 'Nicht dabei' : b.label}`}
                className={cn(
                  'flex items-center justify-center gap-1 whitespace-nowrap rounded-xl border font-semibold transition active:scale-95 disabled:opacity-60',
                  compact ? 'h-9 px-3 text-sm' : 'h-11 flex-1 px-3 text-[15px]',
                  s === 'maybe' && compact && 'px-2.5',
                  active ? cn(b.on, 'animate-pop') : 'border-line bg-surface text-ink hover:bg-surface-2',
                  !showName && compact && s !== 'maybe' && 'flex-1',
                )}
              >
                <b.icon className="size-4" strokeWidth={2.6} />
                {compact ? (s === 'maybe' ? null : b.short) : b.label}
              </button>
            )
          })}
        </div>
      </div>
      {(rsvp.source === 'absence' || rsvp.source === 'default' || locked || (rsvp.comment && !compact)) && (
        <p className="mt-1.5 text-xs text-muted">
          {locked
            ? 'Rückmeldefrist abgelaufen – bitte direkt bei der Trainerin oder dem Trainer melden.'
            : rsvp.source === 'absence'
              ? `Automatisch abgemeldet (${REASON_LABEL[rsvp.reason ?? 'sonstiges']}${rsvp.comment ? `: ${rsvp.comment}` : ''})`
              : rsvp.source === 'default'
                ? 'Training gilt als zugesagt – nur absagen, wenn du nicht kannst.'
                : `„${rsvp.comment}“`}
        </p>
      )}

      <Sheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet === 'no' ? (self ? 'Schade! Warum klappt es nicht?' : `Warum kann ${member.firstName} nicht?`) : 'Noch unsicher?'}
        footer={
          <Button className="w-full" variant={sheet === 'no' ? 'primary' : 'secondary'} onClick={() => send(sheet!, { reason: sheet === 'no' ? reason : undefined, comment })}>
            {sheet === 'no' ? 'Absage senden' : 'Als „vielleicht“ speichern'}
          </Button>
        }
      >
        {sheet === 'no' && (
          <>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={cn('rounded-full border px-3.5 py-2 text-sm font-semibold transition', reason === r ? 'border-brand-600 bg-brand-600 text-white' : 'border-line hover:bg-surface-2')}
                >
                  {REASON_LABEL[r]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Der Grund ist nur für Trainer:innen sichtbar.</p>
          </>
        )}
        <div className="mt-4">
          <Input placeholder={sheet === 'no' ? 'Optionaler Kommentar …' : 'z. B. „Komme ggf. später“'} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={140} />
        </div>
      </Sheet>
    </div>
  )
}

// ------------------------------------------------------------------ Damen/Herren-Balance (4+4)

export function GenderBalance({ count, compact }: { count: Record<Gender, number>; compact?: boolean }) {
  const gap = lineupGap(count)
  const complete = gap.w === 0 && gap.m === 0
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', compact ? 'text-xs' : 'text-sm')}>
      {(['w', 'm'] as Gender[]).map((g) => (
        <div key={g} className="flex items-center gap-1.5 whitespace-nowrap">
          <div className="flex gap-0.5">
            {Array.from({ length: LINEUP[g] }).map((_, i) => (
              <span
                key={i}
                className={cn('rounded-full', compact ? 'size-1.5' : 'size-2', i < count[g] ? (g === 'w' ? 'bg-female' : 'bg-male') : 'bg-zinc-300 dark:bg-zinc-600')}
              />
            ))}
          </div>
          <span className="font-semibold tabular-nums">
            {count[g]} {count[g] === 1 ? GENDER_LABEL[g].one : GENDER_LABEL[g].many}
          </span>
        </div>
      ))}
      {!compact && (
        <span className={cn('ml-auto text-xs font-semibold', complete ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400')}>
          {complete ? '4+4 komplett' : `Es fehlen ${[gap.w && `${gap.w} ${gap.w === 1 ? 'Dame' : 'Damen'}`, gap.m && `${gap.m} ${gap.m === 1 ? 'Herr' : 'Herren'}`].filter(Boolean).join(' & ')}`}
        </span>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Terminkarte

export function EventCard({
  event,
  children,
  yesCount,
  gender,
  showDate,
  footer,
}: {
  event: ClubEvent
  children?: ReactNode
  yesCount?: number
  gender?: Record<Gender, number>
  showDate?: boolean
  footer?: ReactNode
}) {
  const { venueById, teamById } = useClub()
  const venue = event.venueId ? venueById.get(event.venueId) : undefined
  const g = event.game
  const result = resultOf(g?.scoreUs, g?.scoreThem)
  const live = g?.status === 'live' || g?.status === 'halftime'
  const teams = event.teamIds.map((t) => teamById.get(t)?.short).filter(Boolean)

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]', event.cancelled && 'opacity-75')}>
      <Link to={`/termine/${event.id}`} className="flex gap-3 p-3.5 transition hover:bg-surface-2/50">
        <div className="flex w-12 shrink-0 flex-col items-center pt-0.5">
          {showDate ? (
            <>
              <span className="text-[11px] font-bold uppercase text-brand-600 dark:text-brand-400">{fmt(event.start, 'EEE')}</span>
              <span className="font-display text-2xl font-bold leading-none">{fmt(event.start, 'd')}</span>
              <span className="text-[11px] font-semibold text-muted">{fmt(event.start, 'MMM')}</span>
            </>
          ) : (
            <KindIcon kind={event.kind} size={44} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {live && (
              <Chip tone="live">
                <LiveDot /> LIVE
              </Chip>
            )}
            {event.cancelled && (
              <Chip tone="no">
                <Ban className="size-3" /> Abgesagt
              </Chip>
            )}
            {teams.length > 0 ? teams.map((t) => <Chip key={t}>{t}</Chip>) : <Chip tone="brand">Verein</Chip>}
            {g && <Chip tone="outline">{g.home ? 'Heim' : 'Auswärts'}</Chip>}
          </div>
          <h3 className={cn('mt-1 font-bold leading-snug', event.cancelled && 'line-through decoration-2')}>
            {g ? (g.home ? `vs. ${g.opponent}` : `@ ${g.opponent}`) : event.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {fmtTime(event.start)}
              {event.kind !== 'game' && `–${fmtTime(event.end)}`}
            </span>
            {venue && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{venue.name}</span>
              </span>
            )}
          </div>
          {(gender || yesCount != null) && !event.cancelled && (
            <div className="mt-2 flex items-center gap-3">
              {gender ? <GenderBalance count={gender} compact /> : <span className="text-xs font-semibold text-muted">{yesCount} Zusagen</span>}
            </div>
          )}
        </div>
        {g && (g.status !== 'scheduled' || g.scoreUs != null) && (
          <div className="flex shrink-0 flex-col items-end justify-center">
            <span
              className={cn(
                'font-display text-2xl font-bold italic tabular-nums leading-none',
                live ? 'text-brand-600 dark:text-brand-400' : result === 'win' ? 'text-green-600 dark:text-green-400' : result === 'loss' ? 'text-red-600 dark:text-red-400' : '',
              )}
            >
              {g.scoreUs ?? 0}:{g.scoreThem ?? 0}
            </span>
            {!live && result && <span className="mt-0.5 text-[11px] font-bold uppercase text-muted">{result === 'win' ? 'Sieg' : result === 'loss' ? 'Niederlage' : 'Remis'}</span>}
          </div>
        )}
      </Link>
      {children && !event.cancelled && <div className="space-y-2.5 border-t border-line px-3.5 py-3">{children}</div>}
      {footer}
    </div>
  )
}
