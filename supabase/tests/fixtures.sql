-- Gemeinsame Testdaten für Datenbank- und Integrationstests
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'lena@test.de'),
  ('00000000-0000-0000-0000-00000000000b', 'tim@test.de'),
  ('00000000-0000-0000-0000-00000000000c', 'Sabine@Test.de'),
  ('00000000-0000-0000-0000-00000000000d', 'andrea@test.de'),
  ('00000000-0000-0000-0000-00000000000e', 'fremd@test.de'),
  ('00000000-0000-0000-0000-00000000000f', 'neu@test.de');

insert into public.members (id, first_name, last_name, gender, email, phone, roles) values
  ('10000000-0000-0000-0000-000000000001', 'Lena', 'Hoffmann', 'w', 'lena@test.de', '0170 111', '{player}'),
  ('10000000-0000-0000-0000-000000000002', 'Max', 'Muster', 'm', null, '0170 222', '{player}'),
  ('10000000-0000-0000-0000-000000000003', 'Tim', 'Schäfer', 'm', 'tim@test.de', null, '{coach}'),
  ('10000000-0000-0000-0000-000000000004', 'Sabine', 'Krüger', 'w', 'sabine@test.de', null, '{parent}'),
  ('10000000-0000-0000-0000-000000000005', 'Mia', 'Krüger', 'w', null, null, '{player}'),
  ('10000000-0000-0000-0000-000000000006', 'Andrea', 'Wolff', 'w', 'andrea@test.de', null, '{board,admin}');

create table public._t as select
  (select id from teams where short = '1. M') as t1,
  (select id from teams where short = 'D') as td,
  (select id from venues order by name limit 1) as venue;

insert into public.team_members select t1, '10000000-0000-0000-0000-000000000001' from _t;
insert into public.team_members select t1, '10000000-0000-0000-0000-000000000002' from _t;
insert into public.team_members select td, '10000000-0000-0000-0000-000000000005' from _t;
insert into public.team_coaches select t1, '10000000-0000-0000-0000-000000000003' from _t;
insert into public.guardians values ('10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000005');

insert into public.events (id, kind, title, team_ids, starts_at, ends_at, visibility, rsvp_deadline)
select '20000000-0000-0000-0000-000000000001'::uuid, 'training'::event_kind, 'Training 1. M', array[t1], now() + interval '2 days', now() + interval '2 days 2 hours', 'public'::visibility, now() + interval '1 day' from _t
union all select '20000000-0000-0000-0000-000000000002', 'training', 'Training D', array[td], now() + interval '3 days', now() + interval '3 days 1 hour', 'members', null from _t
union all select '20000000-0000-0000-0000-000000000003', 'training', 'Training mit Frist vorbei', array[t1], now() + interval '2 hours', now() + interval '4 hours', 'members', now() - interval '1 hour' from _t;

insert into public.events (id, kind, title, team_ids, starts_at, ends_at, visibility, opponent, home, competition, game_status, half_minutes)
select '20000000-0000-0000-0000-000000000004', 'game', 'SKC – Adler', array[t1], now() + interval '5 days', now() + interval '5 days 2 hours', 'members', 'KV Adler Rauxel', true, 'Bundesliga', 'scheduled', 30 from _t;

insert into public.helper_lists (id, title, day) values ('30000000-0000-0000-0000-000000000001', 'Heimspieltag', current_date + 5);
insert into public.helper_shifts (id, list_id, title, starts_at, ends_at, slots) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Kasse', now() + interval '5 days', now() + interval '5 days 2 hours', 1);

