-- 周禹安｜2026 年 7 月家教費用明細（8 小時 × NT$900 = NT$7,200）
with inserted_student as (
  insert into public.students (name, default_rate)
  select '周禹安', 900
  where not exists (select 1 from public.students where name = '周禹安')
  returning id
), student as (
  select id from inserted_student
  union all
  select id from public.students where name = '周禹安'
  limit 1
)
insert into public.lessons (student_id, lesson_date, start_time, end_time, hours, rate, status, topic, progress, homework)
select student.id, v.lesson_date, time '19:30', time '21:30', 2, 900, 'attended', v.topic, '', ''
from student
cross join (values
  (date '2026-07-19', '國二理化 0 進入實驗室與科學數學'),
  (date '2026-07-20', '國二理化 1-1～1-2 基本測量'),
  (date '2026-07-26', '國二理化 1-3 密度計算'),
  (date '2026-07-27', '國二理化 2-1 物質分類')
) as v(lesson_date, topic)
where not exists (
  select 1 from public.lessons l
  where l.student_id = student.id and l.lesson_date = v.lesson_date and l.topic = v.topic
);
