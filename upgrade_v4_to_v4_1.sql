-- POKER STUDY V4.1 - rode uma vez no Supabase SQL Editor.
-- Adiciona metadados do CSV SharkScope sem apagar dados existentes.
alter table public.tournaments add column if not exists external_id text;
alter table public.tournaments add column if not exists rake numeric(12,2) default 0;
alter table public.tournaments add column if not exists reentries integer default 0;
alter table public.tournaments add column if not exists duration_seconds integer;
alter table public.tournaments add column if not exists currency text default '';
alter table public.tournaments add column if not exists flags text default '';
create index if not exists tournaments_user_external_id_idx on public.tournaments(user_id, external_id);
