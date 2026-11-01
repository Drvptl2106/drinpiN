-- drinpiN database setup.
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run.
-- It's safe to run more than once.

-- One row per saved outfit. Pieces (top, shoes, …) are stored inside the row as a list.
create table if not exists public.outfits (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url         text not null check (char_length(url) between 1 and 2048),
  title       text not null default '' check (char_length(title) <= 300),
  note        text not null default '' check (char_length(note) <= 5000),
  status      text not null default 'wishlist' check (status in ('wishlist', 'owned', 'bought')),
  pieces      jsonb not null default '[]'::jsonb
              check (jsonb_typeof(pieces) = 'array' and jsonb_array_length(pieces) <= 40),
  budget      text not null default '' check (char_length(budget) <= 100),
  image       text check (image is null or char_length(image) <= 2048),
  created_at  timestamptz not null default now(),
  -- When the person last changed it (set by the app; used to keep the newest edit).
  updated_at  timestamptz not null default now(),
  -- Set instead of deleting the row, so other devices learn about the delete.
  deleted_at  timestamptz,
  -- When the server last stored a change (set by the database; used by devices to fetch "what's new").
  synced_at   timestamptz not null default now()
);

create index if not exists outfits_user_synced_idx on public.outfits (user_id, synced_at);

-- Keep the newest edit when two devices change the same outfit, and stamp synced_at.
create or replace function public.outfits_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- An older edit arriving late never overwrites a newer one.
    if new.updated_at < old.updated_at then
      return null; -- skip this update entirely
    end if;
    -- Nobody can move an outfit to another account, or change when it was created.
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;
  new.synced_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists outfits_before_write on public.outfits;
create trigger outfits_before_write
  before insert or update on public.outfits
  for each row execute function public.outfits_before_write();

-- Security: each signed-in person can only see and change their own outfits.
alter table public.outfits enable row level security;

drop policy if exists "Own outfits: read" on public.outfits;
create policy "Own outfits: read" on public.outfits
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Own outfits: add" on public.outfits;
create policy "Own outfits: add" on public.outfits
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Own outfits: change" on public.outfits;
create policy "Own outfits: change" on public.outfits
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Own outfits: remove" on public.outfits;
create policy "Own outfits: remove" on public.outfits
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Logged-out visitors get no access at all.
revoke all on public.outfits from anon;
grant select, insert, update, delete on public.outfits to authenticated;
