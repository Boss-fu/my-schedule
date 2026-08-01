-- 周桓安｜2026 年 7 月家教費用明細（14 小時 × NT$1,000 = NT$14,000）
with inserted_student as (
  insert into public.students (name, default_rate)
  select '周桓安', 1000
  where not exists (select 1 from public.students where name = '周桓安')
  returning id
), student as (
  select id from inserted_student
  union all
  select id from public.students where name = '周桓安'
  limit 1
)
insert into public.lessons (student_id, lesson_date, start_time, end_time, hours, rate, status, topic, progress, homework)
select student.id, v.lesson_date, v.start_time, v.end_time, 2, 1000, 'attended', v.topic, v.progress, ''
from student
cross join (values
  (date '2026-07-03', time '19:00', time '21:00', '選修化學', ''),
  (date '2026-07-10', time '19:00', time '21:00', '選修化學', ''),
  (date '2026-07-13', time '10:00', time '12:00', '選修物理', ''),
  (date '2026-07-17', time '19:00', time '21:00', '選修化學', ''),
  (date '2026-07-19', time '10:00', time '12:00', '選修物理', '七月份物理課程較少；八月將更著重於物理複習。'),
  (date '2026-07-24', time '19:00', time '21:00', '選修化學', ''),
  (date '2026-07-31', time '19:00', time '21:00', '選修化學', '選修進度已接近完成，接下來將開始完整的學測複習。')
) as v(lesson_date, start_time, end_time, topic, progress)
where not exists (
  select 1 from public.lessons l
  where l.student_id = student.id and l.lesson_date = v.lesson_date and l.topic = v.topic
);
