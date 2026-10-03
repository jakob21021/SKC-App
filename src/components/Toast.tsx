import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CircleCheck, CircleAlert } from 'lucide-react'
import { cn } from '@/lib/util'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'flex max-w-md animate-pop items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl',
              t.tone === 'ok' ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900' : 'bg-red-600 text-white',
            )}
          >
            {t.tone === 'ok' ? <CircleCheck className="size-5 shrink-0 text-green-400 dark:text-green-600" /> : <CircleAlert className="size-5 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)

export function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Da ist etwas schiefgelaufen.'
}
