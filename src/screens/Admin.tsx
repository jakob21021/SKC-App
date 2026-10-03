import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import { Check, Search, UserPlus, X } from 'lucide-react'
import { api } from '@/data'
import { fmtRelative } from '@/lib/dates'
import { isAdmin, roleLabel } from '@/lib/permissions'
import { byName, fullName } from '@/lib/util'
import { useAccessRequests, useApiMutation, useClub, useHelperLists } from '@/state/queries'
import { useMe } from '@/state/session'
import { Avatar, Button, Card, Chip, EmptyState, Input, PageHeader, SectionTitle } from '@/components/ui'
import { useToast } from '@/components/Toast'

const KIND_LABEL = { player: 'Spieler:in', parent: 'Elternteil', coach: 'Trainer:in', fan: 'Fan' }

export function Admin() {
  const { me } = useMe()
  const { members, teams, teamById } = useClub()
  const requests = useAccessRequests(isAdmin(me))
  const helpers = useHelperLists()
  const toast = useToast()
  const [q, setQ] = useState('')
  const resolve = useApiMutation((v: { id: string; approve: boolean }) => api.resolveAccessRequest(v.id, v.approve), ['requests', 'members'])
  const filtered = useMemo(
    () =>
      members
        .filter((m) => `${m.firstName} ${m.lastName} ${m.title ?? ''}`.toLowerCase().includes(q.toLowerCase()))
        .sort(byName)
        .slice(0, q ? 50 : 15),
    [members, q],
  )
  if (!isAdmin(me)) return <Navigate to="/" replace />

  const open = (requests.data ?? []).filter((r) => r.status === 'open')
  const players = members.filter((m) => m.teamIds.length).length
  const openSlots = (helpers.data ?? [])
    .filter((l) => new Date(`${l.date}T23:59`) > new Date())
    .reduce((a, l) => a + l.shifts.reduce((b, s) => b + Math.max(0, s.slots - s.signupIds.length), 0), 0)

  return (
    <div>
      <PageHeader back title="Verwaltung" />
      <div className="px-4 pb-10">
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Kpi value={members.length} label="Accounts" />
          <Kpi value={players} label="Spieler:innen" />
          <Kpi value={openSlots} label="offene Helferplätze" />
        </div>

        <SectionTitle>Zugangsanfragen</SectionTitle>
        {open.length === 0 ? (
          <Card>
            <EmptyState icon={<UserPlus className="size-7" />} title="Keine offenen Anfragen" />
          </Card>
        ) : (
          <div className="space-y-3">
            {open.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{r.name}</div>
                    <div className="text-sm text-muted">{r.email}</div>
                  </div>
                  <span className="text-xs text-muted">{fmtRelative(r.createdAt)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip tone="brand">{KIND_LABEL[r.kind]}</Chip>
                  {r.teamId && <Chip>{teamById.get(r.teamId)?.name}</Chip>}
                  {r.gender && <Chip tone="outline">{r.gender === 'w' ? 'Dame' : 'Herr'}</Chip>}
                  {r.childName && <Chip tone="outline">Kind: {r.childName}</Chip>}
                </div>
                {r.message && <p className="mt-2 text-sm">„{r.message}“</p>}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    icon={<Check className="size-4" />}
                    onClick={() => resolve.mutate({ id: r.id, approve: true }, { onSuccess: () => toast(`${r.name} freigeschaltet – Einladung verschickt`) })}
                  >
                    Freischalten
                  </Button>
                  <Button size="sm" variant="secondary" icon={<X className="size-4" />} onClick={() => resolve.mutate({ id: r.id, approve: false }, { onSuccess: () => toast('Abgelehnt') })}>
                    Ablehnen
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <SectionTitle>Mitglieder</SectionTitle>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" placeholder="Suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Card className="divide-y divide-line">
          {filtered.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar member={m} size={34} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{fullName(m)}</div>
                <div className="truncate text-xs text-muted">
                  {roleLabel(m)}
                  {m.teamIds.length > 0 && ` · ${m.teamIds.map((t) => teamById.get(t)?.short).join(', ')}`}
                </div>
              </div>
            </div>
          ))}
        </Card>
        {!q && <p className="mt-2 px-1 text-xs text-muted">{members.length - filtered.length} weitere – zum Finden suchen.</p>}
        <p className="mt-4 px-1 text-xs text-muted">{teams.length} Teams · Rollen (Trainer:in, Vorstand) werden in der Datenbank gepflegt.</p>
      </div>
    </div>
  )
}

function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <Card className="px-2 py-3 text-center">
      <div className="font-display text-3xl font-bold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-muted">{label}</div>
    </Card>
  )
}
