alter table public.messages add column if not exists author_role text not null default 'parent' check (author_role in ('teacher','parent'));
update public.messages m set author_role = p.role from public.profiles p where p.id = m.author_id;

create table if not exists public.student_files (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
alter table public.student_files enable row level security;

insert into storage.buckets (id, name, public) values ('exam-papers','exam-papers',false) on conflict (id) do nothing;
