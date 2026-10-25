-- ATIS Web v0.4.0 — least-privilege teacher academic scope
begin;

create or replace function public.can_read_class(target_class_id uuid)
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

  if r in ('admin','supervisor','clerk') then
    return true;
  end if;

  if r = 'teacher' then
    stid := public.current_staff_id();
    return exists (
      select 1
      from public.teacher_assignments ta
      join public.class_subjects cs on cs.id=ta.class_subject_id
      where ta.teacher_id=stid and cs.class_id=target_class_id
    ) or exists (
      select 1
      from public.classes c
      where c.id=target_class_id
        and (c.class_teacher_id=stid or c.assistant_teacher_id=stid)
    );
  end if;

  if r = 'student' then
    sid := public.current_student_id();
    return exists (
      select 1 from public.students s
      where s.id=sid and s.class_id=target_class_id
    );
  end if;

  if r = 'parent' then
    gid := public.current_guardian_id();
    return exists (
      select 1
      from public.student_guardians sg
      join public.students s on s.id=sg.student_id
      where sg.guardian_id=gid and s.class_id=target_class_id
    );
  end if;

  return false;
end;
$$;

create or replace function public.can_read_subject(target_subject_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.app_role;
  stid uuid;
begin
  r := public.current_app_role();

  if r in ('admin','supervisor') then
    return true;
  end if;

  if r = 'teacher' then
    stid := public.current_staff_id();
    return exists (
      select 1
      from public.teacher_assignments ta
      join public.class_subjects cs on cs.id=ta.class_subject_id
      where ta.teacher_id=stid and cs.subject_id=target_subject_id
    );
  end if;

  return false;
end;
$$;

create or replace function public.can_read_class_subject(target_class_subject_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.app_role;
  stid uuid;
begin
  r := public.current_app_role();

  if r in ('admin','supervisor') then
    return true;
  end if;

  if r = 'teacher' then
    stid := public.current_staff_id();
    return exists (
      select 1
      from public.teacher_assignments ta
      where ta.teacher_id=stid and ta.class_subject_id=target_class_subject_id
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_read_class(uuid) from public;
revoke all on function public.can_read_subject(uuid) from public;
revoke all on function public.can_read_class_subject(uuid) from public;

grant execute on function public.can_read_class(uuid) to authenticated;
grant execute on function public.can_read_subject(uuid) to authenticated;
grant execute on function public.can_read_class_subject(uuid) to authenticated;

drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_read_class(id)
);

drop policy if exists subject_catalogue_read on public.subject_catalogue;
create policy subject_catalogue_read on public.subject_catalogue
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_read_subject(id)
);

drop policy if exists class_subjects_read on public.class_subjects;
create policy class_subjects_read on public.class_subjects
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_read_class_subject(id)
);

commit;
