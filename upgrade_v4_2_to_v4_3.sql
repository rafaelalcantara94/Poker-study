-- POKER STUDY V4.3 - rode uma vez no Supabase SQL Editor.
-- Guarda valores originais do SharkScope e a taxa usada para converter moedas para USD.
alter table public.tournaments add column if not exists native_buyin numeric(14,2);
alter table public.tournaments add column if not exists native_prize numeric(14,2);
alter table public.tournaments add column if not exists native_profit numeric(14,2);
alter table public.tournaments add column if not exists fx_rate numeric(14,6) default 1;
