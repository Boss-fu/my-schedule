-- Data isolation for the parent portal.  A parent can only access students
-- explicitly linked by the teacher; teachers retain full management access.

create table if not exists public.parent_students (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create index if not exists parent_students_student_idx on public.parent_students(student_id);

create or replace function public.is_teacher()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher' and coalesce(is_active, true)
  );
$$;

create or replace function public.can_view_student(target_student_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_teacher()
    or exists (
      select 1 from public.parent_students
      where parent_id = auth.uid() and student_id = target_student_id
    );
$$;

alter table public.parent_students enable row level security;
alter table public.students enable row level security;
alter table public.lessons enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;
alter table public.student_files enable row level security;

drop policy if exists "teachers manage parent links" on public.parent_students;
create policy "teachers manage parent links"
on public.parent_students for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "parents view own links" on public.parent_students;
create policy "parents view own links"
on public.parent_students for select to authenticated
using (parent_id = auth.uid());

drop policy if exists "teachers manage students" on public.students;
create policy "teachers manage students"
on public.students for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "parents view linked students" on public.students;
create policy "parents view linked students"
on public.students for select to authenticated
using (public.can_view_student(id));

drop policy if exists "teachers manage lessons" on public.lessons;
create policy "teachers manage lessons"
on public.lessons for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "parents view linked lessons" on public.lessons;
create policy "parents view linked lessons"
on public.lessons for select to authenticated
using (public.can_view_student(student_id));

drop policy if exists "teachers manage messages" on public.messages;
create policy "teachers manage messages"
on public.messages for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "parents view linked messages" on public.messages;
create policy "parents view linked messages"
on public.messages for select to authenticated
using (public.can_view_student(student_id));

drop policy if exists "parents write linked messages" on public.messages;
create policy "parents write linked messages"
on public.messages for insert to authenticated
with check (
  author_id = auth.uid()
  and author_role = 'parent'
  and public.can_view_student(student_id)
);

drop policy if exists "teachers manage profiles" on public.profiles;
create policy "teachers manage profiles"
on public.profiles for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "users view own profile" on public.profiles;
create policy "users view own profile"
on public.profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "teachers manage student files" on public.student_files;
create policy "teachers manage student files"
on public.student_files for all to authenticated
using (public.is_teacher()) with check (public.is_teacher());

drop policy if exists "parents upload linked student files" on public.student_files;
create policy "parents upload linked student files"
on public.student_files for insert to authenticated
with check (uploader_id = auth.uid() and public.can_view_student(student_id));

drop policy if exists "parents view linked student files" on public.student_files;
create policy "parents view linked student files"
on public.student_files for select to authenticated
using (public.can_view_student(student_id));

insert into storage.buckets (id, name, public)
values ('exam-papers', 'exam-papers', false)
on conflict (id) do nothing;

drop policy if exists "parents upload linked exam papers" on storage.objects;
create policy "parents upload linked exam papers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'exam-papers'
  and public.can_view_student((storage.foldername(name))[1]::uuid)
);

drop policy if exists "users view linked exam papers" on storage.objects;
create policy "users view linked exam papers"
on storage.objects for select to authenticated
using (
  bucket_id = 'exam-papers'
  and public.can_view_student((storage.foldername(name))[1]::uuid)
);

drop policy if exists "teachers delete exam papers" on storage.objects;
create policy "teachers delete exam papers"
on storage.objects for delete to authenticated
using (bucket_id = 'exam-papers' and public.is_teacher());

revoke all on function public.is_teacher() from public;
revoke all on function public.can_view_student(uuid) from public;
grant execute on function public.is_teacher() to authenticated;
grant execute on function public.can_view_student(uuid) to authenticated;
