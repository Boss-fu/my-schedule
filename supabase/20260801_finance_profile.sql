-- Shared invoice header and payment instructions, visible to authenticated parents.
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "authenticated users can read site settings" on public.site_settings;
create policy "authenticated users can read site settings"
on public.site_settings for select to authenticated using (true);

drop policy if exists "teachers can manage site settings" on public.site_settings;
create policy "teachers can manage site settings"
on public.site_settings for all to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher'));
