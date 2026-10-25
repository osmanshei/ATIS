-- ATIS Web v0.6.0 — Assessments, Results & Report Cards
begin;

create table if not exists public.grade_schemes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  scheme_name citext not null,
  level text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, scheme_name)
);

create table if not exists public.grade_bands (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.grade_schemes(id) on delete cascade,
  min_score numeric(6,2) not null,
  max_score numeric(6,2) not null,
  grade text not null,
  interpretation text,
  remark text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  check (min_score >= 0 and max_score <= 100 and min_score <= max_score),
  unique (scheme_id, grade)
);

create table if not exists public.assessment_setups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  ca_weight numeric(5,2) not null default 40 check (ca_weight between 0 and 100),
  exam_weight numeric(5,2) not null default 60 check (exam_weight between 0 and 100),
  grade_scheme_id uuid not null references public.grade_schemes(id) on delete restrict,
  status text not null default 'active' check (status in ('draft','active','locked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ca_weight + exam_weight = 100),
  unique (term_id, class_subject_id)
);

create table if not exists public.ca_assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  setup_id uuid not null references public.assessment_setups(id) on delete cascade,
  component text not null check (
    component in ('class_exercise','homework','class_test','project','practical','other')
  ),
  assessment_no integer not null check (assessment_no > 0),
  assessment_name text not null,
  max_mark numeric(7,2) not null check (max_mark > 0),
  assessment_date date,
  status text not null default 'open' check (status in ('draft','open','closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setup_id, component, assessment_no)
);

create table if not exists public.ca_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  assessment_id uuid not null references public.ca_assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  raw_score numeric(7,2),
  is_absent boolean not null default false,
  remark text,
  entered_by uuid references auth.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table if not exists public.exam_scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  setup_id uuid not null references public.assessment_setups(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  raw_score numeric(7,2),
  max_mark numeric(7,2) not null default 100 check (max_mark > 0),
  is_absent boolean not null default false,
  remark text,
  entered_by uuid references auth.users(id) on delete set null,
  entered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (setup_id, student_id)
);

create table if not exists public.report_remarks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_remark text,
  headteacher_remark text,
  conduct text,
  next_term_begins date,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, class_id, student_id)
);

create table if not exists public.result_publications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','reviewed','published')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  notes text,
  updated_at timestamptz not null default now(),
  unique (term_id, class_id)
);

create index if not exists assessment_setups_term_idx
  on public.assessment_setups (term_id, class_subject_id);
create index if not exists ca_scores_student_idx
  on public.ca_scores (student_id, assessment_id);
create index if not exists exam_scores_student_idx
  on public.exam_scores (student_id, setup_id);
create index if not exists report_remarks_student_idx
  on public.report_remarks (student_id, term_id);

do $$
declare t text;
begin
  foreach t in array array[
    'grade_schemes','assessment_setups','ca_assessments','ca_scores',
    'exam_scores','report_remarks','result_publications'
  ] loop
    execute format('drop trigger if exists %I on public.%I','set_'||t||'_updated_at',t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_'||t||'_updated_at',t
    );
  end loop;
end $$;

-- Grade scheme seed copied from the established ATIS grading rules.
with sc as (
  select id school_id from public.schools where code='ATIS'
)
insert into public.grade_schemes (school_id,scheme_name,level,is_active)
select school_id,x.scheme_name,x.level,true
from sc
cross join (values
  ('ATIS_PROFICIENCY'::text,'PRIMARY'::text),
  ('GHANA_JHS_A1_F9'::text,'JHS'::text)
) x(scheme_name,level)
on conflict (school_id,scheme_name) do update set
  level=excluded.level,is_active=true,updated_at=now();

with sc as (
  select id school_id from public.schools where code='ATIS'
), bands(scheme_name,min_score,max_score,grade,interpretation,remark,sort_order) as (
  values
    ('ATIS_PROFICIENCY',80::numeric,100::numeric,'HP','Highly Proficient','Excellent mastery',1),
    ('ATIS_PROFICIENCY',70,79.99,'P','Proficient','Strong mastery',2),
    ('ATIS_PROFICIENCY',60,69.99,'AP','Approaching Proficiency','Approaching expected proficiency',3),
    ('ATIS_PROFICIENCY',50,59.99,'D','Developing','Developing proficiency',4),
    ('ATIS_PROFICIENCY',0,49.99,'E','Emerging','Emerging proficiency',5),
    ('GHANA_JHS_A1_F9',80,100,'A1','Excellent','Excellent',1),
    ('GHANA_JHS_A1_F9',75,79.99,'B2','Very Good','Very Good',2),
    ('GHANA_JHS_A1_F9',70,74.99,'B3','Good','Good',3),
    ('GHANA_JHS_A1_F9',65,69.99,'C4','Credit','Credit',4),
    ('GHANA_JHS_A1_F9',60,64.99,'C5','Credit','Credit',5),
    ('GHANA_JHS_A1_F9',55,59.99,'C6','Credit','Credit',6),
    ('GHANA_JHS_A1_F9',50,54.99,'D7','Pass','Pass',7),
    ('GHANA_JHS_A1_F9',45,49.99,'E8','Pass','Pass',8),
    ('GHANA_JHS_A1_F9',0,44.99,'F9','Fail','Fail',9)
)
insert into public.grade_bands (
  scheme_id,min_score,max_score,grade,interpretation,remark,sort_order
)
select gs.id,b.min_score,b.max_score,b.grade,b.interpretation,b.remark,b.sort_order
from bands b
join sc on true
join public.grade_schemes gs
  on gs.school_id=sc.school_id and gs.scheme_name=b.scheme_name
on conflict (scheme_id,grade) do update set
  min_score=excluded.min_score,
  max_score=excluded.max_score,
  interpretation=excluded.interpretation,
  remark=excluded.remark,
  sort_order=excluded.sort_order;

create or replace function public.can_manage_assessment_setup(target_setup_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  r public.app_role;
  stid uuid;
begin
  r:=public.current_app_role();
  if r in ('admin','supervisor') then return true; end if;

  if r='teacher' then
    stid:=public.current_staff_id();
    return exists (
      select 1
      from public.assessment_setups a
      join public.teacher_assignments ta on ta.class_subject_id=a.class_subject_id
      where a.id=target_setup_id
        and ta.teacher_id=stid
        and ta.academic_year_id=a.academic_year_id
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_manage_assessment_setup(uuid) from public;
grant execute on function public.can_manage_assessment_setup(uuid) to authenticated;

alter table public.grade_schemes enable row level security;
alter table public.grade_bands enable row level security;
alter table public.assessment_setups enable row level security;
alter table public.ca_assessments enable row level security;
alter table public.ca_scores enable row level security;
alter table public.exam_scores enable row level security;
alter table public.report_remarks enable row level security;
alter table public.result_publications enable row level security;

revoke all on table
  public.grade_schemes,public.grade_bands,public.assessment_setups,
  public.ca_assessments,public.ca_scores,public.exam_scores,
  public.report_remarks,public.result_publications
from anon,authenticated;

grant select on table
  public.grade_schemes,public.grade_bands,public.assessment_setups,
  public.ca_assessments,public.ca_scores,public.exam_scores,
  public.report_remarks,public.result_publications
to authenticated;

drop policy if exists grade_schemes_read on public.grade_schemes;
create policy grade_schemes_read on public.grade_schemes
for select to authenticated
using (school_id=(select public.current_school_id()));

drop policy if exists grade_bands_read on public.grade_bands;
create policy grade_bands_read on public.grade_bands
for select to authenticated
using (
  exists (
    select 1 from public.grade_schemes gs
    where gs.id=scheme_id and gs.school_id=(select public.current_school_id())
  )
);

drop policy if exists assessment_setups_read on public.assessment_setups;
create policy assessment_setups_read on public.assessment_setups
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_manage_assessment_setup(id)
);

drop policy if exists ca_assessments_read on public.ca_assessments;
create policy ca_assessments_read on public.ca_assessments
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_manage_assessment_setup(setup_id)
);

drop policy if exists ca_scores_read on public.ca_scores;
create policy ca_scores_read on public.ca_scores
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and exists (
    select 1 from public.ca_assessments a
    where a.id=assessment_id
      and public.can_manage_assessment_setup(a.setup_id)
  )
);

drop policy if exists exam_scores_read on public.exam_scores;
create policy exam_scores_read on public.exam_scores
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.can_manage_assessment_setup(setup_id)
);

drop policy if exists report_remarks_read on public.report_remarks;
create policy report_remarks_read on public.report_remarks
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor')
    or (
      (select public.current_app_role())='teacher'
      and public.can_manage_attendance_class(class_id)
    )
  )
);

drop policy if exists result_publications_read on public.result_publications;
create policy result_publications_read on public.result_publications
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor')
    or (
      (select public.current_app_role())='teacher'
      and public.can_manage_attendance_class(class_id)
    )
  )
);

create or replace view public.assessment_setup_summary
with (security_invoker=true)
as
select
  a.id,a.school_id,a.academic_year_id,a.term_id,t.name term_name,
  a.class_subject_id,cs.class_id,c.class_name,c.section,c.grade_level,c.curriculum_stage,
  cs.subject_id,s.subject_name,s.subject_code,
  a.ca_weight,a.exam_weight,a.grade_scheme_id,gs.scheme_name,gs.level grade_level_name,
  a.status,a.created_at,a.updated_at
from public.assessment_setups a
join public.terms t on t.id=a.term_id
join public.class_subjects cs on cs.id=a.class_subject_id
join public.classes c on c.id=cs.class_id
join public.subject_catalogue s on s.id=cs.subject_id
join public.grade_schemes gs on gs.id=a.grade_scheme_id;

grant select on public.assessment_setup_summary to authenticated;

create or replace view public.ca_assessment_summary
with (security_invoker=true)
as
select
  ca.id,ca.school_id,ca.setup_id,ca.component,ca.assessment_no,
  ca.assessment_name,ca.max_mark,ca.assessment_date,ca.status,
  count(cs.id)::integer as score_count
from public.ca_assessments ca
left join public.ca_scores cs on cs.assessment_id=ca.id
group by ca.id;

grant select on public.ca_assessment_summary to authenticated;

create or replace view public.student_subject_results
with (security_invoker=true)
as
with ca_totals as (
  select
    a.setup_id,
    st.id student_id,
    sum(case when ca.is_absent then 0 else coalesce(ca.raw_score,0) end) raw_total,
    sum(ass.max_mark) possible_total
  from public.assessment_setups a
  join public.class_subjects cls on cls.id=a.class_subject_id
  join public.students st on st.class_id=cls.class_id and st.status='active'
  left join public.ca_assessments ass on ass.setup_id=a.id and ass.status <> 'draft'
  left join public.ca_scores ca on ca.assessment_id=ass.id and ca.student_id=st.id
  group by a.id,st.id
),
exam_totals as (
  select
    a.id setup_id,
    st.id student_id,
    es.raw_score,
    es.max_mark,
    es.is_absent
  from public.assessment_setups a
  join public.class_subjects cls on cls.id=a.class_subject_id
  join public.students st on st.class_id=cls.class_id and st.status='active'
  left join public.exam_scores es on es.setup_id=a.id and es.student_id=st.id
)
select
  a.id setup_id,
  a.school_id,
  a.academic_year_id,
  a.term_id,
  cs.class_id,
  c.class_name,
  c.section,
  cs.subject_id,
  sub.subject_name,
  sub.subject_code,
  st.id student_id,
  st.admission_number,
  st.first_name,
  st.middle_name,
  st.last_name,
  a.ca_weight,
  a.exam_weight,
  round(
    case when coalesce(cat.possible_total,0)=0 then 0
      else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight
    end,2
  ) ca_weighted_score,
  round(
    case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
      else (coalesce(et.raw_score,0)/et.max_mark)*a.exam_weight
    end,2
  ) exam_weighted_score,
  round(
    case when coalesce(cat.possible_total,0)=0 then 0
      else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight
    end
    +
    case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
      else (coalesce(et.raw_score,0)/et.max_mark)*a.exam_weight
    end,2
  ) total_score,
  gb.grade,
  gb.interpretation,
  gb.remark grade_remark,
  et.is_absent exam_absent
from public.assessment_setups a
join public.class_subjects cs on cs.id=a.class_subject_id
join public.classes c on c.id=cs.class_id
join public.subject_catalogue sub on sub.id=cs.subject_id
join public.students st on st.class_id=cs.class_id and st.status='active'
left join ca_totals cat on cat.setup_id=a.id and cat.student_id=st.id
left join exam_totals et on et.setup_id=a.id and et.student_id=st.id
left join lateral (
  select b.grade,b.interpretation,b.remark
  from public.grade_bands b
  where b.scheme_id=a.grade_scheme_id
    and (
      round(
        case when coalesce(cat.possible_total,0)=0 then 0
          else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight
        end
        +
        case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
          else (coalesce(et.raw_score,0)/et.max_mark)*a.exam_weight
        end,2
      ) between b.min_score and b.max_score
    )
  order by b.sort_order
  limit 1
) gb on true
where a.status <> 'draft';

grant select on public.student_subject_results to authenticated;

create or replace function public.save_assessment_setup(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_term uuid;
  v_cs uuid;
  v_scheme uuid;
  v_id uuid;
  v_ca numeric;
  v_exam numeric;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can configure assessment weights';
  end if;

  v_school:=public.current_school_id();
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_cs:=nullif(p_payload->>'class_subject_id','')::uuid;
  v_scheme:=nullif(p_payload->>'grade_scheme_id','')::uuid;
  v_ca:=coalesce(nullif(p_payload->>'ca_weight','')::numeric,40);
  v_exam:=coalesce(nullif(p_payload->>'exam_weight','')::numeric,60);

  if v_ca+v_exam<>100 then raise exception 'CA weight and Exam weight must total 100'; end if;

  select academic_year_id into v_year
  from public.terms
  where id=v_term and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;

  if not exists (
    select 1 from public.class_subjects cs
    where cs.id=v_cs and cs.school_id=v_school and cs.is_active=true
  ) then raise exception 'Choose a valid class subject'; end if;

  if not exists (
    select 1 from public.grade_schemes gs
    where gs.id=v_scheme and gs.school_id=v_school and gs.is_active=true
  ) then raise exception 'Choose a valid grading scheme'; end if;

  insert into public.assessment_setups (
    school_id,academic_year_id,term_id,class_subject_id,
    ca_weight,exam_weight,grade_scheme_id,status,created_by
  ) values (
    v_school,v_year,v_term,v_cs,v_ca,v_exam,v_scheme,
    coalesce(nullif(p_payload->>'status',''),'active'),auth.uid()
  )
  on conflict (term_id,class_subject_id) do update set
    ca_weight=excluded.ca_weight,
    exam_weight=excluded.exam_weight,
    grade_scheme_id=excluded.grade_scheme_id,
    status=excluded.status,
    updated_at=now()
  returning id into v_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Assessment Setup Saved','assessment_setup',v_id,
    jsonb_build_object('term_id',v_term,'class_subject_id',v_cs,'ca_weight',v_ca,'exam_weight',v_exam)
  );

  return v_id;
end;
$$;

create or replace function public.save_ca_assessment(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_setup uuid;
  v_id uuid;
begin
  v_school:=public.current_school_id();
  v_setup:=nullif(p_payload->>'setup_id','')::uuid;

  if not public.can_manage_assessment_setup(v_setup) then
    raise exception 'You are not assigned to this subject';
  end if;

  if exists (select 1 from public.assessment_setups where id=v_setup and status='locked') then
    raise exception 'This assessment setup is locked';
  end if;

  insert into public.ca_assessments (
    school_id,setup_id,component,assessment_no,assessment_name,
    max_mark,assessment_date,status,created_by
  ) values (
    v_school,v_setup,
    coalesce(nullif(p_payload->>'component',''),'class_test'),
    coalesce(nullif(p_payload->>'assessment_no','')::integer,1),
    coalesce(nullif(trim(p_payload->>'assessment_name'),''),'Assessment'),
    nullif(p_payload->>'max_mark','')::numeric,
    nullif(p_payload->>'assessment_date','')::date,
    coalesce(nullif(p_payload->>'status',''),'open'),
    auth.uid()
  )
  on conflict (setup_id,component,assessment_no) do update set
    assessment_name=excluded.assessment_name,
    max_mark=excluded.max_mark,
    assessment_date=excluded.assessment_date,
    status=excluded.status,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.save_ca_scores(
  p_assessment_id uuid,
  p_records jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_setup uuid;
  v_class uuid;
  v_max numeric;
  v_row jsonb;
  v_student uuid;
  v_score numeric;
  v_absent boolean;
begin
  v_school:=public.current_school_id();

  select ca.setup_id,cs.class_id,ca.max_mark
  into v_setup,v_class,v_max
  from public.ca_assessments ca
  join public.assessment_setups a on a.id=ca.setup_id
  join public.class_subjects cs on cs.id=a.class_subject_id
  where ca.id=p_assessment_id and ca.school_id=v_school;

  if v_setup is null then raise exception 'Assessment not found'; end if;
  if not public.can_manage_assessment_setup(v_setup) then raise exception 'Not authorized'; end if;
  if jsonb_typeof(p_records)<>'array' then raise exception 'Scores must be an array'; end if;

  for v_row in select * from jsonb_array_elements(p_records)
  loop
    v_student:=nullif(v_row->>'student_id','')::uuid;
    v_absent:=coalesce((v_row->>'is_absent')::boolean,false);
    v_score:=nullif(v_row->>'raw_score','')::numeric;

    if not exists (
      select 1 from public.students s
      where s.id=v_student and s.school_id=v_school
        and s.class_id=v_class and s.status='active'
    ) then raise exception 'Score list contains an invalid student'; end if;

    if not v_absent and (v_score is null or v_score<0 or v_score>v_max) then
      raise exception 'Score must be between 0 and %',v_max;
    end if;

    insert into public.ca_scores (
      school_id,assessment_id,student_id,raw_score,is_absent,remark,entered_by
    ) values (
      v_school,p_assessment_id,v_student,
      case when v_absent then null else v_score end,
      v_absent,nullif(trim(coalesce(v_row->>'remark','')),''),auth.uid()
    )
    on conflict (assessment_id,student_id) do update set
      raw_score=excluded.raw_score,
      is_absent=excluded.is_absent,
      remark=excluded.remark,
      entered_by=auth.uid(),
      entered_at=now(),
      updated_at=now();
  end loop;
end;
$$;

create or replace function public.save_exam_scores(
  p_setup_id uuid,
  p_max_mark numeric,
  p_records jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_class uuid;
  v_row jsonb;
  v_student uuid;
  v_score numeric;
  v_absent boolean;
begin
  v_school:=public.current_school_id();

  if not public.can_manage_assessment_setup(p_setup_id) then raise exception 'Not authorized'; end if;
  if p_max_mark is null or p_max_mark<=0 then raise exception 'Exam maximum mark must be greater than zero'; end if;

  select cs.class_id into v_class
  from public.assessment_setups a
  join public.class_subjects cs on cs.id=a.class_subject_id
  where a.id=p_setup_id and a.school_id=v_school;

  if v_class is null then raise exception 'Assessment setup not found'; end if;

  for v_row in select * from jsonb_array_elements(p_records)
  loop
    v_student:=nullif(v_row->>'student_id','')::uuid;
    v_absent:=coalesce((v_row->>'is_absent')::boolean,false);
    v_score:=nullif(v_row->>'raw_score','')::numeric;

    if not exists (
      select 1 from public.students s
      where s.id=v_student and s.school_id=v_school
        and s.class_id=v_class and s.status='active'
    ) then raise exception 'Score list contains an invalid student'; end if;

    if not v_absent and (v_score is null or v_score<0 or v_score>p_max_mark) then
      raise exception 'Score must be between 0 and %',p_max_mark;
    end if;

    insert into public.exam_scores (
      school_id,setup_id,student_id,raw_score,max_mark,is_absent,remark,entered_by
    ) values (
      v_school,p_setup_id,v_student,
      case when v_absent then null else v_score end,
      p_max_mark,v_absent,nullif(trim(coalesce(v_row->>'remark','')),''),auth.uid()
    )
    on conflict (setup_id,student_id) do update set
      raw_score=excluded.raw_score,
      max_mark=excluded.max_mark,
      is_absent=excluded.is_absent,
      remark=excluded.remark,
      entered_by=auth.uid(),
      entered_at=now(),
      updated_at=now();
  end loop;
end;
$$;

create or replace function public.set_result_publication(
  p_class_id uuid,
  p_term_id uuid,
  p_status text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can review or publish results';
  end if;

  v_school:=public.current_school_id();
  if p_status not in ('draft','reviewed','published') then raise exception 'Invalid publication status'; end if;

  select academic_year_id into v_year
  from public.terms where id=p_term_id and school_id=v_school;

  if v_year is null then raise exception 'Invalid term'; end if;

  insert into public.result_publications (
    school_id,academic_year_id,term_id,class_id,status,
    reviewed_by,reviewed_at,published_by,published_at,notes
  ) values (
    v_school,v_year,p_term_id,p_class_id,p_status,
    case when p_status in ('reviewed','published') then auth.uid() else null end,
    case when p_status in ('reviewed','published') then now() else null end,
    case when p_status='published' then auth.uid() else null end,
    case when p_status='published' then now() else null end,
    nullif(trim(coalesce(p_notes,'')),'')
  )
  on conflict (term_id,class_id) do update set
    status=excluded.status,
    reviewed_by=case when excluded.status in ('reviewed','published') then auth.uid() else public.result_publications.reviewed_by end,
    reviewed_at=case when excluded.status in ('reviewed','published') then now() else public.result_publications.reviewed_at end,
    published_by=case when excluded.status='published' then auth.uid() else null end,
    published_at=case when excluded.status='published' then now() else null end,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.save_report_remark(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_term uuid;
  v_class uuid;
  v_student uuid;
  v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor','teacher') then
    raise exception 'Not authorized';
  end if;

  v_school:=public.current_school_id();
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_class:=nullif(p_payload->>'class_id','')::uuid;
  v_student:=nullif(p_payload->>'student_id','')::uuid;

  select academic_year_id into v_year
  from public.terms where id=v_term and school_id=v_school;
  if v_year is null then raise exception 'Invalid term'; end if;

  if (select public.current_app_role())='teacher'
     and not public.can_manage_attendance_class(v_class) then
    raise exception 'You are not assigned to this class';
  end if;

  if not exists (
    select 1 from public.students s
    where s.id=v_student and s.school_id=v_school and s.class_id=v_class
  ) then raise exception 'Invalid student'; end if;

  insert into public.report_remarks (
    school_id,academic_year_id,term_id,class_id,student_id,
    teacher_remark,headteacher_remark,conduct,next_term_begins,updated_by
  ) values (
    v_school,v_year,v_term,v_class,v_student,
    nullif(trim(p_payload->>'teacher_remark'),''),
    case when (select public.current_app_role()) in ('admin','supervisor')
      then nullif(trim(p_payload->>'headteacher_remark'),'') else null end,
    nullif(trim(p_payload->>'conduct'),''),
    nullif(p_payload->>'next_term_begins','')::date,
    auth.uid()
  )
  on conflict (term_id,class_id,student_id) do update set
    teacher_remark=excluded.teacher_remark,
    headteacher_remark=case
      when (select public.current_app_role()) in ('admin','supervisor')
      then coalesce(excluded.headteacher_remark,public.report_remarks.headteacher_remark)
      else public.report_remarks.headteacher_remark
    end,
    conduct=excluded.conduct,
    next_term_begins=excluded.next_term_begins,
    updated_by=auth.uid(),
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_assessment_setup(jsonb) from public;
revoke all on function public.save_ca_assessment(jsonb) from public;
revoke all on function public.save_ca_scores(uuid,jsonb) from public;
revoke all on function public.save_exam_scores(uuid,numeric,jsonb) from public;
revoke all on function public.set_result_publication(uuid,uuid,text,text) from public;
revoke all on function public.save_report_remark(jsonb) from public;

grant execute on function public.save_assessment_setup(jsonb) to authenticated;
grant execute on function public.save_ca_assessment(jsonb) to authenticated;
grant execute on function public.save_ca_scores(uuid,jsonb) to authenticated;
grant execute on function public.save_exam_scores(uuid,numeric,jsonb) to authenticated;
grant execute on function public.set_result_publication(uuid,uuid,text,text) to authenticated;
grant execute on function public.save_report_remark(jsonb) to authenticated;

commit;
