-- POKER STUDY V4 - rode no Supabase SQL Editor.
-- Atualiza a V3.1 sem apagar os dados existentes.

-- Campos extras para revisão de mãos
alter table public.hands add column if not exists confidence integer default 0;
alter table public.hands add column if not exists priority text default 'normal';
alter table public.hands add column if not exists reviewed_at timestamptz;
alter table public.hands add column if not exists favorite boolean default false;

-- Torneios individuais importados (ex.: CSV do SharkScope)
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at timestamptz not null,
  site text default '',
  tournament_name text default '',
  format text default '',
  buyin numeric(12,2) default 0,
  prize numeric(12,2) default 0,
  profit numeric(12,2) generated always as (prize - buyin) stored,
  finish_position integer,
  entrants integer,
  source text default 'csv',
  fingerprint text,
  created_at timestamptz default now()
);

alter table public.tournaments enable row level security;
drop policy if exists "Users can manage own tournaments" on public.tournaments;
create policy "Users can manage own tournaments" on public.tournaments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create unique index if not exists tournaments_user_fingerprint_unique
on public.tournaments(user_id, fingerprint)
where fingerprint is not null;
