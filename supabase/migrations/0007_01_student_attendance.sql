-- ATIS Web v0.5.0 — Student attendance
-- Normalized class/date sessions + one row per student.

begin;

do $$ begin
  create type public.attendance_status as enum (
    'present', 'absent', 'late', 'excused', 'sick'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid references public.terms(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  attendance_date date not null,
  mode text not null default 'daily' check (mode in ('daily','subject','period')),
  subject_id uuid references public.subject_catalogue(id) on delete set null,
  period_number integer check (period_number is null or period_number > 0),
  notes text,
  marked_by uuid references auth.users(id) on delete set null,
  is_locked boolean not null default false,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, class_id, attendance_date, mode)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null,
  remark text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists attendance_sessions_class_date_idx
  on public.attendance_sessions (class_id, attendance_date desc);

create index if not exists attendance_sessions_school_date_idx
  on public.attendance_sessions (school_id, attendance_date desc);

create index if not exists attendance_records_student_idx
  on public.attendance_records (student_id, session_id);

drop trigger if exists set_attendance_sessions_updated_at on public.attendance_sessions;
create trigger set_attendance_sessions_updated_at
before update on public.attendance_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_attendance_records_updated_at on public.attendance_records;
create trigger set_attendance_records_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

create or replace function public.can_manage_attendance_class(target_class_id uuid)
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
      where ta.teacher_id=stid
        and cs.class_id=target_class_id
    ) or exists (
      select 1
      from public.classes c
      where c.id=target_class_id
        and (c.class_teacher_id=stid or c.assistant_teacher_id=stid)
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_manage_attendance_class(uuid) from public;
grant execute on function public.can_manage_attendance_class(uuid) to authenticated;

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

revoke all on table public.attendance_sessions, public.attendance_records from anon, authenticated;
grant select on table public.attendance_sessions, public.attendance_records to authenticated;

create policy attendance_sessions_read on public.attendance_sessions
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_manage_attendance_class(class_id)
);

create policy attendance_records_read on public.attendance_records
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and exists (
    select 1
    from public.attendance_sessions s
    where s.id=session_id
      and public.can_manage_attendance_class(s.class_id)
  )
);

create or replace view public.attendance_session_summary
with (security_invoker = true)
as
select
  s.id,
  s.school_id,
  s.academic_year_id,
  s.term_id,
  s.class_id,
  c.class_name,
  c.section,
  s.attendance_date,
  s.mode,
  s.notes,
  s.marked_by,
  s.is_locked,
  s.locked_at,
  count(r.id)::integer as total_count,
  count(r.id) filter (where r.status='present')::integer as present_count,
  count(r.id) filter (where r.status='late')::integer as late_count,
  count(r.id) filter (where r.status='absent')::integer as absent_count,
  count(r.id) filter (where r.status='excused')::integer as excused_count,
  count(r.id) filter (where r.status='sick')::integer as sick_count,
  case
    when count(r.id)=0 then 0
    else round(
      100.0 * (
        count(r.id) filter (where r.status in ('present','late'))
      ) / count(r.id),
      1
    )
  end as attendance_percentage,
  s.created_at,
  s.updated_at
from public.attendance_sessions s
join public.classes c on c.id=s.class_id
left join public.attendance_records r on r.session_id=s.id
group by s.id,c.id;

grant select on public.attendance_session_summary to authenticated;

create or replace function public.save_daily_attendance(
  p_class_id uuid,
  p_attendance_date date,
  p_records jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_term uuid;
  v_session uuid;
  v_expected integer;
  v_submitted integer;
  v_unique integer;
  v_row jsonb;
  v_student uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  v_school := public.current_school_id();

  if not public.can_manage_attendance_class(p_class_id) then
    raise exception 'You are not assigned to this class';
  end if;

  if p_attendance_date is null then raise exception 'Attendance date is required'; end if;
  if p_attendance_date > current_date then raise exception 'Future attendance cannot be marked'; end if;

  if not exists (
    select 1 from public.classes
    where id=p_class_id and school_id=v_school and is_active=true
  ) then
    raise exception 'Choose a valid active class';
  end if;

  select ay.id into v_year
  from public.academic_years ay
  where ay.school_id=v_school
    and p_attendance_date between ay.starts_on and ay.ends_on
  order by ay.starts_on desc
  limit 1;

  if v_year is null then
    raise exception 'Attendance date is outside a configured academic year';
  end if;

  select t.id into v_term
  from public.terms t
  where t.school_id=v_school
    and t.academic_year_id=v_year
    and p_attendance_date between t.starts_on and t.ends_on
  order by t.starts_on desc
  limit 1;

  if v_term is null then
    raise exception 'Attendance date is outside a configured school term';
  end if;

  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'Attendance records must be an array';
  end if;

  select count(*) into v_expected
  from public.students st
  where st.school_id=v_school
    and st.class_id=p_class_id
    and st.status='active';

  if v_expected=0 then
    raise exception 'This class has no active students';
  end if;

  v_submitted := jsonb_array_length(p_records);
  select count(distinct (x->>'student_id')) into v_unique
  from jsonb_array_elements(p_records) x;

  if v_submitted <> v_expected or v_unique <> v_expected then
    raise exception 'Attendance must include every active student exactly once';
  end if;

  for v_row in select * from jsonb_array_elements(p_records)
  loop
    v_student := nullif(v_row->>'student_id','')::uuid;
    v_status := lower(nullif(trim(v_row->>'status'),''));

    if v_status not in ('present','absent','late','excused','sick') then
      raise exception 'Invalid attendance status';
    end if;

    if not exists (
      select 1 from public.students st
      where st.id=v_student
        and st.school_id=v_school
        and st.class_id=p_class_id
        and st.status='active'
    ) then
      raise exception 'Attendance contains a student outside this active class roster';
    end if;
  end loop;

  select id into v_session
  from public.attendance_sessions
  where school_id=v_school
    and class_id=p_class_id
    and attendance_date=p_attendance_date
    and mode='daily'
  for update;

  if v_session is not null and exists (
    select 1 from public.attendance_sessions where id=v_session and is_locked=true
  ) then
    raise exception 'This attendance register is locked';
  end if;

  if v_session is null then
    insert into public.attendance_sessions (
      school_id,academic_year_id,term_id,class_id,attendance_date,mode,notes,marked_by
    ) values (
      v_school,v_year,v_term,p_class_id,p_attendance_date,'daily',
      nullif(trim(coalesce(p_notes,'')),''),auth.uid()
    )
    returning id into v_session;
  else
    update public.attendance_sessions
    set
      academic_year_id=v_year,
      term_id=v_term,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      marked_by=auth.uid(),
      updated_at=now()
    where id=v_session;
  end if;

  for v_row in select * from jsonb_array_elements(p_records)
  loop
    v_student := (v_row->>'student_id')::uuid;
    v_status := lower(v_row->>'status');

    insert into public.attendance_records (
      school_id,session_id,student_id,status,remark,recorded_by
    ) values (
      v_school,v_session,v_student,v_status::public.attendance_status,
      nullif(trim(coalesce(v_row->>'remark','')),''),auth.uid()
    )
    on conflict (session_id,student_id) do update set
      status=excluded.status,
      remark=excluded.remark,
      recorded_by=auth.uid(),
      updated_at=now();
  end loop;

  delete from public.attendance_records ar
  where ar.session_id=v_session
    and not exists (
      select 1
      from jsonb_array_elements(p_records) x
      where (x->>'student_id')::uuid=ar.student_id
    );

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Attendance Saved','attendance_session',v_session,
    jsonb_build_object(
      'class_id',p_class_id,
      'attendance_date',p_attendance_date,
      'student_count',v_expected
    )
  );

  return v_session;
end;
$$;

create or replace function public.set_attendance_lock(
  p_session_id uuid,
  p_locked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_class uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can lock attendance';
  end if;

  v_school := public.current_school_id();

  select class_id into v_class
  from public.attendance_sessions
  where id=p_session_id and school_id=v_school
  for update;

  if v_class is null then raise exception 'Attendance session not found'; end if;

  update public.attendance_sessions
  set
    is_locked=p_locked,
    locked_at=case when p_locked then now() else null end,
    locked_by=case when p_locked then auth.uid() else null end,
    updated_at=now()
  where id=p_session_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),
    case when p_locked then 'Attendance Locked' else 'Attendance Unlocked' end,
    'attendance_session',p_session_id,
    jsonb_build_object('class_id',v_class)
  );
end;
$$;

revoke all on function public.save_daily_attendance(uuid,date,jsonb,text) from public;
revoke all on function public.set_attendance_lock(uuid,boolean) from public;
grant execute on function public.save_daily_attendance(uuid,date,jsonb,text) to authenticated;
grant execute on function public.set_attendance_lock(uuid,boolean) to authenticated;

commit;
