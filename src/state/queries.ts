import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { addDays, subDays } from 'date-fns'
import { api } from '@/data'
import type { ChangeScope } from '@/data/api'
import type { ClubEvent, ID } from '@/data/types'

export const keys = {
  session: ['session'] as const,
  club: ['club'] as const,
  events: ['events'] as const,
  event: (id: ID) => ['event', id] as const,
  rsvps: (ids: ID[]) => ['rsvps', ids.join(',')] as const,
  absences: ['absences'] as const,
  carpools: (id: ID) => ['carpools', id] as const,
  gameActions: (ids?: ID[]) => ['gameActions', ids?.join(',') ?? 'all'] as const,
  leagues: ['leagues'] as const,
  helpers: ['helpers'] as const,
  news: ['news'] as const,
  specials: ['specials'] as const,
  notifications: ['notifications'] as const,
  requests: ['requests'] as const,
}

const SCOPE_KEYS: Record<Exclude<ChangeScope, 'all'>, string[]> = {
  events: ['events', 'event'],
  rsvps: ['rsvps'],
  absences: ['absences'],
  carpools: ['carpools'],
  gameActions: ['gameActions'],
  helpers: ['helpers'],
  news: ['news'],
  notifications: ['notifications'],
  members: ['club'],
  requests: ['requests'],
}

export function invalidateScope(qc: QueryClient, scope: ChangeScope) {
  if (scope === 'all') return qc.invalidateQueries()
  return Promise.all(SCOPE_KEYS[scope].map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

/** Zeitfenster, das die App vorlädt: 4 Monate zurück, 6 Monate voraus */
const WINDOW = () => ({ from: subDays(new Date(), 120).toISOString(), to: addDays(new Date(), 200).toISOString() })

export function useSession() {
  return useQuery({ queryKey: keys.session, queryFn: () => api.getSession(), staleTime: Infinity })
}

export function useClub() {
  const q = useQuery({ queryKey: keys.club, queryFn: () => api.getClubData(), staleTime: 5 * 60_000 })
  const maps = useMemo(() => {
    const d = q.data
    return {
      memberById: new Map(d?.members.map((m) => [m.id, m]) ?? []),
      teamById: new Map(d?.teams.map((t) => [t.id, t]) ?? []),
      venueById: new Map(d?.venues.map((v) => [v.id, v]) ?? []),
    }
  }, [q.data])
  return { ...q, ...maps, teams: q.data?.teams ?? [], members: q.data?.members ?? [], venues: q.data?.venues ?? [] }
}

export function useEvents() {
  return useQuery({
    queryKey: keys.events,
    queryFn: () => {
      const w = WINDOW()
      return api.listEvents(w.from, w.to)
    },
  })
}

const isLive = (e: ClubEvent | null | undefined) => e?.game?.status === 'live' || e?.game?.status === 'halftime'

export function useEvent(id: ID | undefined) {
  return useQuery({
    queryKey: keys.event(id ?? ''),
    queryFn: () => api.getEvent(id!),
    enabled: !!id,
    // Fallback zu Realtime: laufende Spiele regelmäßig aktualisieren
    refetchInterval: (q) => (isLive(q.state.data) ? 10_000 : false),
  })
}

export function useRsvps(events: Pick<ClubEvent, 'id'>[] | undefined, enabled = true) {
  const ids = useMemo(() => (events ?? []).map((e) => e.id).sort(), [events])
  return useQuery({
    queryKey: keys.rsvps(ids),
    queryFn: () => api.listRsvps(ids),
    enabled: enabled && ids.length > 0,
    placeholderData: (prev) => prev,
  })
}

export const useAbsences = (enabled = true) =>
  useQuery({ queryKey: keys.absences, queryFn: () => api.listAbsences(), enabled })
export const useCarpools = (eventId: ID) =>
  useQuery({ queryKey: keys.carpools(eventId), queryFn: () => api.listCarpools(eventId) })
export const useGameActions = (eventIds?: ID[], live = false) =>
  useQuery({
    queryKey: keys.gameActions(eventIds),
    queryFn: () => api.listGameActions(eventIds),
    refetchInterval: live ? 10_000 : false,
  })
export const useLeagues = () => useQuery({ queryKey: keys.leagues, queryFn: () => api.listLeagues() })
export const useHelperLists = () => useQuery({ queryKey: keys.helpers, queryFn: () => api.listHelperLists() })
export const useNews = () => useQuery({ queryKey: keys.news, queryFn: () => api.listNews() })
export const useSpecials = () => useQuery({ queryKey: keys.specials, queryFn: () => api.listSpecials() })
export const useNotifications = (enabled = true) =>
  useQuery({ queryKey: keys.notifications, queryFn: () => api.listNotifications(), enabled })
export const useAccessRequests = (enabled = true) =>
  useQuery({ queryKey: keys.requests, queryFn: () => api.listAccessRequests(), enabled })

/** Mutation, die nach Erfolg die betroffenen Bereiche neu lädt. */
export function useApiMutation<TArgs, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  scopes: ChangeScope[],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(scopes.map((s) => invalidateScope(qc, s))),
  })
}
