-- WattFinder database schema (canonical record of what's live on Supabase).
-- Apply order: run this once on a fresh Postgres, then seed with scripts/seed.ts.
-- Occupancy is not a time-series table: each station carries a baseline busyness
-- and the "busy right now" value is computed from that + current time at query time.
-- The stable per-station seed for that randomness is the station's ocm_id.

create table public.stations (
  id bigint generated always as identity primary key,
  ocm_id bigint unique not null,              -- OpenChargeMap POI ID (dedupe + occupancy seed)
  name text not null,
  town text,
  latitude double precision not null,
  longitude double precision not null,
  num_points int,                             -- OCM NumberOfPoints
  data_quality int,                           -- OCM DataQualityLevel 1-5
  base_utilization real not null default 0.4
    check (base_utilization >= 0 and base_utilization <= 1),
  created_at timestamptz not null default now()
);

create table public.station_connections (
  id bigint generated always as identity primary key,
  station_id bigint not null references public.stations(id) on delete cascade,
  connector_type text not null,               -- CCS / CHAdeMO / Tesla / Type2 / NACS / ...
  connection_type_id int,                     -- raw OpenChargeMap ConnectionTypeID
  power_kw real,                              -- nullable in OCM
  current_type text,                          -- DC / AC
  quantity int not null default 1
);

create index station_connections_station_id_idx on public.station_connections (station_id);
create index stations_lat_lng_idx on public.stations (latitude, longitude);

-- Read-only public access: anyone can SELECT, nobody writes via the public key.
-- Seeding uses the direct DATABASE_URL connection, which bypasses RLS.
alter table public.stations enable row level security;
alter table public.station_connections enable row level security;

create policy "public read stations" on public.stations
  for select using (true);
create policy "public read connections" on public.station_connections
  for select using (true);
