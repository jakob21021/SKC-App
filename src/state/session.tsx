import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/data'
import type { Member } from '@/data/types'
import { useClub, useSession } from './queries'

const GUEST_KEY = 'skc-guest'

interface SessionCtx {
  loading: boolean
  me: Member | null
  guest: boolean
  /** Angemeldet, aber (noch) keinem Mitglied zugeordnet */
  pending: boolean
  email?: string
  /** Für wen darf ich antworten? Ich selbst (wenn ich spiele) + meine Kinder */
  family: Member[]
  signInDemo(memberId: string): Promise<void>
  /** Nach erfolgreicher Anmeldung alle Daten neu laden */
  afterSignIn(): Promise<void>
  signOut(): Promise<void>
  continueAsGuest(): void
}

const Ctx = createContext<SessionCtx | null>(null)

const readGuest = () => {
  try {
    return localStorage.getItem(GUEST_KEY) === '1'
  } catch {
    return false
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const session = useSession()
  const club = useClub()
  const [guest, setGuest] = useState(readGuest)

  const memberId = session.data?.memberId ?? null
  const me = memberId ? (club.memberById.get(memberId) ?? null) : null

  const family = useMemo(() => {
    if (!me) return []
    const kids = me.parentOf.map((id) => club.memberById.get(id)).filter((m): m is Member => !!m)
    return [...(me.teamIds.length ? [me] : []), ...kids]
  }, [me, club.memberById])

  const afterSignIn = useCallback(async () => {
    try {
      localStorage.removeItem(GUEST_KEY)
    } catch {
      /* egal */
    }
    setGuest(false)
    await qc.resetQueries()
  }, [qc])

  const signInDemo = useCallback(
    async (id: string) => {
      await api.signInDemo(id)
      await afterSignIn()
    },
    [afterSignIn],
  )

  const signOut = useCallback(async () => {
    await api.signOut()
    setGuest(false)
    // Alle Daten zurücksetzen und neu laden (jetzt ohne Anmeldung)
    await qc.resetQueries()
  }, [qc])

  const continueAsGuest = useCallback(() => {
    try {
      localStorage.setItem(GUEST_KEY, '1')
    } catch {
      /* egal */
    }
    setGuest(true)
  }, [])

  const value: SessionCtx = {
    loading: session.isLoading || (!!memberId && club.isLoading),
    me,
    guest: guest && !me,
    pending: !!session.data && !memberId,
    email: session.data?.email,
    family,
    signInDemo,
    afterSignIn,
    signOut,
    continueAsGuest,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMe() {
  const v = useContext(Ctx)
  if (!v) throw new Error('SessionProvider fehlt')
  return v
}
