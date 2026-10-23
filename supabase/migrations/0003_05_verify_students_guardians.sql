-- Verify ATIS student/guardian migration.
select
  (select count(*) from public.students s join public.schools sc on sc.id=s.school_id where sc.code='ATIS') as student_count,
  (select count(*) from public.guardians g join public.schools sc on sc.id=g.school_id where sc.code='ATIS') as guardian_count,
  (select count(*) from public.student_guardians sg join public.schools sc on sc.id=sg.school_id where sc.code='ATIS') as student_guardian_link_count;

-- Expected: 468 students, 414 guardians, 468 links.

select c.legacy_id,c.class_name,c.section,count(s.id) as active_students
from public.classes c
left join public.students s on s.class_id=c.id and s.status='active'
where c.school_id=(select id from public.schools where code='ATIS')
group by c.id,c.legacy_id,c.class_name,c.section
order by c.legacy_id;

select admission_number,count(*) as n
from public.students
where school_id=(select id from public.schools where code='ATIS')
group by admission_number
having count(*)>1;

select s.legacy_id,s.admission_number,s.first_name,s.last_name
from public.students s
left join public.student_guardians sg on sg.student_id=s.id
where s.school_id=(select id from public.schools where code='ATIS')
group by s.id
having count(sg.id)=0
order by s.legacy_id;

select count(*) as imported_invalid_import_rows
from public.students
where school_id=(select id from public.schools where code='ATIS')
  and legacy_payload->>'source_status'='invalid_import';
