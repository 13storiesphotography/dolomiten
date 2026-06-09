-- Profile pro Supabase-Auth-User (Studio, Anzeigename)
-- Im SQL Editor ausführen, danach pro User eine Zeile anlegen (siehe unten).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  studio_name text,
  role text default 'admin',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Beispiel nach erstem Login (UUID aus Authentication → Users):
-- insert into public.profiles (id, display_name, studio_name, role)
-- values ('<auth-user-uuid>', 'Florian Knoll', '13 Stories Photography', 'admin')
-- on conflict (id) do update set
--   display_name = excluded.display_name,
--   studio_name = excluded.studio_name,
--   updated_at = now();
