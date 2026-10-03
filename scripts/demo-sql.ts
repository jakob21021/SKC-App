// Erzeugt supabase/seed.demo.sql aus den Demo-Daten der App.
// Damit startet eine lokale Supabase-Datenbank mit denselben Beispieldaten wie der Demo-Modus.
// Aufruf: npm run demo:sql
//
// Alle Zeitangaben werden beim Einspielen wochenweise auf "jetzt" verschoben,
// damit die Termine auch Monate später noch aktuell wirken.
import { writeFileSync } from 'node:fs'
import { createSeed } from '../src/data/demo/seed'

process.env.TZ = 'Europe/Berlin'
// SEED_NOW / SEED_OUT nur für Tests: Daten "von früher" erzeugen
const db = createSeed(process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date())
const generatedAt = db.seededAt

type Val = string | number | boolean | null | undefined | Raw
class Raw {
  constructor(public sql: string) {}
}
const raw = (sql: string) => new Raw(sql)

const q = (v: Val): string => {
  if (v instanceof Raw) return v.sql
  if (v == null) return 'null'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return `'${v.replace(/'/g, "''")}'`
}
/** Stabile UUID aus einer Demo-ID (Teams/Hallen werden auf vorhandene Einträge abgebildet) */
const id = (demoId: string | undefined | null) => raw(demoId ? `pg_temp._id(${q(demoId)})` : 'null')
const ids = (list: string[]) => raw(list.length ? `array[${list.map((x) => `pg_temp._id(${q(x)})`).join(', ')}]::uuid[]` : `'{}'::uuid[]`)
const ts = (iso: string | undefined | null) => raw(iso ? `pg_temp._ts(${q(iso)})` : 'null')
const day = (d: string | undefined | null) => raw(d ? `pg_temp._day(${q(d)})` : 'null')

const out: string[] = []
const insert = (table: string, cols: string[], rows: Val[][]) => {
  if (!rows.length) return
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    out.push(`insert into public.${table} (${cols.join(', ')}) values\n${chunk.map((r) => `  (${r.map(q).join(', ')})`).join(',\n')};\n`)
  }
}

out.push(`-- Beispieldaten für den lokalen Testbetrieb (automatisch erzeugt aus src/data/demo/seed.ts – nicht von Hand bearbeiten).
-- Alle Personen sind frei erfunden. Anmelden z. B. mit lena@example.org, tim@example.org,
-- sabine@example.org oder andrea@example.org – den Code zeigt die lokale Mail-Ansicht (http://127.0.0.1:54324).

-- IDs: Teams und Hallen aus seed.sql wiederverwenden, alles andere stabil aus der Demo-ID ableiten
create temp table _ids (demo text primary key, id uuid not null);
insert into _ids select 't1', id from public.teams where short = '1. M';
insert into _ids select 't2', id from public.teams where short = '2. M';
insert into _ids select 'ta', id from public.teams where short = 'A';
insert into _ids select 'tc', id from public.teams where short = 'C';
insert into _ids select 'td', id from public.teams where short = 'D';
insert into _ids select 'tf', id from public.teams where short = 'F';
insert into _ids select 'th', id from public.teams where short = 'Hobby';
insert into _ids select 'v-home', id from public.venues where name = 'Sporthalle Bodelschwingher Straße';
insert into _ids select 'v-asg', id from public.venues where name = 'ASG-Halle';
insert into _ids select 'v-heim', id from public.venues where name = 'Vereinsheim';
create function pg_temp._id(t text) returns uuid language sql stable as
  $$ select coalesce((select id from _ids where demo = t), md5('skc-demo:' || t)::uuid) $$;

-- Zeitverschiebung: ganze Wochen seit dem Erzeugen, in Ortszeit (Sommer-/Winterzeit bleibt korrekt)
create temp table _shift as select
  date_trunc('week', now() at time zone 'Europe/Berlin') - date_trunc('week', ${q(generatedAt)}::timestamptz at time zone 'Europe/Berlin') as weeks;
create function pg_temp._ts(t text) returns timestamptz language sql stable as
  $$ select ((t::timestamptz at time zone 'Europe/Berlin') + (select weeks from _shift)) at time zone 'Europe/Berlin' $$;
create function pg_temp._day(d text) returns date language sql stable as
  $$ select (d::date + (select weeks from _shift))::date $$;

-- Benachrichtigungs-Trigger beim Einspielen aus, sonst bekäme jede:r hunderte Meldungen
alter table public.events disable trigger events_notify;
alter table public.game_actions disable trigger game_actions_score;
alter table public.access_requests disable trigger access_requests_notify;
`)

// Teams und Hallen
const known = new Set(['t1', 't2', 'ta', 'tc', 'td', 'tf', 'th', 'v-home', 'v-asg', 'v-heim'])
insert(
  'venues',
  ['id', 'name', 'street', 'city', 'maps_query', 'notes'],
  db.venues.filter((v) => !known.has(v.id)).map((v) => [id(v.id), v.name, v.street, v.city, v.mapsQuery, v.notes]),
)

// Mitglieder
insert(
  'members',
  ['id', 'first_name', 'last_name', 'gender', 'birth_year', 'jersey_number', 'email', 'phone', 'title', 'roles', 'avatar_hue'],
  db.members.map((m) => [id(m.id), m.firstName, m.lastName, m.gender, m.birthYear, m.jerseyNumber, m.email, m.phone, m.title, raw(`'{${m.roles.join(',')}}'::public.member_role[]`), m.avatarHue]),
)
insert('team_members', ['team_id', 'member_id'], db.members.flatMap((m) => m.teamIds.map((t) => [id(t), id(m.id)])))
insert('team_coaches', ['team_id', 'member_id'], db.members.flatMap((m) => m.coachOf.map((t) => [id(t), id(m.id)])))
insert('guardians', ['parent_id', 'child_id'], db.members.flatMap((m) => m.parentOf.map((c) => [id(m.id), id(c)])))

// Termine & Spiele (laufende Spiele aus der Demo werden als beendet übernommen)
insert(
  'events',
  ['id', 'kind', 'title', 'team_ids', 'starts_at', 'ends_at', 'venue_id', 'meet_at', 'rsvp_deadline', 'description', 'cancelled', 'cancel_reason', 'series_id', 'rsvp_enabled', 'visibility', 'opponent', 'home', 'competition', 'game_status', 'half_minutes', 'score_us', 'score_them', 'squad'],
  db.events.map((e) => {
    const g = e.game
    const status = g ? (g.status === 'scheduled' ? 'scheduled' : 'finished') : null
    return [
      id(e.id), e.kind, e.title, ids(e.teamIds), ts(e.start), ts(e.end), id(e.venueId), ts(e.meetAt), ts(e.rsvpDeadline), e.description,
      !!e.cancelled, e.cancelReason, id(e.seriesId), e.rsvpEnabled, e.visibility,
      g?.opponent, g?.home, g?.competition, status, g?.halfMinutes, g?.scoreUs, g?.scoreThem, ids(g?.squad ?? []),
    ]
  }),
)
insert(
  'rsvps',
  ['event_id', 'member_id', 'status', 'reason', 'comment', 'updated_at', 'updated_by'],
  db.rsvps.map((r) => [id(r.eventId), id(r.memberId), r.status, r.reason, r.comment, ts(r.updatedAt), id(r.updatedBy)]),
)
insert('absences', ['id', 'member_id', 'from_day', 'to_day', 'reason', 'note'], db.absences.map((a) => [id(a.id), id(a.memberId), day(a.from), day(a.to), a.reason, a.note]))
insert('carpools', ['id', 'event_id', 'driver_id', 'seats', 'meet_point', 'depart_at', 'note'], db.carpools.map((c) => [id(c.id), id(c.eventId), id(c.driverId), c.seats, c.meetPoint, ts(c.departAt), c.note]))
insert('carpool_passengers', ['carpool_id', 'member_id'], db.carpools.flatMap((c) => c.passengerIds.map((p) => [id(c.id), id(p)])))

// Live-Ticker-Daten
insert(
  'game_actions',
  ['id', 'event_id', 'at', 'period', 'minute', 'side', 'type', 'shot', 'member_id', 'text'],
  db.gameActions.map((a) => [id(a.id), id(a.eventId), ts(a.at), a.period, Math.round(a.minute), a.side, a.type, a.shot, id(a.memberId), a.text]),
)

// Helferlisten
insert('helper_lists', ['id', 'title', 'description', 'event_id', 'venue_id', 'day', 'created_by'], db.helperLists.map((l) => [id(l.id), l.title, l.description, id(l.eventId), id(l.venueId), day(l.date), id(l.createdBy)]))
insert(
  'helper_shifts',
  ['id', 'list_id', 'title', 'starts_at', 'ends_at', 'slots', 'icon', 'sort'],
  db.helperLists.flatMap((l) => l.shifts.map((s, i) => [id(s.id), id(l.id), s.title, ts(s.start), ts(s.end), s.slots, s.icon, i])),
)
insert('shift_signups', ['shift_id', 'member_id'], db.helperLists.flatMap((l) => l.shifts.flatMap((s) => s.signupIds.map((m) => [id(s.id), id(m)]))))

// News, Reaktionen, Umfragen
insert('news', ['id', 'title', 'body', 'author_id', 'created_at', 'category', 'team_id', 'pinned', 'visibility'], db.news.map((n) => [id(n.id), n.title, n.body, id(n.authorId), ts(n.createdAt), n.category, id(n.teamId), !!n.pinned, n.visibility]))
insert(
  'news_reactions',
  ['post_id', 'member_id', 'emoji'],
  db.news.flatMap((n) => Object.entries(n.reactions).flatMap(([emoji, members]) => [...new Set(members)].map((m) => [id(n.id), id(m), emoji]))),
)
const polls = db.news.filter((n) => n.poll)
insert('polls', ['id', 'post_id', 'question', 'multi', 'closes_at'], polls.map((n) => [id(n.poll!.id), id(n.id), n.poll!.question, n.poll!.multi, ts(n.poll!.closesAt)]))
insert('poll_options', ['id', 'poll_id', 'label', 'sort'], polls.flatMap((n) => n.poll!.options.map((o, i) => [id(o.id), id(n.poll!.id), o.label, i])))
// Pro Person nur eine Stimme je Umfrage (Einfachauswahl)
const voted = new Set<string>()
insert(
  'poll_votes',
  ['option_id', 'member_id'],
  polls.flatMap((n) =>
    n.poll!.options.flatMap((o) =>
      o.voterIds
        .filter((v) => {
          const key = `${n.poll!.id}|${v}`
          if (!n.poll!.multi && voted.has(key)) return false
          voted.add(key)
          return true
        })
        .map((v) => [id(o.id), id(v)]),
    ),
  ),
)

// Specials (Fanshop und „Mitglied wirbt Mitglied“ kommen schon aus seed.sql)
const specials = db.specials.filter((s) => s.id !== 'sp-shop' && s.id !== 'sp-friend')
insert('specials', ['id', 'title', 'description', 'partner', 'category', 'url', 'valid_until', 'highlight', 'sort'], specials.map((s, i) => [id(s.id), s.title, s.description, s.partner, s.category, s.url, day(s.validUntil), !!s.highlight, 10 + i]))
insert('special_codes', ['special_id', 'code'], specials.filter((s) => s.code).map((s) => [id(s.id), s.code]))

// Tabellen
insert('leagues', ['id', 'name', 'season', 'team_id'], db.leagues.map((l) => [id(l.id), l.name, l.season, id(l.teamId)]))
insert(
  'league_rows',
  ['league_id', 'team', 'played', 'won', 'drawn', 'lost', 'goals_for', 'goals_against', 'points', 'is_us', 'sort'],
  db.leagues.flatMap((l) => l.rows.map((r, i) => [id(l.id), r.team, r.played, r.won, r.drawn, r.lost, r.goalsFor, r.goalsAgainst, r.points, !!r.isUs, i])),
)

// Benachrichtigungen und offene Zugangsanfragen
insert('notifications', ['member_id', 'created_at', 'kind', 'title', 'body', 'link', 'read'], db.notifications.map((n) => [id(n.memberId), ts(n.createdAt), n.kind, n.title, n.body, n.link?.replace(/\/(termine|helfen|news)\/([^/]+)$/, (_, area, x) => `/${area}/{${x}}`), n.read]))
insert('access_requests', ['name', 'email', 'kind', 'gender', 'team_id', 'child_name', 'message', 'created_at', 'status'], db.accessRequests.map((r) => [r.name, r.email, r.kind, r.gender, id(r.teamId), r.childName, r.message, ts(r.createdAt), r.status]))

out.push(`
-- Links in Benachrichtigungen auf die neuen IDs umschreiben
update public.notifications set link = regexp_replace(link, '\\{([^}]+)\\}', '') || pg_temp._id(substring(link from '\\{([^}]+)\\}'))::text
where link ~ '\\{';

alter table public.events enable trigger events_notify;
alter table public.game_actions enable trigger game_actions_score;
alter table public.access_requests enable trigger access_requests_notify;
`)

writeFileSync(process.env.SEED_OUT ?? new URL('../supabase/seed.demo.sql', import.meta.url), out.join('\n'))
console.log(`supabase/seed.demo.sql geschrieben: ${db.members.length} Mitglieder, ${db.events.length} Termine, ${db.rsvps.length} Rückmeldungen, ${db.gameActions.length} Spielaktionen`)
