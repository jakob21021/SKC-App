-- Live-Updates (Live-Ticker, Termine, Benachrichtigungen) über Supabase Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.events, public.game_actions, public.notifications;
  end if;
end $$;
