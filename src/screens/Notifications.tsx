import { useNavigate } from 'react-router'
import { Bell, BellRing, CalendarDays, CheckCheck, HandHeart, Megaphone, ShieldCheck, Trophy } from 'lucide-react'
import { api } from '@/data'
import type { NotificationKind } from '@/data/types'
import { fmtRelative } from '@/lib/dates'
import { cn } from '@/lib/util'
import { useApiMutation, useNotifications } from '@/state/queries'
import { useMe } from '@/state/session'
import { Card, EmptyState, IconButton, PageHeader, Skeleton } from '@/components/ui'
import { LoginRequired } from './More'

const ICON: Record<NotificationKind, typeof Bell> = {
  event: CalendarDays,
  game: Trophy,
  helper: HandHeart,
  news: Megaphone,
  reminder: BellRing,
  system: ShieldCheck,
}

export function Notifications() {
  const { me } = useMe()
  const list = useNotifications(!!me)
  const navigate = useNavigate()
  const mark = useApiMutation((ids: string[]) => api.markNotificationsRead(ids), ['notifications'])
  if (!me) return <LoginRequired title="Benachrichtigungen" />
  const items = list.data ?? []
  const unread = items.filter((n) => !n.read)

  return (
    <div>
      <PageHeader
        back
        title="Benachrichtigungen"
        actions={
          unread.length > 0 && (
            <IconButton label="Alle als gelesen markieren" onClick={() => mark.mutate(unread.map((n) => n.id))}>
              <CheckCheck className="size-5" />
            </IconButton>
          )
        }
      />
      <div className="px-4 pb-8 pt-4">
        {list.isLoading ? (
          <Skeleton className="h-40" />
        ) : items.length === 0 ? (
          <EmptyState icon={<Bell className="size-7" />} title="Alles ruhig">
            Hier erscheinen Erinnerungen, Absagen und Neuigkeiten.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {items.map((n) => {
              const Icon = ICON[n.kind]
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) mark.mutate([n.id])
                    if (n.link) navigate(n.link)
                  }}
                  className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-surface-2/60', !n.read && 'bg-brand-50/50 dark:bg-brand-950/20')}
                >
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', n.read ? 'bg-surface-2 text-muted' : 'bg-brand-600 text-white')}>
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn('truncate', n.read ? 'font-semibold' : 'font-bold')}>{n.title}</span>
                      {!n.read && <span className="size-2 shrink-0 rounded-full bg-brand-600" />}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                    <span className="mt-1 block text-xs text-muted">{fmtRelative(n.createdAt)}</span>
                  </span>
                </button>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
