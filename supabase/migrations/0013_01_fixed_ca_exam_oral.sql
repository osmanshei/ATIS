-- ATIS Web v0.13.0 — fixed CA model and written/oral examination scoring
begin;

alter table public.assessment_setups
  add column if not exists ca_max_mark numeric(7,2) not null default 130;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.assessment_setups'::regclass
      and conname='assessment_setups_ca_max_mark_positive'
  ) then
    alter table public.assessment_setups
      add constraint assessment_setups_ca_max_mark_positive check (ca_max_mark > 0);
  end if;
end $$;

alter table public.exam_scores
  add column if not exists oral_score numeric(7,2);

-- Preserve the written-exam percentage if older setups used a different maximum.
update public.exam_scores
set raw_score = case
      when raw_score is not null and max_mark > 0 and max_mark <> 100
        then round((raw_score / max_mark) * 100, 2)
      else raw_score
    end,
    max_mark = 100
where max_mark <> 100;

alter table public.exam_scores
  drop constraint if exists exam_scores_oral_score_range;

alter table public.exam_scores
  add constraint exam_scores_oral_score_range
  check (oral_score is null or oral_score between 0 and 20);

create or replace view public.assessment_setup_summary
with (security_invoker=true)
as
select
  a.id,a.school_id,a.academic_year_id,a.term_id,t.name term_name,
  a.class_subject_id,cs.class_id,c.class_name,c.section,c.grade_level,c.curriculum_stage,
  cs.subject_id,s.subject_name,s.subject_code,
  a.ca_weight,a.exam_weight,a.grade_scheme_id,gs.scheme_name,gs.level grade_level_name,
  a.status,a.created_at,a.updated_at,a.ca_max_mark
from public.assessment_setups a
join public.terms t on t.id=a.term_id
join public.class_subjects cs on cs.id=a.class_subject_id
join public.classes c on c.id=cs.class_id
join public.subject_catalogue s on s.id=cs.subject_id
join public.grade_schemes gs on gs.id=a.grade_scheme_id;

grant select on public.assessment_setup_summary to authenticated;

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
  v_ca_max numeric;
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
  v_ca_max:=coalesce(nullif(p_payload->>'ca_max_mark','')::numeric,130);

  if v_ca+v_exam<>100 then raise exception 'CA weight and Exam weight must total 100'; end if;
  if v_ca_max<=0 then raise exception 'Raw CA maximum mark must be greater than zero'; end if;

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
    ca_weight,exam_weight,ca_max_mark,grade_scheme_id,status,created_by
  ) values (
    v_school,v_year,v_term,v_cs,v_ca,v_exam,v_ca_max,v_scheme,
    coalesce(nullif(p_payload->>'status',''),'active'),auth.uid()
  )
  on conflict (term_id,class_subject_id) do update set
    ca_weight=excluded.ca_weight,
    exam_weight=excluded.exam_weight,
    ca_max_mark=excluded.ca_max_mark,
    grade_scheme_id=excluded.grade_scheme_id,
    status=excluded.status,
    updated_at=now()
  returning id into v_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Assessment Setup Saved','assessment_setup',v_id,
    jsonb_build_object(
      'term_id',v_term,
      'class_subject_id',v_cs,
      'ca_weight',v_ca,
      'exam_weight',v_exam,
      'ca_max_mark',v_ca_max
    )
  );

  return v_id;
end;
$$;

create or replace function public.initialize_standard_ca_assessments(p_setup_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_ca_max numeric;
  v_count integer;
begin
  v_school:=public.current_school_id();

  if not public.can_manage_assessment_setup(p_setup_id) then
    raise exception 'You are not assigned to this subject';
  end if;

  select ca_max_mark into v_ca_max
  from public.assessment_setups
  where id=p_setup_id and school_id=v_school;

  if v_ca_max is null then raise exception 'Assessment setup not found'; end if;

  if exists (
    select 1 from public.assessment_setups
    where id=p_setup_id and status='locked'
  ) then
    raise exception 'This assessment setup is locked';
  end if;

  insert into public.ca_assessments (
    school_id,setup_id,component,assessment_no,assessment_name,
    max_mark,status,created_by
  )
  select
    v_school,p_setup_id,x.component,x.assessment_no,x.assessment_name,
    case
      when v_ca_max=160 and x.component='class_test' then 20
      else 10
    end,
    'open',auth.uid()
  from (values
    ('class_exercise'::text,1,'Class Exercise 1'::text),
    ('class_exercise'::text,2,'Class Exercise 2'::text),
    ('class_exercise'::text,3,'Class Exercise 3'::text),
    ('class_exercise'::text,4,'Class Exercise 4'::text),
    ('class_exercise'::text,5,'Class Exercise 5'::text),
    ('homework'::text,1,'Homework 1'::text),
    ('homework'::text,2,'Homework 2'::text),
    ('homework'::text,3,'Homework 3'::text),
    ('homework'::text,4,'Homework 4'::text),
    ('homework'::text,5,'Homework 5'::text),
    ('class_test'::text,1,'Class Test 1'::text),
    ('class_test'::text,2,'Class Test 2'::text),
    ('class_test'::text,3,'Class Test 3'::text)
  ) as x(component,assessment_no,assessment_name)
  on conflict (setup_id,component,assessment_no) do nothing;

  get diagnostics v_count = row_count;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Standard CA Assessments Initialized','assessment_setup',p_setup_id,
    jsonb_build_object('created_slots',v_count,'ca_max_mark',v_ca_max)
  );

  return v_count;
end;
$$;

revoke all on function public.initialize_standard_ca_assessments(uuid) from public;
grant execute on function public.initialize_standard_ca_assessments(uuid) to authenticated;

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
  v_component text;
  v_no integer;
  v_max numeric;
begin
  v_school:=public.current_school_id();
  v_setup:=nullif(p_payload->>'setup_id','')::uuid;
  v_component:=coalesce(nullif(p_payload->>'component',''),'class_test');
  v_no:=coalesce(nullif(p_payload->>'assessment_no','')::integer,1);
  v_max:=nullif(p_payload->>'max_mark','')::numeric;

  if not public.can_manage_assessment_setup(v_setup) then
    raise exception 'You are not assigned to this subject';
  end if;

  if not exists (
    select 1 from public.assessment_setups
    where id=v_setup and school_id=v_school
  ) then
    raise exception 'Assessment setup not found';
  end if;

  if exists (select 1 from public.assessment_setups where id=v_setup and status='locked') then
    raise exception 'This assessment setup is locked';
  end if;

  if not (
    (v_component='class_exercise' and v_no between 1 and 5)
    or (v_component='homework' and v_no between 1 and 5)
    or (v_component='class_test' and v_no between 1 and 3)
  ) then
    raise exception 'Use 5 class exercises, 5 homework assignments and 3 class tests';
  end if;

  if v_max is null or v_max<=0 then
    raise exception 'Maximum mark must be greater than zero';
  end if;

  insert into public.ca_assessments (
    school_id,setup_id,component,assessment_no,assessment_name,
    max_mark,assessment_date,status,created_by
  ) values (
    v_school,v_setup,v_component,v_no,
    coalesce(nullif(trim(p_payload->>'assessment_name'),''),'Assessment'),
    v_max,
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
  v_ca_max numeric;
  v_assessment_count integer;
  v_exercise_count integer;
  v_homework_count integer;
  v_test_count integer;
  v_possible_total numeric;
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
  if exists (select 1 from public.assessment_setups where id=v_setup and status='locked') then
    raise exception 'This assessment setup is locked';
  end if;
  if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Scores must be an array'; end if;

  select a.ca_max_mark
  into v_ca_max
  from public.assessment_setups a
  where a.id=v_setup and a.school_id=v_school;

  select
    count(*)::integer,
    count(*) filter (where component='class_exercise')::integer,
    count(*) filter (where component='homework')::integer,
    count(*) filter (where component='class_test')::integer,
    coalesce(sum(max_mark),0)
  into v_assessment_count,v_exercise_count,v_homework_count,v_test_count,v_possible_total
  from public.ca_assessments
  where setup_id=v_setup and status<>'draft';

  if v_assessment_count<>13
     or v_exercise_count<>5
     or v_homework_count<>5
     or v_test_count<>3
     or round(v_possible_total,2)<>round(v_ca_max,2) then
    raise exception 'Configure all 13 CA slots (5 exercises, 5 homework, 3 tests) and make their maximum marks total % before entering scores',v_ca_max;
  end if;

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
  v_oral numeric;
  v_absent boolean;
begin
  v_school:=public.current_school_id();

  if not public.can_manage_assessment_setup(p_setup_id) then raise exception 'Not authorized'; end if;
  if p_max_mark is null or p_max_mark<>100 then
    raise exception 'Written examination maximum mark is fixed at 100';
  end if;
  if jsonb_typeof(p_records) is distinct from 'array' then raise exception 'Scores must be an array'; end if;
  if exists (select 1 from public.assessment_setups where id=p_setup_id and status='locked') then
    raise exception 'This assessment setup is locked';
  end if;

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
    v_oral:=nullif(v_row->>'oral_score','')::numeric;

    if not exists (
      select 1 from public.students s
      where s.id=v_student and s.school_id=v_school
        and s.class_id=v_class and s.status='active'
    ) then raise exception 'Score list contains an invalid student'; end if;

    if not v_absent and (v_score is null or v_score<0 or v_score>100) then
      raise exception 'Written exam score must be between 0 and 100';
    end if;

    if not v_absent and (v_oral is null or v_oral<0 or v_oral>20) then
      raise exception 'Oral assessment score must be between 0 and 20';
    end if;

    insert into public.exam_scores (
      school_id,setup_id,student_id,raw_score,oral_score,max_mark,is_absent,remark,entered_by
    ) values (
      v_school,p_setup_id,v_student,
      case when v_absent then null else v_score end,
      case when v_absent then null else v_oral end,
      100,v_absent,nullif(trim(coalesce(v_row->>'remark','')),''),auth.uid()
    )
    on conflict (setup_id,student_id) do update set
      raw_score=excluded.raw_score,
      oral_score=excluded.oral_score,
      max_mark=100,
      is_absent=excluded.is_absent,
      remark=excluded.remark,
      entered_by=auth.uid(),
      entered_at=now(),
      updated_at=now();
  end loop;
end;
$$;

create or replace view public.student_subject_results
with (security_invoker=true)
as
with ca_totals as (
  select
    a.id setup_id,
    st.id student_id,
    count(ass.id)::integer assessment_count,
    count(cas.id)::integer score_count,
    count(ass.id) filter (where ass.component='class_exercise')::integer exercise_count,
    count(ass.id) filter (where ass.component='homework')::integer homework_count,
    count(ass.id) filter (where ass.component='class_test')::integer test_count,
    sum(case when cas.is_absent then 0 else coalesce(cas.raw_score,0) end) raw_total,
    sum(ass.max_mark) possible_total
  from public.assessment_setups a
  join public.class_subjects cls on cls.id=a.class_subject_id
  join public.students st on st.class_id=cls.class_id and st.status='active'
  left join public.ca_assessments ass on ass.setup_id=a.id and ass.status<>'draft'
  left join public.ca_scores cas on cas.assessment_id=ass.id and cas.student_id=st.id
  group by a.id,st.id
),
exam_totals as (
  select
    a.id setup_id,
    st.id student_id,
    es.id score_id,
    es.raw_score,
    es.oral_score,
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
  round((coalesce(cat.raw_total,0)/a.ca_max_mark)*a.ca_weight,2) ca_weighted_score,
  round(
    case when et.score_id is null or et.is_absent then 0
      else ((coalesce(et.raw_score,0)*0.8+coalesce(et.oral_score,0))/100)*a.exam_weight
    end,2
  ) exam_weighted_score,
  round(
    (coalesce(cat.raw_total,0)/a.ca_max_mark)*a.ca_weight
    +
    case when et.score_id is null or et.is_absent then 0
      else ((coalesce(et.raw_score,0)*0.8+coalesce(et.oral_score,0))/100)*a.exam_weight
    end,2
  ) total_score,
  gb.grade,
  gb.interpretation,
  gb.remark grade_remark,
  et.is_absent exam_absent,
  coalesce(cat.assessment_count,0) ca_assessment_count,
  coalesce(cat.score_count,0) ca_score_count,
  (et.score_id is not null) exam_entered,
  (
    (
      a.ca_weight=0
      or (
        coalesce(cat.exercise_count,0)=5
        and coalesce(cat.homework_count,0)=5
        and coalesce(cat.test_count,0)=3
        and coalesce(cat.assessment_count,0)=13
        and coalesce(cat.score_count,0)=13
        and round(coalesce(cat.possible_total,0),2)=round(a.ca_max_mark,2)
      )
    )
    and (
      a.exam_weight=0
      or (
        et.score_id is not null
        and (
          et.is_absent
          or (et.raw_score is not null and et.oral_score is not null)
        )
      )
    )
  ) result_complete
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
        (coalesce(cat.raw_total,0)/a.ca_max_mark)*a.ca_weight
        +
        case when et.score_id is null or et.is_absent then 0
          else ((coalesce(et.raw_score,0)*0.8+coalesce(et.oral_score,0))/100)*a.exam_weight
        end,2
      ) between b.min_score and b.max_score
    )
  order by b.sort_order
  limit 1
) gb on true
where a.status<>'draft';

commit;
