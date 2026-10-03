-- =====================================================================
-- Tests für Rechte (RLS), maskierte Sichten und RPC-Funktionen.
-- Jeder fehlgeschlagene Test bricht mit "TEST FEHLGESCHLAGEN" ab.
-- =====================================================================
\set QUIET on
set client_min_messages = warning;

create function public._assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'TEST FEHLGESCHLAGEN: %', msg; end if;
end $$;

create function public._fails(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return;
  end;
  raise exception 'TEST FEHLGESCHLAGEN (hätte scheitern müssen): %', msg;
end $$;

\ir fixtures.sql

delete from public.notifications;

select _assert((select user_id from members where first_name = 'Lena') = '00000000-0000-0000-0000-00000000000a', 'Login-Konto wird per E-Mail verknüpft');
select _assert((select user_id from members where first_name = 'Sabine') = '00000000-0000-0000-0000-00000000000c', 'Verknüpfung ignoriert Groß-/Kleinschreibung');

-- ---------------------------------------------------------------- Gast (nicht angemeldet)
set role anon;
select _assert((select count(*) from events) = 1, 'Gäste sehen nur öffentliche Termine');
select _assert((select count(*) from member_directory) = 0, 'Gäste sehen keine Mitglieder');
select _assert((select count(*) from rsvp_list) = 0, 'Gäste sehen keine Rückmeldungen');
select _assert((select count(*) from teams) = 7, 'Gäste sehen Teams');
select _fails($$ select count(*) from members $$, 'Gäste lesen keine Mitgliedertabelle');
select _fails($$ select set_rsvp('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'yes') $$, 'Gäste können nicht zusagen');
select _fails($$ insert into events (kind, title, starts_at, ends_at) values ('club', 'Hack', now(), now()) $$, 'Gäste legen keine Termine an');
insert into access_requests (name, email, kind, gender, team_id) select 'Neu Ling', 'neu@test.de', 'player', 'm', t1 from _t;
select _fails($$ insert into access_requests (name, email, kind, status) values ('X Y', 'x@test.de', 'fan', 'approved') $$, 'Anfragen sind immer offen');
select _assert((select count(*) from access_requests) = 0, 'Gäste lesen keine Anfragen');
reset role;

-- ---------------------------------------------------------------- Fremdes Login ohne Mitgliedschaft
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
set role authenticated;
select _assert((select count(*) from events) = 1, 'Login ohne Freischaltung sieht nur Öffentliches');
select _assert((select count(*) from member_directory) = 0, 'Login ohne Freischaltung sieht keine Mitglieder');
reset role;

-- ---------------------------------------------------------------- Spielerin Lena
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select _assert((select count(*) from events) = 4, 'Mitglieder sehen alle Termine');
select _assert((select count(*) from member_directory) = 6, 'Mitglieder sehen das Verzeichnis');
select _assert((select phone from member_directory where first_name = 'Lena') = '0170 111', 'Eigene Telefonnummer sichtbar');
select _assert((select phone from member_directory where first_name = 'Max') is null, 'Fremde Telefonnummer verborgen');
select _assert((select team_ids from member_directory where first_name = 'Lena') = (select array[t1] from _t), 'Team-Zugehörigkeit im Verzeichnis');
select _assert((select parent_of from member_directory where first_name = 'Sabine') = '{10000000-0000-0000-0000-000000000005}', 'Eltern-Kind-Beziehung im Verzeichnis');

select set_rsvp('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'yes');
select set_rsvp('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'no', 'krank', 'Grippe');
select _assert((select status from rsvp_list where member_id = '10000000-0000-0000-0000-000000000001') = 'no', 'Absage überschreibt Zusage');
select _assert((select reason from rsvp_list where member_id = '10000000-0000-0000-0000-000000000001') = 'krank', 'Eigener Absagegrund sichtbar');
select _fails($$ select set_rsvp('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'yes') $$, 'Nicht für andere antworten');
select _fails($$ select set_rsvp('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'yes') $$, 'Nur für eigene Teamtermine');
select _fails($$ select set_rsvp('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'yes') $$, 'Rückmeldefrist wird geprüft');
select _fails($$ insert into events (kind, title, team_ids, starts_at, ends_at) select 'training', 'X', array[t1], now(), now() from _t $$, 'Spielerin legt keine Termine an');
select _fails($$ insert into game_actions (event_id, period, minute, side, type) values ('20000000-0000-0000-0000-000000000004', 1, 1, 'us', 'goal') $$, 'Spielerin erfasst keinen Live-Ticker');
update events set title = 'Gehackt' where id = '20000000-0000-0000-0000-000000000001';
select _assert((select title from events where id = '20000000-0000-0000-0000-000000000001') = 'Training 1. M', 'Spielerin ändert keine Termine');
select _fails($$ select update_my_contact('10000000-0000-0000-0000-000000000002', '123') $$, 'Keine fremden Kontaktdaten ändern');
select update_my_contact('10000000-0000-0000-0000-000000000001', '0170 999');
insert into absences (member_id, from_day, to_day, reason, note) values ('10000000-0000-0000-0000-000000000001', current_date + 10, current_date + 20, 'urlaub', 'Mallorca');
select _fails($$ insert into absences (member_id, from_day, to_day, reason) values ('10000000-0000-0000-0000-000000000002', current_date, current_date, 'krank') $$, 'Keine Abwesenheit für andere');
select signup_shift('31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
select save_push_subscription('https://push.example/lena', 'p256', 'auth', '{"news": false}');
select save_push_subscription('https://push.example/lena', 'p256-neu', 'auth', '{"news": true}');
select _assert((select count(*) from push_subscriptions) = 1, 'Push-Abo wird pro Gerät aktualisiert statt doppelt angelegt');
select toggle_reaction(id, '🔥') from news limit 1;
reset role;

-- ---------------------------------------------------------------- Trainer Tim
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select _assert((select reason from rsvp_list where member_id = '10000000-0000-0000-0000-000000000001') = 'krank', 'Trainer sieht Absagegründe seines Teams');
select _assert((select reason from absence_list where member_id = '10000000-0000-0000-0000-000000000001') = 'urlaub', 'Trainer sieht Abwesenheitsgrund');
select _assert((select phone from member_directory where first_name = 'Max') = '0170 222', 'Trainer sieht Telefonnummern seines Teams');
select _assert((select phone from member_directory where first_name = 'Lena') = '0170 999', 'Kontaktdaten wurden aktualisiert');
select _assert((select phone from member_directory where first_name = 'Andrea') is null, 'Trainer sieht keine teamfremden Telefonnummern');
select _assert((select count(*) from push_subscriptions) = 0, 'Fremde Push-Abos unsichtbar');
insert into events (kind, title, team_ids, starts_at, ends_at) select 'training', 'Zusatztraining', array[t1], now() + interval '6 days', now() + interval '6 days 2 hours' from _t;
select _fails($$ insert into events (kind, title, team_ids, starts_at, ends_at) select 'training', 'X', array[td], now(), now() from _t $$, 'Trainer nur für eigene Teams');
select _fails($$ insert into events (kind, title, team_ids, starts_at, ends_at) values ('club', 'Vereinsfest', '{}', now(), now()) $$, 'Vereinstermine nur durch Vorstand');
select set_rsvp('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'yes');
select set_squad('20000000-0000-0000-0000-000000000004', '{10000000-0000-0000-0000-000000000001}');
select _assert(remind_open('20000000-0000-0000-0000-000000000001', '{10000000-0000-0000-0000-000000000002}') = 1, 'Erinnerung verschickt');
select set_game_status('20000000-0000-0000-0000-000000000004', 'live', 1);
insert into game_actions (event_id, period, minute, side, type, shot, member_id) values
  ('20000000-0000-0000-0000-000000000004', 1, 3, 'us', 'goal', 'distance', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000004', 1, 4, 'them', 'goal', null, null),
  ('20000000-0000-0000-0000-000000000004', 1, 5, 'us', 'goal', 'penalty', '10000000-0000-0000-0000-000000000001');
select _assert((select (score_us, score_them) = (2, 1) from events where id = '20000000-0000-0000-0000-000000000004'), 'Spielstand wird automatisch berechnet');
delete from game_actions where minute = 5;
select _assert((select score_us from events where id = '20000000-0000-0000-0000-000000000004') = 1, 'Rückgängig korrigiert Spielstand');
select _assert((select created_by from game_actions limit 1) = '10000000-0000-0000-0000-000000000003', 'Erfassende Person wird protokolliert');
select cancel_event('20000000-0000-0000-0000-000000000001', 'Halle gesperrt');
reset role;

-- ---------------------------------------------------------------- Elternteil Sabine
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select set_rsvp('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'no', 'schule');
select _assert((select updated_by from rsvp_list where member_id = '10000000-0000-0000-0000-000000000005') = '10000000-0000-0000-0000-000000000004', 'Antwort der Eltern wird protokolliert');
select _assert((select reason from rsvp_list where member_id = '10000000-0000-0000-0000-000000000005') = 'schule', 'Eltern sehen Gründe ihrer Kinder');
select _assert((select reason from rsvp_list where member_id = '10000000-0000-0000-0000-000000000001') is null, 'Eltern sehen keine fremden Absagegründe');
select _assert((select reason from absence_list where member_id = '10000000-0000-0000-0000-000000000001') is null, 'Fremde Abwesenheitsgründe verborgen');
select _fails($$ select set_rsvp('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'yes') $$, 'Eltern antworten nicht für fremde Kinder');
insert into absences (member_id, from_day, to_day, reason) values ('10000000-0000-0000-0000-000000000005', current_date + 1, current_date + 2, 'krank');
select _fails($$ select signup_shift('31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004') $$, 'Volle Schicht wird abgelehnt');
select _assert((select count(*) from notifications) = 0, 'Noch keine Benachrichtigungen für Sabine');
reset role;

-- ---------------------------------------------------------------- Vorstand Andrea
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
insert into events (kind, title, team_ids, starts_at, ends_at) select 'training', 'Sondertraining D', array[td], now() + interval '8 days', now() + interval '8 days 1 hour' from _t;
select _assert((select count(*) from access_requests where status = 'open') = 1, 'Vorstand sieht Anfragen');
select _assert(resolve_access_request(id, true) is not null, 'Anfrage freigeschaltet') from access_requests where email = 'neu@test.de';
select _assert((select user_id from members where email = 'neu@test.de') = '00000000-0000-0000-0000-00000000000f', 'Bestehendes Login wird beim Freischalten verknüpft');
select create_post('Weihnachtsfeier', 'Abstimmen!', 'Verein', null, true, 'public', 'Wohin?', '{Bowling,Essen}', false);
reset role;

-- ---------------------------------------------------------------- Benachrichtigungen & Umfragen
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select _assert((select count(*) from notifications where title = 'Neuer Termin' and body = 'Sondertraining D') = 1, 'Eltern werden über Termine ihrer Kinder informiert');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select _assert((select count(*) from notifications where title like 'Abgesagt:%') = 1, 'Absage wird gemeldet');
select _assert((select count(*) from notifications where title like 'Du bist nominiert%') = 1, 'Nominierung wird gemeldet');
select _assert((select count(*) from notifications where title like '%Anpfiff%') = 1, 'Anpfiff wird gemeldet');
select _assert((select count(*) from notifications where title = 'Neue Umfrage') = 1, 'Neue Umfrage wird gemeldet');
select _assert((select count(*) from notifications where member_id <> '10000000-0000-0000-0000-000000000001') = 0, 'Nur eigene Benachrichtigungen sichtbar');
select vote(p.id, array[(select id from poll_options where poll_id = p.id and label = 'Essen')]) from polls p;
select _fails($$ select vote(p.id, array(select id from poll_options where poll_id = p.id)) from polls p $$, 'Einfachauswahl wird erzwungen');
select _assert((select count(*) from poll_votes) = 1, 'Stimme gezählt');
update notifications set read = true;
select _assert((select bool_and(read) from notifications), 'Gelesen markieren');
select _fails($$ update notifications set title = 'x' $$, 'Benachrichtigungstext nicht änderbar');
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
select _assert((select count(*) from notifications where title = 'Rückmeldung fehlt') = 0, 'Trainer erinnert sich nicht selbst');
reset role;
select _assert((select count(*) from notifications n join members m on m.id = n.member_id where m.first_name = 'Max' and n.title = 'Rückmeldung fehlt') = 1, 'Erinnerung kommt bei Max an');

drop table public._t;
drop function public._assert(boolean, text);
drop function public._fails(text, text);
