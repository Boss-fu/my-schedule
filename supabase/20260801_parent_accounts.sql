-- Parent account management for the teacher portal.
alter table public.profiles add column if not exists phone text unique;
alter table public.profiles add column if not exists is_active boolean not null default true;

create index if not exists profiles_parent_phone_idx on public.profiles(phone) where role = 'parent';
