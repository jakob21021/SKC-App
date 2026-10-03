-- Startdaten für einen neuen Supabase-Projektstand.
-- Bitte vor dem Livegang an die echten Teams, Ligen und Hallen anpassen.

insert into public.teams (name, short, age_group, league, sort_order, training_default) values
  ('1. Mannschaft', '1. M', 'Senioren', 'Korfball-Bundesliga', 1, 'open'),
  ('2. Mannschaft', '2. M', 'Senioren', 'Verbandsliga', 2, 'open'),
  ('A-Jugend', 'A', 'A-Jugend', 'A-Jugend-Liga (U19)', 3, 'open'),
  ('C-Jugend', 'C', 'C-Jugend', 'C-Jugend-Liga (U15)', 4, 'open'),
  ('D-Jugend', 'D', 'D-Jugend', 'D-Jugend-Liga (U13)', 5, 'open'),
  ('F-Jugend (Minis)', 'F', 'F-Jugend', null, 6, 'yes'),
  ('Hobby', 'Hobby', 'Hobby', null, 7, 'yes');

insert into public.venues (name, street, city, maps_query, notes) values
  ('Sporthalle Bodelschwingher Straße', 'Bodelschwingher Str. 35', '44577 Castrop-Rauxel', 'Bodelschwingher Str. 35, 44577 Castrop-Rauxel', null),
  ('ASG-Halle', null, 'Castrop-Rauxel', 'Adalbert-Stifter-Gymnasium Castrop-Rauxel', null),
  ('Vereinsheim', 'Bodelschwingher Str. 35', '44577 Castrop-Rauxel', 'Bodelschwingher Str. 35, 44577 Castrop-Rauxel', null);

insert into public.specials (title, description, partner, category, url, highlight, sort) values
  ('SKC-Teamwear & Fanartikel', 'Trikots, Hoodies, Taschen und Tassen im Vereinsdesign – mit Namen und Nummer.', 'Vereinsshop', 'Fanshop',
   'https://www.trikot.com/artikel/schweriner-kc-trikot/', true, 1),
  ('Mitglied wirbt Mitglied', 'Bring eine Freundin oder einen Freund zum Probetraining mit!', 'Schweriner KC', 'Verein', null, false, 2);
