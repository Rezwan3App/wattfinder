-- Additive migration for the live Supabase DB (schema was applied before
-- connection_type_id and the utilization check existed). Safe to re-run.
-- After this, re-seed: npm run seed

alter table public.station_connections
  add column if not exists connection_type_id int;

do $$
begin
  alter table public.stations
    add constraint stations_base_utilization_range
    check (base_utilization >= 0 and base_utilization <= 1);
exception
  when duplicate_object then null;
end $$;
