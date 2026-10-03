import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Megaphone, Pin, Plus, Share2, Trash2 } from 'lucide-react'
import { api } from '@/data'
import type { NewsPost, Poll } from '@/data/types'
import { fmtRelative } from '@/lib/dates'
import { canPostNews, isAdmin } from '@/lib/permissions'
import { cn, fullName, shareOrCopy } from '@/lib/util'
import { useApiMutation, useClub, useNews } from '@/state/queries'
import { useMe } from '@/state/session'
import { Avatar, Button, Card, Chip, EmptyState, FilterChips, IconButton, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/Toast'

const REACTIONS = ['👍', '❤️', '🔥', '👏', '😂']

const CAT_TONE: Record<NewsPost['category'], 'brand' | 'yes' | 'maybe' | 'neutral'> = {
  Spielbericht: 'brand',
  Jugend: 'yes',
  Verein: 'maybe',
  Info: 'neutral',
}

export function NewsCard({ post, compact }: { post: NewsPost; compact?: boolean }) {
  const { memberById, teamById } = useClub()
  const author = memberById.get(post.authorId)
  const reactions = Object.entries(post.reactions).filter(([, ids]) => ids.length)
  return (
    <Link to={`/news/${post.id}`} className="block">
      <Card className="p-4">
        <div className="flex items-center gap-1.5">
          {post.pinned && (
            <Chip tone="live">
              <Pin className="size-3" /> Angepinnt
            </Chip>
          )}
          <Chip tone={CAT_TONE[post.category]}>{post.category}</Chip>
          {post.teamId && <Chip>{teamById.get(post.teamId)?.short}</Chip>}
          {post.poll && <Chip tone="outline">Umfrage</Chip>}
          <span className="ml-auto text-xs text-muted">{fmtRelative(post.createdAt)}</span>
        </div>
        <h3 className="mt-2 text-[17px] font-bold leading-snug">{post.title}</h3>
        <p className={cn('mt-1 whitespace-pre-line text-[15px] text-muted', compact ? 'line-clamp-2' : 'line-clamp-3')}>{post.body}</p>
        <div className="mt-3 flex items-center gap-2">
          {author && <Avatar member={author} size={22} />}
          <span className="text-xs font-semibold text-muted">{author ? fullName(author) : 'Vorstand'}</span>
          <span className="ml-auto flex gap-1">
            {reactions.slice(0, 3).map(([e, ids]) => (
              <span key={e} className="rounded-full bg-surface-2 px-1.5 py-0.5 text-xs">
                {e} {ids.length}
              </span>
            ))}
          </span>
        </div>
      </Card>
    </Link>
  )
}

export function NewsList() {
  const { me } = useMe()
  const news = useNews()
  const [params] = useSearchParams()
  const [filter, setFilter] = useState<string>(params.get('umfragen') ? 'poll' : 'all')
  const list = (news.data ?? []).filter((n) => filter === 'all' || (filter === 'poll' ? !!n.poll : n.category === filter))
  return (
    <div>
      <PageHeader
        back
        title="Neuigkeiten"
        actions={
          canPostNews(me) && (
            <Link to="/news/neu">
              <IconButton label="Beitrag schreiben" className="bg-brand-600 text-white hover:bg-brand-700">
                <Plus className="size-5" />
              </IconButton>
            </Link>
          )
        }
      />
      <div className="px-4 pb-8 pt-3">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'Spielbericht', label: 'Spielberichte' },
            { value: 'Jugend', label: 'Jugend' },
            { value: 'Verein', label: 'Verein' },
            { value: 'poll', label: 'Umfragen' },
          ]}
        />
        <div className="mt-3 space-y-3">
          {news.isLoading && <Skeleton className="h-36" />}
          {!news.isLoading && list.length === 0 && <EmptyState icon={<Megaphone className="size-7" />} title="Keine Beiträge" />}
          {list.map((n) => (
            <NewsCard key={n.id} post={n} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function NewsDetail() {
  const { id } = useParams()
  const { me } = useMe()
  const { memberById, teamById } = useClub()
  const news = useNews()
  const toast = useToast()
  const navigate = useNavigate()
  const react = useApiMutation((emoji: string) => api.toggleReaction(id!, emoji), ['news'])
  const del = useApiMutation(() => api.deletePost(id!), ['news'])
  const post = news.data?.find((n) => n.id === id)
  if (news.isLoading) return <Skeleton className="m-4 h-60" />
  if (!post) return <EmptyState icon={<Megaphone className="size-7" />} title="Beitrag nicht gefunden" />
  const author = memberById.get(post.authorId)
  return (
    <div>
      <PageHeader
        back
        title={post.category}
        actions={
          <>
            <IconButton
              label="Teilen"
              onClick={async () => {
                const r = await shareOrCopy({ title: post.title, text: `${post.title}\n\n${post.body}` })
                if (r === 'copied') toast('Kopiert')
              }}
            >
              <Share2 className="size-5" />
            </IconButton>
            {(isAdmin(me) || me?.id === post.authorId) && (
              <IconButton label="Löschen" onClick={() => confirm('Beitrag löschen?') && del.mutate(undefined, { onSuccess: () => navigate('/news') })}>
                <Trash2 className="size-5" />
              </IconButton>
            )}
          </>
        }
      />
      <article className="px-4 pb-10 pt-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={CAT_TONE[post.category]}>{post.category}</Chip>
          {post.teamId && <Chip>{teamById.get(post.teamId)?.name}</Chip>}
        </div>
        <h1 className="mt-3 text-[26px] font-bold leading-tight">{post.title}</h1>
        <div className="mt-3 flex items-center gap-2">
          {author && <Avatar member={author} size={32} />}
          <div className="text-sm">
            <div className="font-semibold">{author ? fullName(author) : 'Vorstand'}</div>
            <div className="text-xs text-muted">{fmtRelative(post.createdAt)}</div>
          </div>
        </div>
        <div className="mt-5 whitespace-pre-line text-[16px] leading-relaxed">{post.body}</div>

        {post.poll && <PollCard poll={post.poll} />}

        {me && (
          <div className="mt-6 flex flex-wrap gap-2">
            {REACTIONS.map((e) => {
              const ids = post.reactions[e] ?? []
              const mine = ids.includes(me.id)
              return (
                <button
                  key={e}
                  onClick={() => react.mutate(e)}
                  className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95', mine ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-line bg-surface')}
                >
                  <span className="text-base">{e}</span>
                  {ids.length > 0 && <span className="tabular-nums">{ids.length}</span>}
                </button>
              )
            })}
          </div>
        )}
      </article>
    </div>
  )
}

function PollCard({ poll }: { poll: Poll }) {
  const { me } = useMe()
  const toast = useToast()
  const vote = useApiMutation((ids: string[]) => api.vote(poll.id, ids), ['news'])
  const total = new Set(poll.options.flatMap((o) => o.voterIds)).size
  const voted = !!me && poll.options.some((o) => o.voterIds.includes(me.id))
  const closed = !!poll.closesAt && new Date(poll.closesAt) < new Date()
  const max = Math.max(...poll.options.map((o) => o.voterIds.length), 1)
  return (
    <Card className="mt-6 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">Umfrage</div>
      <h2 className="mt-1 font-bold">{poll.question}</h2>
      <div className="mt-3 space-y-2">
        {poll.options.map((o) => {
          const mine = !!me && o.voterIds.includes(me.id)
          const share = total ? Math.round((o.voterIds.length / total) * 100) : 0
          return (
            <button
              key={o.id}
              disabled={!me || closed}
              onClick={() => {
                const ids = poll.multi ? (mine ? poll.options.filter((x) => x.voterIds.includes(me!.id) && x.id !== o.id).map((x) => x.id) : [...poll.options.filter((x) => x.voterIds.includes(me!.id)).map((x) => x.id), o.id]) : mine ? [] : [o.id]
                vote.mutate(ids, { onSuccess: () => toast('Stimme gespeichert') })
              }}
              className={cn('relative w-full overflow-hidden rounded-xl border p-3 text-left transition', mine ? 'border-brand-500' : 'border-line')}
            >
              {(voted || closed) && (
                <span className={cn('absolute inset-y-0 left-0 transition-all', o.voterIds.length === max ? 'bg-brand-100 dark:bg-brand-950/60' : 'bg-surface-2')} style={{ width: `${share}%` }} />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {o.label} {mine && '✓'}
                </span>
                {(voted || closed) && <span className="text-sm font-bold tabular-nums">{share} %</span>}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        {total} {total === 1 ? 'Stimme' : 'Stimmen'}
        {poll.closesAt && ` · ${closed ? 'beendet' : `läuft bis ${new Date(poll.closesAt).toLocaleDateString('de-DE')}`}`}
        {!voted && !closed && ' · Ergebnis nach deiner Stimme'}
      </p>
      {!me && (
        <Link to="/login" className="mt-2 block">
          <Button size="sm" variant="secondary">
            Zum Abstimmen anmelden
          </Button>
        </Link>
      )}
    </Card>
  )
}
