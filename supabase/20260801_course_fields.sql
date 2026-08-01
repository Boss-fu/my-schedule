alter table public.lessons add column if not exists quiz_scope text not null default '';
alter table public.lessons add column if not exists quiz_score text not null default '';
alter table public.lessons add column if not exists teacher_observation text not null default '';
alter table public.lessons add column if not exists next_exam text not null default '';
