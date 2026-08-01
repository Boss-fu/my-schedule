-- Teachers remove both the database record and the private Storage object.
drop policy if exists "teachers delete exam papers" on storage.objects;
create policy "teachers delete exam papers"
on storage.objects for delete to authenticated
using (bucket_id = 'exam-papers' and public.is_teacher());
