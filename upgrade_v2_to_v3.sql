
-- POKER STUDY V3 - rode no Supabase SQL Editor.
-- Atualiza a V2 sem apagar os dados existentes.

alter table public.studies add column if not exists course text default '';
alter table public.studies add column if not exists tags text default '';

alter table public.hands add column if not exists site text default '';
alter table public.hands add column if not exists format text default '';
alter table public.hands add column if not exists blinds text default '';
alter table public.hands add column if not exists effective_stack text default '';
alter table public.hands add column if not exists hero_position text default '';
alter table public.hands add column if not exists villain_position text default '';
alter table public.hands add column if not exists preflop text default '';
alter table public.hands add column if not exists flop text default '';
alter table public.hands add column if not exists turn text default '';
alter table public.hands add column if not exists river text default '';
alter table public.hands add column if not exists tags text default '';
alter table public.hands add column if not exists image_path text;

alter table public.results add column if not exists site text default '';
alter table public.results add column if not exists format text default '';

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  metric text default '',
  target_value numeric(14,2) default 0,
  current_value numeric(14,2) default 0,
  unit text default '',
  date date default current_date,
  created_at timestamptz default now()
);
alter table public.goals enable row level security;
drop policy if exists "Users can manage own goals" on public.goals;
create policy "Users can manage own goals" on public.goals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id,name,public)
values ('hand-images','hand-images',false)
on conflict (id) do update set public=false;

drop policy if exists "Users can view own hand images" on storage.objects;
create policy "Users can view own hand images" on storage.objects
for select to authenticated
using (bucket_id='hand-images' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Users can upload own hand images" on storage.objects;
create policy "Users can upload own hand images" on storage.objects
for insert to authenticated
with check (bucket_id='hand-images' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "Users can delete own hand images" on storage.objects;
create policy "Users can delete own hand images" on storage.objects
for delete to authenticated
using (bucket_id='hand-images' and (storage.foldername(name))[1]=auth.uid()::text);
