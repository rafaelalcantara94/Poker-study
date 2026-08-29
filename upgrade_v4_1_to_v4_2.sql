-- POKER STUDY V4.2 - rode uma vez no Supabase SQL Editor.
-- Corrige a chave usada pelo importador para ignorar CSVs duplicados.
-- PostgreSQL permite vários NULLs em um índice UNIQUE, então registros manuais
-- sem fingerprint continuam permitidos.

drop index if exists public.tournaments_user_fingerprint_unique;

create unique index if not exists tournaments_user_fingerprint_unique
on public.tournaments(user_id, fingerprint);
