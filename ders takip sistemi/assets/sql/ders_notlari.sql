-- ============================================================
-- Ders Çalışma Sistemi — "Çalışma Kayıtları" (ders_notlari) tablosu
-- Supabase SQL Editor → New query → yapıştır → Run
-- Her kullanıcı SADECE kendi satırlarını görebilir/değiştirebilir (RLS).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.ders_notlari (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  ders_adi        text not null,
  calisma_suresi  integer not null default 0 check (calisma_suresi >= 0),
  not_icerigi     text,
  created_at      timestamptz not null default now()
);

create index if not exists ders_notlari_user_id_idx on public.ders_notlari (user_id);
create index if not exists ders_notlari_created_at_idx on public.ders_notlari (created_at desc);

alter table public.ders_notlari enable row level security;

-- Kullanıcı yalnızca kendi satırlarını okuyabilir
create policy "ders_notlari_select_own"
  on public.ders_notlari for select
  using (auth.uid() = user_id);

-- Kullanıcı yalnızca kendi user_id'siyle satır ekleyebilir
create policy "ders_notlari_insert_own"
  on public.ders_notlari for insert
  with check (auth.uid() = user_id);

-- Kullanıcı yalnızca kendi satırını güncelleyebilir
create policy "ders_notlari_update_own"
  on public.ders_notlari for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Kullanıcı yalnızca kendi satırını silebilir
create policy "ders_notlari_delete_own"
  on public.ders_notlari for delete
  using (auth.uid() = user_id);
