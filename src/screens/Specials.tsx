import { useState } from 'react'
import { Copy, ExternalLink, Gift, Ticket } from 'lucide-react'
import type { Special } from '@/data/types'
import { fmt } from '@/lib/dates'
import { cn } from '@/lib/util'
import { useSpecials } from '@/state/queries'
import { useMe } from '@/state/session'
import { Button, Chip, EmptyState, FilterChips, PageHeader, Skeleton } from '@/components/ui'
import { useToast } from '@/components/Toast'

export function Specials() {
  const specials = useSpecials()
  const [cat, setCat] = useState<'all' | Special['category']>('all')
  const list = (specials.data ?? []).filter((s) => cat === 'all' || s.category === cat)
  return (
    <div>
      <PageHeader back title="Specials" subtitle="Angebote für Mitglieder & Fans" />
      <div className="px-4 pb-8 pt-3">
        <FilterChips
          value={cat}
          onChange={setCat}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'Fanshop', label: 'Fanshop' },
            { value: 'Sponsor', label: 'Partner' },
            { value: 'Verein', label: 'Vereinsaktionen' },
          ]}
        />
        <div className="mt-3 space-y-3">
          {specials.isLoading && <Skeleton className="h-40" />}
          {!specials.isLoading && list.length === 0 && <EmptyState icon={<Gift className="size-7" />} title="Keine Specials" />}
          {list.map((s) => (
            <SpecialCard key={s.id} special={s} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SpecialCard({ special: s }: { special: Special }) {
  const { me } = useMe()
  const toast = useToast()
  const [revealed, setRevealed] = useState(false)
  return (
    <div className={cn('overflow-hidden rounded-2xl border', s.highlight ? 'hero-stripes border-transparent text-white' : 'border-line bg-surface')}>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <Chip tone={s.highlight ? 'dark' : 'brand'}>{s.category === 'Sponsor' ? 'Partner-Angebot' : s.category}</Chip>
          <span className={cn('text-xs font-semibold', s.highlight ? 'text-white/70' : 'text-muted')}>{s.partner}</span>
        </div>
        <h2 className="mt-3 text-xl font-bold leading-tight">{s.title}</h2>
        <p className={cn('mt-1.5 text-[15px]', s.highlight ? 'text-white/85' : 'text-muted')}>{s.description}</p>
        {s.validUntil && <p className={cn('mt-2 text-xs font-semibold', s.highlight ? 'text-white/70' : 'text-muted')}>Gültig bis {fmt(s.validUntil, 'dd.MM.yyyy')}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {s.code &&
            (me ? (
              revealed ? (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(s.code!)
                    toast('Code kopiert')
                  }}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 px-4 py-2 font-mono text-lg font-bold tracking-widest text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                >
                  {s.code} <Copy className="size-4" />
                </button>
              ) : (
                <Button icon={<Ticket className="size-4" />} onClick={() => setRevealed(true)}>
                  Code anzeigen
                </Button>
              )
            ) : (
              <span className="text-sm text-muted">Code nur für angemeldete Mitglieder</span>
            ))}
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer">
              <Button variant={s.highlight ? 'white' : 'outline'} icon={<ExternalLink className="size-4" />}>
                Zum Shop
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
