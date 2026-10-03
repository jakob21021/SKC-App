-- =====================================================================
-- SKC-App: Geprüfte Aktionen (RPC) und Automatismen (Trigger)
-- =====================================================================

-- ---------------------------------------------------------------- Zu-/Absagen
create or replace function public.set_rsvp(
  p_event_id uuid, p_member_id uuid, p_status rsvp_status, p_reason absence_reason default null, p_comment text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  if not public.can_act_for(p_member_id) and not public.can_manage_event(p_event_id) then
    raise exception 'Du darfst nur für dich und deine Kinder antworten.' using errcode = '42501';
  end if;
  select * into e from events where id = p_event_id;
  if not found or not e.rsvp_enabled then raise exception 'Termin nicht gefunden'; end if;
  if not (p_member_id = any (public.event_roster(p_event_id))) and not public.can_manage_event(p_event_id) then
    raise exception 'Für diesen Termin bist du nicht angefragt.';
  end if;
  if not public.can_manage_event(p_event_id) then
    if e.ends_at < now() then raise exception 'Der Termin ist schon vorbei.'; end if;
    if e.rsvp_deadline is not null and e.rsvp_deadline < now() then
      raise exception 'Rückmeldefrist abgelaufen – bitte direkt beim Trainerteam melden.';
    end if;
  end if;
  insert into rsvps (event_id, member_id, status, reason, comment, updated_at, updated_by)
  values (p_event_id, p_member_id, p_status, case when p_status = 'no' then p_reason end, nullif(trim(p_comment), ''), now(), public.current_member_id())
  on conflict (event_id, member_id) do update
    set status = excluded.status, reason = excluded.reason, comment = excluded.comment,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end $$;

-- ---------------------------------------------------------------- Termine
create or replace function public.cancel_event(p_event_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_event(p_event_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  update events set cancelled = true, cancel_reason = nullif(trim(p_reason), '') where id = p_event_id;
end $$;

create or replace function public.set_squad(p_event_id uuid, p_member_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_event(p_event_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  update events set squad = coalesce(p_member_ids, '{}') where id = p_event_id and kind = 'game';
end $$;

create or replace function public.remind_open(p_event_id uuid, p_member_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  if not public.can_manage_event(p_event_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  select * into e from events where id = p_event_id;
  -- Nur wirklich Angefragte ohne Antwort erinnern
  perform public.notify_members(
    array(select unnest(p_member_ids) intersect select unnest(public.event_roster(p_event_id))
          except select member_id from rsvps where event_id = p_event_id),
    'reminder', 'Rückmeldung fehlt', format('Bitte sag für „%s“ zu oder ab.', e.title), '/termine/' || p_event_id,
    public.current_member_id());
  return cardinality(p_member_ids);
end $$;

create or replace function public.set_game_status(p_event_id uuid, p_status game_status, p_period int default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_event(p_event_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  update events set
    game_status = p_status,
    period = coalesce(p_period, period),
    period_started_at = case when p_period is not null then now() else period_started_at end
  where id = p_event_id and kind = 'game';
end $$;

-- Spielstand automatisch aus dem Live-Ticker berechnen
create or replace function public.recompute_score() returns trigger
language plpgsql security definer set search_path = public as $$
declare eid uuid := coalesce(new.event_id, old.event_id);
begin
  update events set
    score_us = (select count(*) from game_actions where event_id = eid and type = 'goal' and side = 'us'),
    score_them = (select count(*) from game_actions where event_id = eid and type = 'goal' and side = 'them')
  where id = eid;
  return null;
end $$;
create trigger game_actions_score after insert or delete on public.game_actions
for each row execute function public.recompute_score();

create or replace function public.stamp_game_action() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := public.current_member_id();
  return new;
end $$;
create trigger game_actions_stamp before insert on public.game_actions
for each row execute function public.stamp_game_action();

create or replace function public.stamp_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := coalesce(new.created_by, public.current_member_id());
  return new;
end $$;
create trigger events_stamp before insert on public.events
for each row execute function public.stamp_event();

-- Benachrichtigungen bei neuen Terminen, Absagen, Nominierungen und Anpfiff
create or replace function public.events_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_member_id();
begin
  if tg_op = 'INSERT' then
    if new.series_id is null and new.rsvp_enabled then
      perform public.notify_members(public.event_roster(new.id),
        case when new.kind = 'game' then 'game' else 'event' end::notification_kind,
        case when new.kind = 'game' then 'Neues Spiel angesetzt' else 'Neuer Termin' end,
        new.title, '/termine/' || new.id, me);
    end if;
    return null;
  end if;
  if new.cancelled and not old.cancelled then
    perform public.notify_members(public.event_roster(new.id), 'event', 'Abgesagt: ' || new.title,
      coalesce(new.cancel_reason, 'Der Termin fällt aus.'), '/termine/' || new.id, me);
  end if;
  if new.squad is distinct from old.squad then
    perform public.notify_members(array(select unnest(new.squad) except select unnest(old.squad)), 'game',
      'Du bist nominiert! 🏆', new.title || ' – bitte sag zu oder ab.', '/termine/' || new.id, me);
  end if;
  if new.game_status = 'live' and old.game_status = 'scheduled' then
    perform public.notify_members(array(select tm.member_id from team_members tm where tm.team_id = any (new.team_ids)),
      'game', '🔴 Live: Anpfiff!', new.title, '/termine/' || new.id, me);
  end if;
  if (new.starts_at, new.venue_id) is distinct from (old.starts_at, old.venue_id) and not new.cancelled then
    perform public.notify_members(public.event_roster(new.id), 'event', 'Geändert: ' || new.title,
      'Uhrzeit oder Ort haben sich geändert.', '/termine/' || new.id, me);
  end if;
  return null;
end $$;
create trigger events_notify after insert or update on public.events
for each row execute function public.events_notify();

-- ---------------------------------------------------------------- Fahrgemeinschaften
create or replace function public.join_carpool(p_carpool_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c carpools; taken int;
begin
  if not public.can_act_for(p_member_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  select * into c from carpools where id = p_carpool_id for update;
  if not found then raise exception 'Fahrt nicht gefunden'; end if;
  select count(*) into taken from carpool_passengers where carpool_id = p_carpool_id and member_id <> p_member_id;
  if taken >= c.seats then raise exception 'Leider schon voll.'; end if;
  -- Pro Termin nur eine Mitfahrt
  delete from carpool_passengers cp using carpools other
  where cp.carpool_id = other.id and other.event_id = c.event_id and cp.member_id = p_member_id;
  insert into carpool_passengers (carpool_id, member_id) values (p_carpool_id, p_member_id);
  perform public.notify_members(array[c.driver_id], 'event', 'Neue Mitfahrt',
    (select first_name from members where id = p_member_id) || ' fährt bei dir mit.', '/termine/' || c.event_id, public.current_member_id());
end $$;

create or replace function public.leave_carpool(p_carpool_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_act_for(p_member_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  delete from carpool_passengers where carpool_id = p_carpool_id and member_id = p_member_id;
end $$;

-- ---------------------------------------------------------------- Helferlisten
create or replace function public.signup_shift(p_shift_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s helper_shifts; taken int;
begin
  if not public.can_act_for(p_member_id) then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  select * into s from helper_shifts where id = p_shift_id for update;
  if not found then raise exception 'Schicht nicht gefunden'; end if;
  select count(*) into taken from shift_signups where shift_id = p_shift_id;
  if taken >= s.slots then raise exception 'Diese Schicht ist schon voll.'; end if;
  insert into shift_signups (shift_id, member_id) values (p_shift_id, p_member_id) on conflict do nothing;
end $$;

create or replace function public.leave_shift(p_shift_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_act_for(p_member_id) and not public.is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  delete from shift_signups where shift_id = p_shift_id and member_id = p_member_id;
end $$;

/** Legt eine Helferliste samt Schichten an. p_shifts: [{title, starts_at, ends_at, slots, icon}] */
create or replace function public.save_helper_list(
  p_title text, p_description text, p_day date, p_venue_id uuid, p_event_id uuid, p_shifts jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  insert into helper_lists (title, description, day, venue_id, event_id, created_by)
  values (p_title, p_description, p_day, p_venue_id, p_event_id, public.current_member_id())
  returning id into lid;
  insert into helper_shifts (list_id, title, starts_at, ends_at, slots, icon, sort)
  select lid, s->>'title', (s->>'starts_at')::timestamptz, (s->>'ends_at')::timestamptz, (s->>'slots')::int,
         coalesce(s->>'icon', 'heart')::shift_icon, ord::int
  from jsonb_array_elements(p_shifts) with ordinality as t(s, ord);
  perform public.notify_members(
    array(select id from members where birth_year is null or birth_year <= extract(year from now()) - 16),
    'helper', 'Helfer:innen gesucht', p_title, '/helfen/' || lid, public.current_member_id());
  return lid;
end $$;

-- ---------------------------------------------------------------- News, Reaktionen, Umfragen
create or replace function public.create_post(
  p_title text, p_body text, p_category news_category, p_team_id uuid, p_pinned boolean, p_visibility visibility,
  p_poll_question text default null, p_poll_options text[] default null, p_poll_multi boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; poll_id uuid;
begin
  if not (public.is_admin() or (p_team_id is not null and p_team_id = any (public.coached_team_ids()))) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  insert into news (title, body, category, team_id, pinned, visibility, author_id)
  values (p_title, p_body, p_category, p_team_id, p_pinned and public.is_admin(),
          case when p_poll_question is not null then 'members' else p_visibility end, public.current_member_id())
  returning id into pid;
  if p_poll_question is not null and cardinality(p_poll_options) >= 2 then
    insert into polls (post_id, question, multi) values (pid, p_poll_question, p_poll_multi) returning id into poll_id;
    insert into poll_options (poll_id, label, sort)
    select poll_id, label, ord::int from unnest(p_poll_options) with ordinality as t(label, ord) where trim(label) <> '';
  end if;
  perform public.notify_members(
    case when p_team_id is null then array(select id from members)
         else array(select member_id from team_members where team_id = p_team_id) end,
    'news', case when p_poll_question is not null then 'Neue Umfrage' else 'Neuigkeit' end, p_title,
    '/news/' || pid, public.current_member_id());
  return pid;
end $$;

create or replace function public.toggle_reaction(p_post_id uuid, p_emoji text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_member_id();
begin
  if me is null then raise exception 'Bitte melde dich an.' using errcode = '42501'; end if;
  if exists (select 1 from news_reactions where post_id = p_post_id and member_id = me and emoji = p_emoji) then
    delete from news_reactions where post_id = p_post_id and member_id = me and emoji = p_emoji;
  else
    insert into news_reactions (post_id, member_id, emoji) values (p_post_id, me, p_emoji);
  end if;
end $$;

create or replace function public.vote(p_poll_id uuid, p_option_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_member_id(); p polls;
begin
  if me is null then raise exception 'Bitte melde dich an.' using errcode = '42501'; end if;
  select * into p from polls where id = p_poll_id;
  if not found then raise exception 'Umfrage nicht gefunden'; end if;
  if p.closes_at is not null and p.closes_at < now() then raise exception 'Die Umfrage ist beendet.'; end if;
  if not p.multi and cardinality(p_option_ids) > 1 then raise exception 'Nur eine Antwort möglich.'; end if;
  delete from poll_votes v using poll_options o where v.option_id = o.id and o.poll_id = p_poll_id and v.member_id = me;
  insert into poll_votes (option_id, member_id)
  select o.id, me from poll_options o where o.poll_id = p_poll_id and o.id = any (p_option_ids);
end $$;

-- ---------------------------------------------------------------- Profil
create or replace function public.update_my_contact(p_member_id uuid, p_phone text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_act_for(p_member_id) and not public.is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  update members set phone = nullif(trim(p_phone), '') where id = p_member_id;
end $$;

-- ---------------------------------------------------------------- Push
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb default '{}')
returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_member_id();
begin
  if me is null then raise exception 'Bitte melde dich an.' using errcode = '42501'; end if;
  insert into push_subscriptions (member_id, endpoint, p256dh, auth, prefs)
  values (me, p_endpoint, p_p256dh, p_auth, coalesce(p_prefs, '{}'))
  on conflict (endpoint) do update set member_id = me, p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs;
end $$;

-- ---------------------------------------------------------------- Zugänge
-- Login-Konten werden über die E-Mail-Adresse mit Mitgliedern verknüpft.
create or replace function public.link_member_to_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update members set user_id = new.id where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.link_member_to_user();

create or replace function public.link_user_to_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    new.user_id := (select u.id from auth.users u where lower(u.email) = lower(new.email)
                    and not exists (select 1 from members m where m.user_id = u.id) limit 1);
  end if;
  return new;
end $$;
create trigger members_link_user before insert or update of email on public.members
for each row execute function public.link_user_to_member();

create or replace function public.access_request_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_members(array(select id from members where roles && '{admin}'::member_role[]),
    'system', 'Neue Zugangsanfrage', new.name || ' möchte der App beitreten.', '/verwaltung');
  return null;
end $$;
create trigger access_requests_notify after insert on public.access_requests
for each row execute function public.access_request_notify();

create or replace function public.resolve_access_request(p_id uuid, p_approve boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare r access_requests; mid uuid; child uuid; first text; last text;
begin
  if not public.is_admin() then raise exception 'Keine Berechtigung' using errcode = '42501'; end if;
  select * into r from access_requests where id = p_id and status = 'open' for update;
  if not found then raise exception 'Anfrage nicht gefunden oder schon bearbeitet'; end if;
  update access_requests set status = case when p_approve then 'approved' else 'rejected' end::request_status where id = p_id;
  if not p_approve then return null; end if;

  first := split_part(trim(r.name), ' ', 1);
  last := coalesce(nullif(trim(substr(trim(r.name), length(first) + 1)), ''), '–');
  select id into mid from members where lower(email) = lower(r.email);
  if mid is null then
    insert into members (first_name, last_name, email, gender, roles)
    values (first, last, r.email, r.gender,
            array[case r.kind when 'parent' then 'parent' when 'coach' then 'coach' else 'player' end]::member_role[])
    returning id into mid;
  end if;
  if r.team_id is not null then
    if r.kind = 'player' then insert into team_members values (r.team_id, mid) on conflict do nothing; end if;
    if r.kind = 'coach' then insert into team_coaches values (r.team_id, mid) on conflict do nothing; end if;
  end if;
  if r.kind = 'parent' and r.child_name is not null then
    select m.id into child from members m
    where lower(m.first_name || ' ' || m.last_name) = lower(trim(r.child_name)) limit 1;
    if child is not null then insert into guardians values (mid, child) on conflict do nothing; end if;
  end if;
  return mid;
end $$;

-- ---------------------------------------------------------------- Ausführungsrechte
revoke execute on function public.recompute_score(), public.stamp_game_action(), public.stamp_event(),
  public.events_notify(), public.link_member_to_user(), public.link_user_to_member(), public.access_request_notify()
  from public, anon, authenticated;
