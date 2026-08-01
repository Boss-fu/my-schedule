-- 周桓安｜更正姓名、上課時間與 2026 年 7 月教學紀錄。
with student as (
  update public.students
  set name = '周桓安'
  where name = '桓安'
  returning id
), target as (
  select id from student
  union all
  select id from public.students where name = '周桓安'
  limit 1
)
update public.lessons l
set
  start_time = case l.topic
    when '選修物理' then time '10:00'
    when '選修化學' then time '19:00'
  end,
  end_time = case l.topic
    when '選修物理' then time '12:00'
    when '選修化學' then time '21:00'
  end,
  progress = case
    when l.topic = '選修化學' and l.lesson_date = date '2026-07-31' then
      '化學進度：1-2 反應平衡表示式；1-3 影響反應平衡的因素；1-4 難溶鹽類的平衡；1-4 銅離子效應＋選擇性沉澱。'
    when l.topic = '選修物理' and l.lesson_date = date '2026-07-19' then
      '物理進度：1-3 駐波；1-4 波的疊加＋惠更斯原理＋干涉。八月將更著重於物理複習。'
    else l.progress
  end
where l.student_id = (select id from target)
  and l.topic in ('選修物理', '選修化學');

insert into public.messages (student_id, author_id, body)
select s.id, p.id, $message$
@Jeff @Michelle 桓安、禹安媽咪

桓安爸爸媽媽好：

以下是桓安 7 月份家教費用明細。
化學（五）：7/3、7/10、7/17、7/24、7/31，每次 2 小時。
物理（日）：7/13、7/19，每次 2 小時。
合計 NT$14,000。

化學進度：1-2 反應平衡表示式、1-3 影響反應平衡的因素、1-4 難溶鹽類的平衡、1-4 銅離子效應＋選擇性沉澱。
物理進度：1-3 駐波、1-4 波的疊加＋惠更斯原理＋干涉。
$message$
from public.students s
cross join public.profiles p
where s.name = '周桓安' and p.role = 'teacher'
  and not exists (
    select 1 from public.messages m
    where m.student_id = s.id and m.body like '%@Jeff @Michelle 桓安、禹安媽咪%'
  );
