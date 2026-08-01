-- Parents must replace the teacher-provided initial password after first sign-in.
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create or replace function public.complete_initial_parent_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set must_change_password = false
  where id = auth.uid()
    and role = 'parent';
end;
$$;

revoke all on function public.complete_initial_parent_password() from public;
grant execute on function public.complete_initial_parent_password() to authenticated;
