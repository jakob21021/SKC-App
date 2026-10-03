-- =====================================================================
-- SKC-App: Datenbankschema für Supabase (Postgres)
-- Zugriff wird vollständig über Row Level Security und geprüfte
-- Funktionen (RPC) geregelt. Sensible Angaben (Absagegründe, Telefon)
-- sind nur für Trainer:innen, Vorstand und Betroffene sichtbar.
-- =====================================================================

-- ---------------------------------------------------------------- Typen
create type public.gender as enum ('w', 'm');
create type public.member_role as enum ('player', 'coach', 'parent', 'board', 'admin');
create type public.event_kind as enum ('training', 'game', 'club');
create type public.game_status as enum ('scheduled', 'live', 'halftime', 'finished');
create type public.rsvp_status as enum ('yes', 'no', 'maybe');
create type public.absence_reason as enum ('krank', 'verletzt', 'arbeit', 'schule', 'urlaub', 'privat', 'sonstiges');
create type public.visibility as enum ('public', 'members');
create type public.shot_type as enum ('distance', 'close', 'running_in', 'penalty', 'free_pass');
create type public.game_action_type as enum ('goal', 'miss', 'period');
create type public.news_category as enum ('Verein', 'Spielbericht', 'Jugend', 'Info');
create type public.special_category as enum ('Sponsor', 'Fanshop', 'Verein');
create type public.notification_kind as enum ('event', 'game', 'helper', 'news', 'reminder', 'system');
create type public.access_kind as enum ('player', 'parent', 'coach', 'fan');
create type public.request_status as enum ('open', 'approved', 'rejected');
create type public.shift_icon as enum ('cake', 'cash', 'clock', 'wrench', 'grill', 'broom', 'camera', 'heart');
create type public.training_default as enum ('open', 'yes');

-- ---------------------------------------------------------------- Stammdaten
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short text not null,
  age_group text not null default 'Senioren',
  league text,
  sort_order int not null default 0,
  training_default public.training_default not null default 'open'
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  street text,
  city text not null default 'Castrop-Rauxel',
  maps_query text not null,
  notes text
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  -- Login-Konto. Kinder haben oft keins – dann antworten die Eltern.
  user_id uuid unique references auth.users (id) on delete set null,
  first_name text not null,
  last_name text not null,
  gender public.gender,
  birth_year int check (birth_year between 1900 and 2100),
  jersey_number int check (jersey_number between 0 and 99),
  email text,
  phone text,
  title text,
  roles public.member_role[] not null default '{player}',
  avatar_hue int not null default floor(random() * 360)::int,
  created_at timestamptz not null default now()
);
create unique index members_email_key on public.members (lower(email)) where email is not null;

create table public.team_members (
  team_id uuid not null references public.teams on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  primary key (team_id, member_id)
);
create index on public.team_members (member_id);

create table public.team_coaches (
  team_id uuid not null references public.teams on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  primary key (team_id, member_id)
);
create index on public.team_coaches (member_id);

create table public.guardians (
  parent_id uuid not null references public.members on delete cascade,
  child_id uuid not null references public.members on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);
create index on public.guardians (child_id);

-- ---------------------------------------------------------------- Termine
create table public.events (
  id uuid primary key default gen_random_uuid(),
  kind public.event_kind not null,
  title text not null,
  team_ids uuid[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_id uuid references public.venues on delete set null,
  meet_at timestamptz,
  rsvp_deadline timestamptz,
  description text,
  cancelled boolean not null default false,
  cancel_reason text,
  series_id uuid,
  rsvp_enabled boolean not null default true,
  visibility public.visibility not null default 'members',
  -- Spiel
  opponent text,
  home boolean,
  competition text,
  game_status public.game_status,
  half_minutes int,
  score_us int,
  score_them int,
  squad uuid[] not null default '{}',
  period int check (period in (1, 2)),
  period_started_at timestamptz,
  created_by uuid references public.members on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (kind <> 'game' or (opponent is not null and game_status is not null and half_minutes is not null))
);
create index on public.events (starts_at);
create index on public.events using gin (team_ids);

create table public.rsvps (
  event_id uuid not null references public.events on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  status public.rsvp_status not null,
  reason public.absence_reason,
  comment text check (length(comment) <= 280),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.members on delete set null,
  primary key (event_id, member_id)
);
create index on public.rsvps (member_id);

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  from_day date not null,
  to_day date not null,
  reason public.absence_reason not null,
  note text,
  check (to_day >= from_day)
);
create index on public.absences (member_id);

create table public.carpools (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  driver_id uuid not null references public.members on delete cascade,
  seats int not null check (seats between 1 and 8),
  meet_point text not null,
  depart_at timestamptz not null,
  note text
);
create index on public.carpools (event_id);

create table public.carpool_passengers (
  carpool_id uuid not null references public.carpools on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  primary key (carpool_id, member_id)
);

-- ---------------------------------------------------------------- Helferlisten
create table public.helper_lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_id uuid references public.events on delete set null,
  venue_id uuid references public.venues on delete set null,
  day date not null,
  created_by uuid references public.members on delete set null,
  created_at timestamptz not null default now()
);

create table public.helper_shifts (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.helper_lists on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slots int not null check (slots between 1 and 100),
  icon public.shift_icon not null default 'heart',
  sort int not null default 0
);
create index on public.helper_shifts (list_id);

create table public.shift_signups (
  shift_id uuid not null references public.helper_shifts on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shift_id, member_id)
);

-- ---------------------------------------------------------------- News, Umfragen, Specials
create table public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  author_id uuid references public.members on delete set null,
  created_at timestamptz not null default now(),
  category public.news_category not null default 'Verein',
  team_id uuid references public.teams on delete set null,
  pinned boolean not null default false,
  visibility public.visibility not null default 'public'
);

create table public.news_reactions (
  post_id uuid not null references public.news on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  emoji text not null check (length(emoji) <= 16),
  primary key (post_id, member_id, emoji)
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.news on delete cascade,
  question text not null,
  multi boolean not null default false,
  closes_at timestamptz
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls on delete cascade,
  label text not null,
  sort int not null default 0
);

create table public.poll_votes (
  option_id uuid not null references public.poll_options on delete cascade,
  member_id uuid not null references public.members on delete cascade,
  primary key (option_id, member_id)
);

create table public.specials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  partner text not null,
  category public.special_category not null,
  url text,
  valid_until date,
  highlight boolean not null default false,
  sort int not null default 0
);

-- Rabattcodes nur für Mitglieder
create table public.special_codes (
  special_id uuid primary key references public.specials on delete cascade,
  code text not null
);

-- ---------------------------------------------------------------- Spiele
create table public.game_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  at timestamptz not null default now(),
  period int not null check (period in (1, 2)),
  minute int not null check (minute >= 0),
  side text not null check (side in ('us', 'them')),
  type public.game_action_type not null,
  shot public.shot_type,
  member_id uuid references public.members on delete set null,
  text text,
  created_by uuid references public.members on delete set null
);
create index on public.game_actions (event_id, at);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null,
  team_id uuid not null references public.teams on delete cascade
);

create table public.league_rows (
  league_id uuid not null references public.leagues on delete cascade,
  team text not null,
  played int not null default 0,
  won int not null default 0,
  drawn int not null default 0,
  lost int not null default 0,
  goals_for int not null default 0,
  goals_against int not null default 0,
  points int not null default 0,
  is_us boolean not null default false,
  sort int not null default 0,
  primary key (league_id, team)
);

-- ---------------------------------------------------------------- Benachrichtigungen & Zugänge
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  created_at timestamptz not null default now(),
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false
);
create index on public.notifications (member_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Welche Arten sollen gepusht werden? z. B. {"news": false}
  prefs jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  kind public.access_kind not null,
  gender public.gender,
  team_id uuid references public.teams on delete set null,
  child_name text,
  message text check (length(message) <= 1000),
  created_at timestamptz not null default now(),
  status public.request_status not null default 'open'
);
