-- Prüft die Beispieldaten (seed.demo.sql) für den lokalen Testbetrieb.
\set QUIET on
set client_min_messages = warning;

create function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'TEST FEHLGESCHLAGEN: %', msg; end if;
end $$;

select pg_temp.check((select count(*) from members) > 80, 'Mitglieder eingespielt');
select pg_temp.check((select count(*) from events) > 150, 'Termine eingespielt');
select pg_temp.check((select count(*) from teams) = 7, 'Keine doppelten Teams');
select pg_temp.check((select count(distinct team_id) from team_members) = 7, 'Alle Teams haben Spieler:innen');
select pg_temp.check((select count(*) from specials) = 5, 'Specials ohne Dubletten');
-- Termine liegen um "jetzt" herum, auch wenn die Datei älter ist
select pg_temp.check((select min(starts_at) from events) between now() - interval '10 weeks' and now() - interval '6 weeks', 'Älteste Termine ca. 8 Wochen zurück');
select pg_temp.check((select max(starts_at) from events) between now() + interval '8 weeks' and now() + interval '12 weeks', 'Neueste Termine ca. 10 Wochen voraus');
select pg_temp.check((select count(*) from events where kind = 'training' and starts_at between now() and now() + interval '7 days') >= 5, 'Trainings in der kommenden Woche');
select pg_temp.check((select count(*) from events where kind = 'game' and game_status = 'scheduled' and starts_at > now()) >= 5, 'Anstehende Spiele');
-- Trainings bleiben auf ihrer Uhrzeit (Ortszeit), auch über die Zeitumstellung hinweg
select pg_temp.check((select bool_and(to_char(starts_at at time zone 'Europe/Berlin', 'HH24:MI') in ('16:00', '17:00', '17:30', '19:00', '19:30'))
  from events where kind = 'training'), 'Trainingszeiten in Ortszeit stabil');
-- Spielstände passen zum Live-Ticker
select pg_temp.check(not exists (
  select 1 from events e where e.game_status = 'finished' and (
    e.score_us <> (select count(*) from game_actions a where a.event_id = e.id and a.type = 'goal' and a.side = 'us') or
    e.score_them <> (select count(*) from game_actions a where a.event_id = e.id and a.type = 'goal' and a.side = 'them'))
), 'Spielstände konsistent');
select pg_temp.check(not exists (select 1 from events where game_status in ('live', 'halftime')), 'Keine hängenden Live-Spiele');
-- Benachrichtigungen verlinken auf existierende Termine
select pg_temp.check(not exists (
  select 1 from notifications where link like '/termine/%' and not exists (select 1 from events e where '/termine/' || e.id = link)
), 'Benachrichtigungs-Links gültig');
-- Trigger wieder aktiv
select pg_temp.check((select bool_and(tgenabled = 'O') from pg_trigger where tgname in ('events_notify', 'game_actions_score', 'access_requests_notify')), 'Trigger wieder eingeschaltet');

-- Erste Anmeldung von Lena: Konto wird verknüpft, sie sieht ihre Daten
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'lena@example.org');
select pg_temp.check((select user_id from members where email = 'lena@example.org') = '00000000-0000-0000-0000-0000000000aa', 'Lena wird verknüpft');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', false);
set role authenticated;
select pg_temp.check((select count(*) from member_directory) > 80, 'Lena sieht das Verzeichnis');
select pg_temp.check((select count(*) from notifications) >= 3, 'Lena hat Benachrichtigungen');
select pg_temp.check((select count(*) from rsvp_list) > 500, 'Rückmeldungen sichtbar');
select pg_temp.check((select count(*) from rsvp_list where reason is not null and member_id <> current_member_id()) = 0, 'Fremde Absagegründe verborgen');
select pg_temp.check(exists (select 1 from events e where e.kind = 'game' and e.starts_at > now()
  and current_member_id() = any (e.squad)), 'Lena ist für das Derby nominiert');
reset role;
