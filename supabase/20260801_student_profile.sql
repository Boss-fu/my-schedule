alter table public.students add column if not exists subjects text not null default '';
alter table public.students add column if not exists parent_name text not null default '';
alter table public.students add column if not exists parent_contact text not null default '';
