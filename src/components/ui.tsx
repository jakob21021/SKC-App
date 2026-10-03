import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, LoaderCircle, X } from 'lucide-react'
import type { Member } from '@/data/types'
import { cn, initials } from '@/lib/util'

// ------------------------------------------------------------------ Buttons

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'white'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-sm shadow-brand-900/20',
  secondary: 'bg-surface-2 text-ink hover:brightness-95 dark:hover:brightness-125',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/50 dark:text-red-300',
  outline: 'border border-line text-ink hover:bg-surface-2',
  white: 'bg-white text-brand-700 hover:bg-brand-50 shadow-sm',
}
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-13 px-5 text-base gap-2 rounded-2xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-semibold transition select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  badge,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; badge?: number }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn('relative grid size-10 place-items-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10 active:scale-95', className)}
      {...rest}
    >
      {children}
      {!!badge && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 h-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white ring-2 ring-[var(--surface)]">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

// ------------------------------------------------------------------ Layout-Bausteine

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn('rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]', onClick && 'cursor-pointer transition active:scale-[0.99]', className)}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2 mt-6 flex items-end justify-between px-1', className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function MoreLink({ to, children = 'Alle' }: { to: string; children?: ReactNode }) {
  return (
    <Link to={to} className="flex items-center text-sm font-semibold text-brand-600 dark:text-brand-400">
      {children}
      <ChevronRight className="size-4" />
    </Link>
  )
}

export function Chip({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'yes' | 'no' | 'maybe' | 'live' | 'dark' | 'outline'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300',
    yes: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300',
    no: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    maybe: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    live: 'bg-brand-600 text-white',
    dark: 'bg-black/25 text-white',
    outline: 'border border-line text-muted',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn('inline-block size-2 rounded-full bg-current animate-pulse-dot', className)} />
}

export function Avatar({ member, size = 36, ring }: { member: Pick<Member, 'firstName' | 'lastName' | 'avatarHue'>; size?: number; ring?: boolean }) {
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center rounded-full font-bold text-white select-none', ring && 'ring-2 ring-[var(--surface)]')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${member.avatarHue} 62% 52%), hsl(${(member.avatarHue + 30) % 360} 62% 40%))`,
      }}
      aria-hidden
    >
      {initials(member)}
    </span>
  )
}

export function AvatarStack({ members, max = 5, size = 28 }: { members: Member[]; max?: number; size?: number }) {
  const shown = members.slice(0, max)
  const rest = members.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span key={m.id} style={{ marginLeft: i ? -size * 0.3 : 0 }}>
          <Avatar member={m} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="grid place-items-center rounded-full bg-surface-2 text-[11px] font-bold text-muted ring-2 ring-[var(--surface)]"
          style={{ width: size, height: size, marginLeft: -size * 0.3 }}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  className?: string
}) {
  return (
    <div className={cn('flex gap-1 rounded-xl bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition whitespace-nowrap',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
          {o.count != null && <span className="text-xs font-bold opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',
            value === o.value
              ? 'border-transparent bg-ink text-[var(--surface)]'
              : 'border-line bg-surface text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'yes' }) {
  const p = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/10">
      <div
        className={cn('h-full rounded-full transition-all duration-500', tone === 'yes' ? 'bg-green-500' : 'bg-brand-600')}
        style={{ width: `${p}%` }}
      />
    </div>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center py-16 text-muted', className)}>
      <LoaderCircle className="size-6 animate-spin" />
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />
}

// ------------------------------------------------------------------ Seitenkopf

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  large,
}: {
  title: ReactNode
  subtitle?: ReactNode
  back?: string | true
  actions?: ReactNode
  large?: boolean
}) {
  const navigate = useNavigate()
  const goBack = () => {
    if (typeof back === 'string') navigate(back)
    else if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }
  if (large) {
    return (
      <header className="pt-safe sticky top-0 z-30 bg-app/85 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-3 px-4 pb-2 pt-4">
          <div className="min-w-0">
            <h1 className="font-display text-[34px] font-bold uppercase leading-none tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </div>
      </header>
    )
  }
  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1 px-2">
        {back ? (
          <IconButton label="Zurück" onClick={goBack}>
            <ChevronLeft className="size-6" />
          </IconButton>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center">{actions}</div>
      </div>
    </header>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-4 pb-8', className)}>{children}</div>
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  to,
  onClick,
  chevron = true,
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  to?: string
  onClick?: () => void
  chevron?: boolean
}) {
  const inner = (
    <>
      {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {right}
      {(to || onClick) && chevron && <ChevronRight className="size-4 shrink-0 text-muted" />}
    </>
  )
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2/60'
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  if (onClick)
    return (
      <button onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  return <div className={cls}>{inner}</div>
}

// ------------------------------------------------------------------ Bottom-Sheet

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg animate-slide-up flex-col rounded-t-3xl bg-surface shadow-2xl md:animate-pop md:rounded-3xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-surface-2 md:hidden" />
        <div className="flex items-center justify-between gap-2 px-5 pb-2 pt-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <IconButton label="Schließen" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

// ------------------------------------------------------------------ Formulare

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[16px] text-ink outline-none transition placeholder:text-muted/70 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15'

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn(inputCls, className)} {...p} />
)
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn(inputCls, 'min-h-24 resize-y', className)} {...p} />
)
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn(inputCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p} />
)

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-zinc-300 dark:bg-zinc-600')}>
        <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}
