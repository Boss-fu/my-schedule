update public.students
set grade = case name
  when '周桓安' then '高三'
  when '周禹安' then '國二'
  else grade
end
where name in ('周桓安', '周禹安');
