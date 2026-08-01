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
create policy "teachers manage student files" on public.student_files for all using (public.is_teacher()) with check (public.is_teacher());
create policy "parents upload linked student files" on public.student_files for insert with check (uploader_id = auth.uid() and public.can_view_student(student_id));
create policy "parents view linked student files" on public.student_files for select using (public.can_view_student(student_id));

insert into storage.buckets (id, name, public) values ('exam-papers','exam-papers',false) on conflict (id) do nothing;
create policy "parents upload linked exam papers" on storage.objects for insert to authenticated with check (bucket_id = 'exam-papers' and public.can_view_student((storage.foldername(name))[1]::uuid));
create policy "users view linked exam papers" on storage.objects for select to authenticated using (bucket_id = 'exam-papers' and public.can_view_student((storage.foldername(name))[1]::uuid));
