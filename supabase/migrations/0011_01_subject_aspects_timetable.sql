-- ATIS Web v0.9.0 — subject aspects and timetable scheduling
begin;

-- ------------------------------------------------------------
-- Subject aspects: teaching sub-strands beneath a reportable subject.
-- They never create separate assessment/report-card subjects.
-- ------------------------------------------------------------
create table if not exists public.subject_aspects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subject_catalogue(id) on delete cascade,
  aspect_name text not null,
  aspect_code citext,
  display_order integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subject_aspects_name_unique_idx
  on public.subject_aspects (subject_id, lower(trim(aspect_name)));

create unique index if not exists subject_aspects_code_unique_idx
  on public.subject_aspects (subject_id, lower(aspect_code::text))
  where aspect_code is not null and trim(aspect_code::text) <> '';

create index if not exists subject_aspects_subject_idx
  on public.subject_aspects (subject_id, is_active, display_order);

create table if not exists public.class_subject_aspects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  subject_aspect_id uuid not null references public.subject_aspects(id) on delete cascade,
  periods_per_week integer check (periods_per_week is null or periods_per_week between 0 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_subject_id, subject_aspect_id)
);

create index if not exists class_subject_aspects_class_subject_idx
  on public.class_subject_aspects (class_subject_id, is_active);

-- Seed the English Language aspects explicitly supplied by ATIS.
insert into public.subject_aspects (
  school_id,subject_id,aspect_name,aspect_code,display_order,is_active
)
select
  s.school_id,
  s.id,
  v.aspect_name,
  v.aspect_code,
  v.display_order,
  true
from public.subject_catalogue s
cross join (
  values
    ('Writing','WRITING',1),
    ('Reading','READING',2),
    ('Grammar','GRAMMAR',3),
    ('Listening & Speaking','LISTEN-SPEAK',4)
) as v(aspect_name,aspect_code,display_order)
where lower(trim(s.subject_name)) in ('english','english language')
   or lower(trim(s.subject_code::text)) in ('eng','english')
on conflict do nothing;

-- ------------------------------------------------------------
-- School periods and timetable entries
-- ------------------------------------------------------------
create table if not exists public.school_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  period_number integer not null check (period_number between 1 and 30),
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false,
  label text,
  display_order integer not null default 1,
  day_type text not null default 'regular',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (academic_year_id, day_type, period_number)
);

create index if not exists school_periods_year_order_idx
  on public.school_periods (academic_year_id, day_type, display_order, start_time);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.staff(id) on delete restrict,
  teacher_assignment_id uuid not null references public.teacher_assignments(id) on delete restrict,
  class_subject_id uuid not null references public.class_subjects(id) on delete restrict,
  class_subject_aspect_id uuid references public.class_subject_aspects(id) on delete set null,
  day_of_week smallint not null check (day_of_week between 1 and 5),
  period_id uuid not null references public.school_periods(id) on delete restrict,
  room_number text,
  mode text not null default 'onsite' check (mode in ('onsite','online','hybrid')),
  meeting_link text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists timetable_class_slot_unique_idx
  on public.timetable_entries (term_id,class_id,day_of_week,period_id)
  where is_active=true;

create unique index if not exists timetable_teacher_slot_unique_idx
  on public.timetable_entries (term_id,teacher_id,day_of_week,period_id)
  where is_active=true;

create unique index if not exists timetable_room_slot_unique_idx
  on public.timetable_entries (
    term_id,day_of_week,period_id,lower(trim(room_number))
  )
  where is_active=true and room_number is not null and trim(room_number) <> '';

create index if not exists timetable_term_class_idx
  on public.timetable_entries (term_id,class_id,is_active);

create index if not exists timetable_term_teacher_idx
  on public.timetable_entries (term_id,teacher_id,is_active);

-- Updated-at triggers
drop trigger if exists set_subject_aspects_updated_at on public.subject_aspects;
create trigger set_subject_aspects_updated_at
before update on public.subject_aspects
for each row execute function public.set_updated_at();

drop trigger if exists set_class_subject_aspects_updated_at on public.class_subject_aspects;
create trigger set_class_subject_aspects_updated_at
before update on public.class_subject_aspects
for each row execute function public.set_updated_at();

drop trigger if exists set_school_periods_updated_at on public.school_periods;
create trigger set_school_periods_updated_at
before update on public.school_periods
for each row execute function public.set_updated_at();

drop trigger if exists set_timetable_entries_updated_at on public.timetable_entries;
create trigger set_timetable_entries_updated_at
before update on public.timetable_entries
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Views
-- ------------------------------------------------------------
create or replace view public.subject_aspect_summary
with (security_invoker=true)
as
select
  a.id,
  a.school_id,
  a.subject_id,
  s.subject_name,
  s.subject_code,
  a.aspect_name,
  a.aspect_code,
  a.display_order,
  a.is_active
from public.subject_aspects a
join public.subject_catalogue s on s.id=a.subject_id;

create or replace view public.class_subject_aspect_summary
with (security_invoker=true)
as
select
  csa.id,
  csa.school_id,
  csa.class_subject_id,
  cs.class_id,
  c.class_name,
  c.section,
  cs.subject_id,
  s.subject_name,
  s.subject_code,
  csa.subject_aspect_id,
  a.aspect_name,
  a.aspect_code,
  a.display_order,
  csa.periods_per_week,
  csa.is_active,
  a.is_active as aspect_is_active
from public.class_subject_aspects csa
join public.class_subjects cs on cs.id=csa.class_subject_id
join public.classes c on c.id=cs.class_id
join public.subject_catalogue s on s.id=cs.subject_id
join public.subject_aspects a on a.id=csa.subject_aspect_id;

create or replace view public.timetable_entry_summary
with (security_invoker=true)
as
select
  t.id,
  t.school_id,
  t.academic_year_id,
  t.term_id,
  t.class_id,
  c.class_name,
  c.section,
  t.teacher_id,
  st.full_name as teacher_name,
  st.employee_code,
  t.teacher_assignment_id,
  t.class_subject_id,
  s.id as subject_id,
  s.subject_name,
  s.subject_code,
  t.class_subject_aspect_id,
  a.id as subject_aspect_id,
  a.aspect_name,
  a.aspect_code,
  t.day_of_week,
  case t.day_of_week
    when 1 then 'Monday'
    when 2 then 'Tuesday'
    when 3 then 'Wednesday'
    when 4 then 'Thursday'
    when 5 then 'Friday'
  end as day_name,
  t.period_id,
  p.period_number,
  p.label as period_label,
  p.start_time,
  p.end_time,
  p.display_order,
  p.is_break,
  t.room_number,
  t.mode,
  t.meeting_link,
  t.notes,
  t.is_active
from public.timetable_entries t
join public.classes c on c.id=t.class_id
join public.staff st on st.id=t.teacher_id
join public.class_subjects cs on cs.id=t.class_subject_id
join public.subject_catalogue s on s.id=cs.subject_id
join public.school_periods p on p.id=t.period_id
left join public.class_subject_aspects csa on csa.id=t.class_subject_aspect_id
left join public.subject_aspects a on a.id=csa.subject_aspect_id;

-- ------------------------------------------------------------
-- RLS and grants
-- ------------------------------------------------------------
alter table public.subject_aspects enable row level security;
alter table public.class_subject_aspects enable row level security;
alter table public.school_periods enable row level security;
alter table public.timetable_entries enable row level security;

revoke all on table
  public.subject_aspects,
  public.class_subject_aspects,
  public.school_periods,
  public.timetable_entries
from anon, authenticated;

grant select on table
  public.subject_aspects,
  public.class_subject_aspects,
  public.school_periods,
  public.timetable_entries
to authenticated;

grant select on
  public.subject_aspect_summary,
  public.class_subject_aspect_summary,
  public.timetable_entry_summary
to authenticated;

drop policy if exists subject_aspects_read on public.subject_aspects;
create policy subject_aspects_read
on public.subject_aspects for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','teacher')
);

drop policy if exists class_subject_aspects_read on public.class_subject_aspects;
create policy class_subject_aspects_read
on public.class_subject_aspects for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','teacher')
);

drop policy if exists school_periods_read on public.school_periods;
create policy school_periods_read
on public.school_periods for select to authenticated
using (school_id=(select public.current_school_id()));

drop policy if exists timetable_entries_read on public.timetable_entries;
create policy timetable_entries_read
on public.timetable_entries for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor')
    or (
      (select public.current_app_role())='teacher'
      and teacher_id=(select public.current_staff_id())
    )
  )
);

-- ------------------------------------------------------------
-- Subject aspect write helpers
-- ------------------------------------------------------------
create or replace function public.save_subject_aspect(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_subject uuid;
  v_name text;
  v_code text;
  v_order integer;
  v_active boolean;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can manage subject aspects';
  end if;

  v_school:=public.current_school_id();
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_subject:=nullif(p_payload->>'subject_id','')::uuid;
  v_name:=nullif(trim(coalesce(p_payload->>'aspect_name','')),'');
  v_code:=nullif(upper(trim(coalesce(p_payload->>'aspect_code',''))),'');
  v_order:=coalesce(nullif(p_payload->>'display_order','')::integer,1);
  v_active:=coalesce(nullif(p_payload->>'is_active','')::boolean,true);

  if v_subject is null or v_name is null then
    raise exception 'Subject and aspect name are required';
  end if;

  if not exists (
    select 1 from public.subject_catalogue
    where id=v_subject and school_id=v_school
  ) then
    raise exception 'Choose a valid subject';
  end if;

  if v_id is null then
    insert into public.subject_aspects (
      school_id,subject_id,aspect_name,aspect_code,display_order,is_active
    ) values (
      v_school,v_subject,v_name,v_code,v_order,v_active
    )
    returning id into v_id;
  else
    update public.subject_aspects
    set
      aspect_name=v_name,
      aspect_code=v_code,
      display_order=v_order,
      is_active=v_active
    where id=v_id
      and school_id=v_school
      and subject_id=v_subject;

    if not found then raise exception 'Subject aspect not found'; end if;
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Subject Aspect Saved','subject_aspect',v_id,
    jsonb_build_object(
      'subject_id',v_subject,
      'aspect_name',v_name,
      'aspect_code',v_code,
      'display_order',v_order,
      'is_active',v_active
    )
  );

  return v_id;
end;
$$;

create or replace function public.save_class_subject_aspect(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_cs uuid;
  v_aspect uuid;
  v_periods integer;
  v_active boolean;
  v_subject uuid;
  v_aspect_subject uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can configure class subject aspects';
  end if;

  v_school:=public.current_school_id();
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_cs:=nullif(p_payload->>'class_subject_id','')::uuid;
  v_aspect:=nullif(p_payload->>'subject_aspect_id','')::uuid;
  v_periods:=nullif(p_payload->>'periods_per_week','')::integer;
  v_active:=coalesce(nullif(p_payload->>'is_active','')::boolean,true);

  if v_cs is null or v_aspect is null then
    raise exception 'Class subject and aspect are required';
  end if;

  if v_periods is not null and (v_periods<0 or v_periods>30) then
    raise exception 'Periods per week must be between 0 and 30';
  end if;

  select subject_id into v_subject
  from public.class_subjects
  where id=v_cs and school_id=v_school;

  select subject_id into v_aspect_subject
  from public.subject_aspects
  where id=v_aspect and school_id=v_school;

  if v_subject is null then raise exception 'Choose a valid class subject'; end if;
  if v_aspect_subject is null then raise exception 'Choose a valid subject aspect'; end if;
  if v_subject<>v_aspect_subject then
    raise exception 'This aspect belongs to a different main subject';
  end if;

  if v_id is null then
    insert into public.class_subject_aspects (
      school_id,class_subject_id,subject_aspect_id,periods_per_week,is_active
    ) values (
      v_school,v_cs,v_aspect,v_periods,v_active
    )
    on conflict (class_subject_id,subject_aspect_id) do update set
      periods_per_week=excluded.periods_per_week,
      is_active=excluded.is_active,
      updated_at=now()
    returning id into v_id;
  else
    update public.class_subject_aspects
    set
      periods_per_week=v_periods,
      is_active=v_active
    where id=v_id
      and school_id=v_school
      and class_subject_id=v_cs
      and subject_aspect_id=v_aspect;

    if not found then raise exception 'Class subject aspect not found'; end if;
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Class Subject Aspect Saved','class_subject_aspect',v_id,
    jsonb_build_object(
      'class_subject_id',v_cs,
      'subject_aspect_id',v_aspect,
      'periods_per_week',v_periods,
      'is_active',v_active
    )
  );

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- Period write helper
-- ------------------------------------------------------------
create or replace function public.save_school_period(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_year uuid;
  v_number integer;
  v_start time;
  v_end time;
  v_break boolean;
  v_label text;
  v_order integer;
  v_day_type text;
  v_active boolean;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can configure school periods';
  end if;

  v_school:=public.current_school_id();
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_year:=nullif(p_payload->>'academic_year_id','')::uuid;
  v_number:=nullif(p_payload->>'period_number','')::integer;
  v_start:=nullif(p_payload->>'start_time','')::time;
  v_end:=nullif(p_payload->>'end_time','')::time;
  v_break:=coalesce(nullif(p_payload->>'is_break','')::boolean,false);
  v_label:=nullif(trim(coalesce(p_payload->>'label','')),'');
  v_order:=coalesce(nullif(p_payload->>'display_order','')::integer,v_number,1);
  v_day_type:=coalesce(nullif(trim(coalesce(p_payload->>'day_type','')),''),'regular');
  v_active:=coalesce(nullif(p_payload->>'is_active','')::boolean,true);

  if v_year is null or v_number is null or v_start is null or v_end is null then
    raise exception 'Academic year, period number, start time and end time are required';
  end if;

  if v_number<1 or v_number>30 then raise exception 'Period number must be between 1 and 30'; end if;
  if v_start>=v_end then raise exception 'Period start time must be earlier than end time'; end if;

  if not exists (
    select 1 from public.academic_years
    where id=v_year and school_id=v_school
  ) then
    raise exception 'Choose a valid academic year';
  end if;

  if v_active and exists (
    select 1
    from public.school_periods p
    where p.school_id=v_school
      and p.academic_year_id=v_year
      and p.day_type=v_day_type
      and p.is_active=true
      and (v_id is null or p.id<>v_id)
      and v_start<p.end_time
      and v_end>p.start_time
  ) then
    raise exception 'This time overlaps another active school period';
  end if;

  if v_id is not null and not v_active and exists (
    select 1
    from public.timetable_entries t
    where t.period_id=v_id and t.is_active=true
  ) then
    raise exception 'This period is already used in the timetable. Remove or move those lessons first';
  end if;

  if v_id is null then
    insert into public.school_periods (
      school_id,academic_year_id,period_number,start_time,end_time,
      is_break,label,display_order,day_type,is_active
    ) values (
      v_school,v_year,v_number,v_start,v_end,
      v_break,v_label,v_order,v_day_type,v_active
    )
    returning id into v_id;
  else
    update public.school_periods
    set
      academic_year_id=v_year,
      period_number=v_number,
      start_time=v_start,
      end_time=v_end,
      is_break=v_break,
      label=v_label,
      display_order=v_order,
      day_type=v_day_type,
      is_active=v_active
    where id=v_id and school_id=v_school;

    if not found then raise exception 'School period not found'; end if;
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'School Period Saved','school_period',v_id,
    jsonb_build_object(
      'academic_year_id',v_year,
      'period_number',v_number,
      'start_time',v_start,
      'end_time',v_end,
      'is_break',v_break,
      'label',v_label,
      'display_order',v_order,
      'day_type',v_day_type,
      'is_active',v_active
    )
  );

  return v_id;
end;
$$;

-- ------------------------------------------------------------
-- Timetable write helpers with clash detection
-- ------------------------------------------------------------
create or replace function public.save_timetable_entry(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_term uuid;
  v_year uuid;
  v_assignment uuid;
  v_teacher uuid;
  v_cs uuid;
  v_class uuid;
  v_aspect uuid;
  v_day smallint;
  v_period uuid;
  v_room text;
  v_mode text;
  v_meeting text;
  v_notes text;
  v_active boolean;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can edit the timetable';
  end if;

  v_school:=public.current_school_id();
  v_id:=nullif(p_payload->>'id','')::uuid;
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_assignment:=nullif(p_payload->>'teacher_assignment_id','')::uuid;
  v_aspect:=nullif(p_payload->>'class_subject_aspect_id','')::uuid;
  v_day:=nullif(p_payload->>'day_of_week','')::smallint;
  v_period:=nullif(p_payload->>'period_id','')::uuid;
  v_room:=nullif(trim(coalesce(p_payload->>'room_number','')),'');
  v_mode:=coalesce(nullif(trim(coalesce(p_payload->>'mode','')),''),'onsite');
  v_meeting:=nullif(trim(coalesce(p_payload->>'meeting_link','')),'');
  v_notes:=nullif(trim(coalesce(p_payload->>'notes','')),'');
  v_active:=coalesce(nullif(p_payload->>'is_active','')::boolean,true);

  if v_term is null or v_assignment is null or v_day is null or v_period is null then
    raise exception 'Term, teacher assignment, day and period are required';
  end if;

  if v_day<1 or v_day>5 then raise exception 'Choose a valid school day'; end if;
  if v_mode not in ('onsite','online','hybrid') then raise exception 'Choose a valid lesson mode'; end if;

  select academic_year_id into v_year
  from public.terms
  where id=v_term and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;

  select
    ta.teacher_id,
    ta.class_subject_id,
    cs.class_id
  into
    v_teacher,
    v_cs,
    v_class
  from public.teacher_assignments ta
  join public.class_subjects cs on cs.id=ta.class_subject_id
  join public.classes c on c.id=cs.class_id
  join public.subject_catalogue s on s.id=cs.subject_id
  where ta.id=v_assignment
    and ta.school_id=v_school
    and ta.academic_year_id=v_year
    and cs.is_active=true
    and c.is_active=true
    and s.is_active=true;

  if v_teacher is null or v_cs is null or v_class is null then
    raise exception 'Choose a valid teacher assignment for this academic year';
  end if;

  if not exists (
    select 1 from public.staff
    where id=v_teacher
      and school_id=v_school
      and status='active'
      and role='teacher'
  ) then
    raise exception 'The assigned teacher is not an active teacher';
  end if;

  if not exists (
    select 1
    from public.school_periods p
    where p.id=v_period
      and p.school_id=v_school
      and p.academic_year_id=v_year
      and p.is_active=true
      and p.is_break=false
  ) then
    raise exception 'Choose an active teaching period. Break periods cannot receive lessons';
  end if;

  if v_aspect is not null and not exists (
    select 1
    from public.class_subject_aspects csa
    join public.subject_aspects a on a.id=csa.subject_aspect_id
    where csa.id=v_aspect
      and csa.school_id=v_school
      and csa.class_subject_id=v_cs
      and csa.is_active=true
      and a.is_active=true
  ) then
    raise exception 'The selected aspect is not enabled for this class and subject';
  end if;

  if v_active and exists (
    select 1
    from public.timetable_entries t
    where t.term_id=v_term
      and t.class_id=v_class
      and t.day_of_week=v_day
      and t.period_id=v_period
      and t.is_active=true
      and (v_id is null or t.id<>v_id)
  ) then
    raise exception 'Class clash: this class already has a lesson in that period';
  end if;

  if v_active and exists (
    select 1
    from public.timetable_entries t
    where t.term_id=v_term
      and t.teacher_id=v_teacher
      and t.day_of_week=v_day
      and t.period_id=v_period
      and t.is_active=true
      and (v_id is null or t.id<>v_id)
  ) then
    raise exception 'Teacher clash: this teacher is already scheduled elsewhere in that period';
  end if;

  if v_active and v_room is not null and exists (
    select 1
    from public.timetable_entries t
    where t.term_id=v_term
      and t.day_of_week=v_day
      and t.period_id=v_period
      and t.is_active=true
      and t.room_number is not null
      and lower(trim(t.room_number))=lower(trim(v_room))
      and (v_id is null or t.id<>v_id)
  ) then
    raise exception 'Room clash: this room is already in use during that period';
  end if;

  if v_id is null then
    insert into public.timetable_entries (
      school_id,academic_year_id,term_id,class_id,teacher_id,
      teacher_assignment_id,class_subject_id,class_subject_aspect_id,
      day_of_week,period_id,room_number,mode,meeting_link,notes,
      is_active,created_by,updated_by
    ) values (
      v_school,v_year,v_term,v_class,v_teacher,
      v_assignment,v_cs,v_aspect,
      v_day,v_period,v_room,v_mode,v_meeting,v_notes,
      v_active,auth.uid(),auth.uid()
    )
    returning id into v_id;
  else
    update public.timetable_entries
    set
      academic_year_id=v_year,
      term_id=v_term,
      class_id=v_class,
      teacher_id=v_teacher,
      teacher_assignment_id=v_assignment,
      class_subject_id=v_cs,
      class_subject_aspect_id=v_aspect,
      day_of_week=v_day,
      period_id=v_period,
      room_number=v_room,
      mode=v_mode,
      meeting_link=v_meeting,
      notes=v_notes,
      is_active=v_active,
      updated_by=auth.uid()
    where id=v_id and school_id=v_school;

    if not found then raise exception 'Timetable entry not found'; end if;
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Timetable Entry Saved','timetable_entry',v_id,
    jsonb_build_object(
      'term_id',v_term,
      'class_id',v_class,
      'teacher_id',v_teacher,
      'class_subject_id',v_cs,
      'class_subject_aspect_id',v_aspect,
      'day_of_week',v_day,
      'period_id',v_period,
      'room_number',v_room,
      'mode',v_mode,
      'is_active',v_active
    )
  );

  return v_id;
end;
$$;

create or replace function public.deactivate_timetable_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can remove timetable entries';
  end if;

  v_school:=public.current_school_id();

  update public.timetable_entries
  set is_active=false,updated_by=auth.uid(),updated_at=now()
  where id=p_entry_id
    and school_id=v_school
    and is_active=true;

  if not found then raise exception 'Active timetable entry not found'; end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Timetable Entry Deactivated','timetable_entry',p_entry_id,'{}'::jsonb
  );
end;
$$;

revoke all on function public.save_subject_aspect(jsonb) from public;
revoke all on function public.save_class_subject_aspect(jsonb) from public;
revoke all on function public.save_school_period(jsonb) from public;
revoke all on function public.save_timetable_entry(jsonb) from public;
revoke all on function public.deactivate_timetable_entry(uuid) from public;

grant execute on function public.save_subject_aspect(jsonb) to authenticated;
grant execute on function public.save_class_subject_aspect(jsonb) to authenticated;
grant execute on function public.save_school_period(jsonb) to authenticated;
grant execute on function public.save_timetable_entry(jsonb) to authenticated;
grant execute on function public.deactivate_timetable_entry(uuid) to authenticated;

commit;
