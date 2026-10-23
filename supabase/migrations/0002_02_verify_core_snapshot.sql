-- ATIS staging core snapshot verification
-- Expected after 0002_00 + 0002_01:
-- staff 21, classes 10, subject catalogue 11, class-subjects 65, teacher assignments 8.

select
  (select count(*) from public.staff s join public.schools sc on sc.id=s.school_id where sc.code='ATIS') as staff_count,
  (select count(*) from public.classes c join public.schools sc on sc.id=c.school_id where sc.code='ATIS') as class_count,
  (select count(*) from public.subject_catalogue s join public.schools sc on sc.id=s.school_id where sc.code='ATIS') as subject_catalogue_count,
  (select count(*) from public.class_subjects cs join public.schools sc on sc.id=cs.school_id where sc.code='ATIS') as class_subject_count,
  (select count(*) from public.teacher_assignments ta join public.schools sc on sc.id=ta.school_id where sc.code='ATIS') as teacher_assignment_count;

select legacy_id, class_name, section
from public.classes
where school_id=(select id from public.schools where code='ATIS')
order by legacy_id;

select legacy_id, full_name, role, employee_code, email
from public.staff
where school_id=(select id from public.schools where code='ATIS')
order by legacy_id nulls first;

-- Source-quality checks intentionally reported, not silently rewritten.
select legacy_id, subject_id, class_id, pass_marks
from public.class_subjects
where school_id=(select id from public.schools where code='ATIS')
  and pass_marks=0
order by legacy_id;

select legacy_id, full_name, email
from public.staff
where school_id=(select id from public.schools where code='ATIS')
  and email is not null
  and email::text !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
order by legacy_id;

select c.legacy_id, c.class_name, c.section
from public.classes c
where c.school_id=(select id from public.schools where code='ATIS')
  and c.class_teacher_id is null
order by c.legacy_id;
