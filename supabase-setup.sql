-- Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','parent')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.parent_students (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (parent_id, student_id)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_date date not null,
  start_time time,
  end_time time,
  hours numeric not null default 0,
  rate numeric not null default 0,
  status text not null default 'attended' check (status in ('attended','leave','absent')),
  topic text not null default '',
  progress text not null default '',
  homework text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  title text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.parent_students enable row level security;
alter table public.lessons enable row level security;
alter table public.messages enable row level security;
alter table public.materials enable row level security;

create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;
create or replace function public.can_view_student(target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_teacher() or exists(select 1 from public.parent_students where parent_id = auth.uid() and student_id = target);
$$;

create policy "teachers manage profiles" on public.profiles for all using (public.is_teacher()) with check (public.is_teacher());
create policy "users view own profile" on public.profiles for select using (id = auth.uid());
create policy "teachers manage students" on public.students for all using (public.is_teacher()) with check (public.is_teacher());
create policy "parents view linked students" on public.students for select using (public.can_view_student(id));
create policy "teachers manage links" on public.parent_students for all using (public.is_teacher()) with check (public.is_teacher());
create policy "parents view own links" on public.parent_students for select using (parent_id = auth.uid());
create policy "teachers manage lessons" on public.lessons for all using (public.is_teacher()) with check (public.is_teacher());
create policy "parents view linked lessons" on public.lessons for select using (public.can_view_student(student_id));
create policy "teachers manage messages" on public.messages for all using (public.is_teacher()) with check (public.is_teacher());
create policy "parents view linked messages" on public.messages for select using (public.can_view_student(student_id));
create policy "parents add linked messages" on public.messages for insert with check (author_id = auth.uid() and public.can_view_student(student_id));
create policy "teachers manage materials" on public.materials for all using (public.is_teacher()) with check (public.is_teacher());
create policy "parents view linked materials" on public.materials for select using (student_id is null or public.can_view_student(student_id));

-- After your first magic-link sign-in, promote your account once:
-- insert into public.profiles (id, role, display_name) values ('YOUR_AUTH_USER_UUID', 'teacher', '老師')
-- on conflict (id) do update set role = excluded.role;
