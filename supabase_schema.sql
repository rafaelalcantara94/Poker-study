-- Rode este SQL no SQL Editor do seu projeto Supabase.
create table if not exists public.studies (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null, teacher text default '', date date not null default current_date,
 duration integer not null default 0, topic text not null default 'Geral',
 status text not null default 'pending' check (status in ('pending','done')), notes text default '',
 created_at timestamptz not null default now()
);
create table if not exists public.hands (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null default current_date, tournament text default '', spot text default '',
 topic text not null default 'Geral', question text not null, status text not null default 'pending'
 check (status in ('pending','done')), notes text default '', created_at timestamptz not null default now()
);
create table if not exists public.results (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null default current_date, tournaments integer not null default 0,
 abi numeric(10,2) not null default 0, buyins numeric(12,2) not null default 0,
 prizes numeric(12,2) not null default 0, profit numeric(12,2) not null default 0,
 itm integer not null default 0, ft integer not null default 0, wins integer not null default 0,
 hours numeric(8,2) not null default 0, created_at timestamptz not null default now()
);
alter table public.studies enable row level security;
alter table public.hands enable row level security;
alter table public.results enable row level security;
create policy "users own studies" on public.studies for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own hands" on public.hands for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users own results" on public.results for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
