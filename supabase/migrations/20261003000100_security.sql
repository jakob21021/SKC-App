-- =====================================================================
-- SKC-App: Rechte, Sichten (Views) und Funktionen
-- =====================================================================

-- ---------------------------------------------------------------- Hilfsfunktionen
create or replace function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid()
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and roles && '{admin,board}'::member_role[])
$$;

/** Ich selbst und meine Kinder */
create or replace function public.acting_member_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from (
    select m.id from members m where m.user_id = auth.uid()
    union
    select g.child_id from guardians g join members m on m.id = g.parent_id where m.user_id = auth.uid()
  ) s
$$;

create or replace function public.coached_team_ids() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(tc.team_id), '{}')
  from team_coaches tc join members m on m.id = tc.member_id
  where m.user_id = auth.uid()
$$;

create or replace function public.can_act_for(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select target = any (public.acting_member_ids())
$$;

/** Vorstand darf alles, Trainer:innen nur ihre Teams */
create or replace function public.can_manage_teams(team_ids uuid[]) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (cardinality(team_ids) > 0 and team_ids <@ public.coached_team_ids())
$$;

create or replace function public.can_manage_event(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_manage_teams(team_ids) from events where id = eid), false)
$$;

/** Wer ist für einen Termin angefragt? Kader > Teams > alle Spieler:innen */
create or replace function public.event_roster(eid uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select unnest(e.squad) x from events e where e.id = eid and cardinality(e.squad) > 0
    union
    select tm.member_id from events e join team_members tm on tm.team_id = any (e.team_ids)
    where e.id = eid and cardinality(e.squad) = 0 and cardinality(e.team_ids) > 0
    union
    select tm.member_id from events e cross join team_members tm
    where e.id = eid and cardinality(e.squad) = 0 and cardinality(e.team_ids) = 0
  ) s
$$;

/** Benachrichtigt Mitglieder und automatisch deren Eltern. Nur intern nutzbar. */
create or replace function public.notify_members(
  targets uuid[], k notification_kind, t text, b text, l text default null, except_member uuid default null
) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into notifications (member_id, kind, title, body, link)
  select distinct x, k, t, b, l from (
    select unnest(targets) x
    union
    select g.parent_id from guardians g where g.child_id = any (targets)
  ) s
  where x is distinct from except_member;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.notify_members(uuid[], notification_kind, text, text, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- Row Level Security
alter table public.teams enable row level security;
alter table public.venues enable row level security;
alter table public.members enable row level security;
alter table public.team_members enable row level security;
alter table public.team_coaches enable row level security;
alter table public.guardians enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.absences enable row level security;
alter table public.carpools enable row level security;
alter table public.carpool_passengers enable row level security;
alter table public.helper_lists enable row level security;
alter table public.helper_shifts enable row level security;
alter table public.shift_signups enable row level security;
alter table public.news enable row level security;
alter table public.news_reactions enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.specials enable row level security;
alter table public.special_codes enable row level security;
alter table public.game_actions enable row level security;
alter table public.leagues enable row level security;
alter table public.league_rows enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.access_requests enable row level security;

-- Öffentlich lesbar, Pflege durch Vorstand
create policy "lesen" on public.teams for select using (true);
create policy "vorstand" on public.teams for all using (public.is_admin()) with check (public.is_admin());
create policy "lesen" on public.venues for select using (true);
create policy "vorstand" on public.venues for all using (public.is_admin()) with check (public.is_admin());
create policy "lesen" on public.specials for select using (true);
create policy "vorstand" on public.specials for all using (public.is_admin()) with check (public.is_admin());
create policy "mitglieder" on public.special_codes for select using (public.is_member());
create policy "vorstand" on public.special_codes for all using (public.is_admin()) with check (public.is_admin());
create policy "lesen" on public.leagues for select using (true);
create policy "vorstand" on public.leagues for all using (public.is_admin()) with check (public.is_admin());
create policy "lesen" on public.league_rows for select using (true);
create policy "vorstand" on public.league_rows for all using (public.is_admin()) with check (public.is_admin());

-- Mitglieder: Lesen über member_directory (maskiert), Pflege durch Vorstand
create policy "vorstand" on public.members for all using (public.is_admin()) with check (public.is_admin());
create policy "mitglieder lesen" on public.team_members for select using (public.is_member());
create policy "vorstand" on public.team_members for all using (public.is_admin()) with check (public.is_admin());
create policy "mitglieder lesen" on public.team_coaches for select using (public.is_member());
create policy "vorstand" on public.team_coaches for all using (public.is_admin()) with check (public.is_admin());
create policy "mitglieder lesen" on public.guardians for select using (public.is_member());
create policy "vorstand" on public.guardians for all using (public.is_admin()) with check (public.is_admin());

-- Termine: öffentliche für alle, sonst Mitglieder. Anlegen/Ändern: Vorstand oder Trainer:in des Teams
create policy "lesen" on public.events for select using (visibility = 'public' or public.is_member());
create policy "anlegen" on public.events for insert with check (public.can_manage_teams(team_ids));
create policy "ändern" on public.events for update using (public.can_manage_teams(team_ids)) with check (public.can_manage_teams(team_ids));
create policy "löschen" on public.events for delete using (public.can_manage_teams(team_ids));

-- Rückmeldungen: Lesen über rsvp_list, Schreiben über set_rsvp()
create policy "eigene lesen" on public.rsvps for select using (public.can_act_for(member_id) or public.can_manage_event(event_id));

-- Abwesenheiten: Lesen (maskiert) über absence_list, eigene/Kinder pflegen
create policy "eigene lesen" on public.absences for select using (public.can_act_for(member_id) or public.is_admin());
create policy "eigene anlegen" on public.absences for insert with check (public.can_act_for(member_id) or public.is_admin());
create policy "eigene löschen" on public.absences for delete using (public.can_act_for(member_id) or public.is_admin());

-- Fahrgemeinschaften
create policy "mitglieder lesen" on public.carpools for select using (public.is_member());
create policy "fahrt anbieten" on public.carpools for insert with check (driver_id = public.current_member_id());
create policy "eigene ändern" on public.carpools for update using (driver_id = public.current_member_id()) with check (driver_id = public.current_member_id());
create policy "eigene löschen" on public.carpools for delete using (driver_id = public.current_member_id() or public.is_admin());
create policy "mitglieder lesen" on public.carpool_passengers for select using (public.is_member());

-- Helferlisten (Eintragen über signup_shift())
create policy "mitglieder lesen" on public.helper_lists for select using (public.is_member());
create policy "vorstand" on public.helper_lists for all using (public.is_admin()) with check (public.is_admin());
create policy "mitglieder lesen" on public.helper_shifts for select using (public.is_member());
create policy "vorstand" on public.helper_shifts for all using (public.is_admin()) with check (public.is_admin());
create policy "mitglieder lesen" on public.shift_signups for select using (public.is_member());

-- News & Umfragen
create policy "lesen" on public.news for select using (visibility = 'public' or public.is_member());
create policy "löschen" on public.news for delete using (author_id = public.current_member_id() or public.is_admin());
create policy "lesen" on public.news_reactions for select using (true);
create policy "lesen" on public.polls for select using (exists (select 1 from news n where n.id = post_id));
create policy "lesen" on public.poll_options for select using (true);
create policy "mitglieder lesen" on public.poll_votes for select using (public.is_member());

-- Live-Ticker: sichtbar wie der Termin, erfassen dürfen Trainer:innen/Vorstand
create policy "lesen" on public.game_actions for select using (exists (select 1 from events e where e.id = event_id));
create policy "erfassen" on public.game_actions for insert with check (public.can_manage_event(event_id));
create policy "korrigieren" on public.game_actions for delete using (public.can_manage_event(event_id));

-- Benachrichtigungen: nur eigene
create policy "eigene" on public.notifications for select using (member_id = public.current_member_id());
create policy "gelesen markieren" on public.notifications for update using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());
create policy "eigene" on public.push_subscriptions for all using (member_id = public.current_member_id()) with check (member_id = public.current_member_id());

-- Zugangsanfragen: jede:r darf anfragen, nur der Vorstand liest
create policy "anfragen" on public.access_requests for insert with check (status = 'open');
create policy "vorstand" on public.access_requests for select using (public.is_admin());

-- ---------------------------------------------------------------- Maskierte Sichten
-- Diese Views laufen mit den Rechten des Eigentümers und filtern selbst.

create view public.member_directory as
select
  m.id, m.first_name, m.last_name, m.gender, m.birth_year, m.jersey_number, m.title, m.roles, m.avatar_hue,
  case when vis.full then m.email end as email,
  case when vis.full then m.phone end as phone,
  coalesce(array(select tm.team_id from team_members tm where tm.member_id = m.id), '{}') as team_ids,
  coalesce(array(select tc.team_id from team_coaches tc where tc.member_id = m.id), '{}') as coach_of,
  coalesce(array(select g.child_id from guardians g where g.parent_id = m.id), '{}') as parent_of
from members m
cross join lateral (
  select
    m.id = any ((select public.acting_member_ids())::uuid[])
    or (select public.is_admin())
    or exists (select 1 from team_members tm where tm.member_id = m.id and tm.team_id = any ((select public.coached_team_ids())::uuid[]))
    as full
) vis
where (select public.is_member());

create view public.rsvp_list as
select
  r.event_id, r.member_id, r.status,
  case when vis.full then r.reason end as reason,
  case when vis.full or r.status <> 'no' then r.comment end as comment,
  r.updated_at, r.updated_by
from rsvps r
join events e on e.id = r.event_id
cross join lateral (
  select
    r.member_id = any ((select public.acting_member_ids())::uuid[])
    or (select public.is_admin())
    or (cardinality(e.team_ids) > 0 and e.team_ids <@ (select public.coached_team_ids()))
    as full
) vis
where (select public.is_member());

create view public.absence_list as
select
  a.id, a.member_id, a.from_day, a.to_day,
  case when vis.full then a.reason end as reason,
  case when vis.full then a.note end as note
from absences a
cross join lateral (
  select
    a.member_id = any ((select public.acting_member_ids())::uuid[])
    or (select public.is_admin())
    or exists (select 1 from team_members tm where tm.member_id = a.member_id and tm.team_id = any ((select public.coached_team_ids())::uuid[]))
    as full
) vis
where (select public.is_member());

-- ---------------------------------------------------------------- Rechte für die API-Rollen
grant usage on schema public to anon, authenticated;
grant select on public.teams, public.venues, public.specials, public.leagues, public.league_rows,
  public.events, public.news, public.news_reactions, public.polls, public.poll_options, public.game_actions
  to anon, authenticated;
grant insert on public.access_requests to anon, authenticated;
grant select on public.member_directory, public.rsvp_list, public.absence_list to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.rsvps, public.shift_signups, public.carpool_passengers,
  public.poll_votes, public.news_reactions, public.polls, public.poll_options, public.notifications
  from authenticated;
grant update (read) on public.notifications to authenticated;
-- Mitgliederdaten nur über die maskierte Sicht
revoke select on public.members from anon;
