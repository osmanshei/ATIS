begin;

-- -----------------------------
-- Security helper functions
-- SECURITY DEFINER avoids recursive RLS lookups on profiles/staff.
-- -----------------------------
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id from public.profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.staff s where s.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.students s where s.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_guardian_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select g.id from public.guardians g where g.user_id = auth.uid() limit 1;
$$;

create or replace function public.is_management()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin','supervisor'), false);
$$;

create or replace function public.can_read_student(target_student_id uuid, target_class_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.app_role;
  sid uuid;
  gid uuid;
  stid uuid;
begin
  r := public.current_app_role();

  if r in ('admin','supervisor','clerk','accountant') then
    return true;
  end if;

  if r = 'student' then
    sid := public.current_student_id();
    return sid = target_student_id;
  end if;

  if r = 'parent' then
    gid := public.current_guardian_id();
    return exists (
      select 1 from public.student_guardians sg
      where sg.guardian_id = gid and sg.student_id = target_student_id
    );
  end if;

  if r = 'teacher' then
    stid := public.current_staff_id();
    return exists (
      select 1
      from public.teacher_assignments ta
      join public.class_subjects cs on cs.id = ta.class_subject_id
      where ta.teacher_id = stid and cs.class_id = target_class_id
    ) or exists (
      select 1 from public.classes c
      where c.id = target_class_id
        and (c.class_teacher_id = stid or c.assistant_teacher_id = stid)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.current_school_id() from public;
revoke all on function public.current_app_role() from public;
revoke all on function public.current_staff_id() from public;
revoke all on function public.current_student_id() from public;
revoke all on function public.current_guardian_id() from public;
revoke all on function public.is_management() from public;
revoke all on function public.can_read_student(uuid, uuid) from public;

grant execute on function public.current_school_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_guardian_id() to authenticated;
grant execute on function public.is_management() to authenticated;
grant execute on function public.can_read_student(uuid, uuid) to authenticated;

-- -----------------------------
-- Views (security invoker => underlying RLS still applies)
-- -----------------------------
create or replace view public.class_summary
with (security_invoker = true)
as
select
  c.id,
  c.school_id,
  c.academic_year_id,
  c.class_name,
  c.section,
  c.grade_level,
  c.class_code,
  c.max_capacity,
  c.room_number,
  c.is_active,
  count(s.id) filter (where s.status = 'active')::integer as total_strength
from public.classes c
left join public.students s on s.class_id = c.id
  and s.school_id = c.school_id
group by c.id;

create or replace view public.class_subject_summary
with (security_invoker = true)
as
select
  cs.id,
  cs.school_id,
  cs.class_id,
  c.class_name,
  c.section,
  cs.subject_id,
  sc.subject_name,
  sc.subject_code,
  cs.max_marks,
  cs.pass_marks,
  cs.is_optional,
  cs.is_active
from public.class_subjects cs
join public.classes c on c.id = cs.class_id
join public.subject_catalogue sc on sc.id = cs.subject_id;

create or replace view public.teacher_assignment_summary
with (security_invoker = true)
as
select
  ta.id,
  ta.school_id,
  ta.teacher_id,
  st.full_name as teacher_name,
  st.employee_code,
  ta.class_subject_id,
  css.class_id,
  css.class_name,
  css.section,
  css.subject_id,
  css.subject_name,
  css.subject_code,
  ta.academic_year_id,
  ta.is_class_teacher,
  ta.periods_per_week
from public.teacher_assignments ta
join public.staff st on st.id = ta.teacher_id
join public.class_subject_summary css on css.id = ta.class_subject_id;

commit;
