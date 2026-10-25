-- ATIS Web v0.6.2 — reportable vs timetable-only subjects
begin;

alter table public.subject_catalogue
  add column if not exists include_on_report boolean not null default true;

-- Preserve the established ATIS IncludeOnReport settings from the legacy catalogue.
update public.subject_catalogue
set include_on_report = false,
    updated_at = now()
where school_id in (select id from public.schools where code='ATIS')
  and upper(subject_code::text) in ('P.E','DAGBANLI');

update public.subject_catalogue
set include_on_report = true,
    updated_at = now()
where school_id in (select id from public.schools where code='ATIS')
  and upper(subject_code::text) not in ('P.E','DAGBANLI');

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
  cs.is_active,
  sc.include_on_report
from public.class_subjects cs
join public.classes c on c.id = cs.class_id
join public.subject_catalogue sc on sc.id = cs.subject_id;

grant select on public.class_subject_summary to authenticated;

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
join public.grade_schemes gs on gs.id=a.grade_scheme_id
where s.include_on_report=true;

grant select on public.assessment_setup_summary to authenticated;

-- Existing setups for timetable-only subjects are retained for audit/history
-- but made draft so they cannot contribute to results.
update public.assessment_setups a
set status='draft',
    updated_at=now()
from public.class_subjects cs
join public.subject_catalogue s on s.id=cs.subject_id
where a.class_subject_id=cs.id
  and s.include_on_report=false
  and a.status<>'draft';

create or replace function public.initialize_term_assessments(
  p_term_id uuid,
  p_ca_weight numeric default 40,
  p_exam_weight numeric default 60
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_primary uuid;
  v_jhs uuid;
  v_count integer;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can initialize assessment setups';
  end if;

  if p_ca_weight+p_exam_weight<>100 then
    raise exception 'CA weight and Exam weight must total 100';
  end if;

  v_school:=public.current_school_id();

  select academic_year_id into v_year
  from public.terms
  where id=p_term_id and school_id=v_school;

  if v_year is null then raise exception 'Invalid term'; end if;

  select id into v_primary
  from public.grade_schemes
  where school_id=v_school and scheme_name='ATIS_PROFICIENCY' and is_active=true;

  select id into v_jhs
  from public.grade_schemes
  where school_id=v_school and scheme_name='GHANA_JHS_A1_F9' and is_active=true;

  if v_primary is null or v_jhs is null then
    raise exception 'ATIS grading schemes are not configured';
  end if;

  insert into public.assessment_setups (
    school_id,academic_year_id,term_id,class_subject_id,
    ca_weight,exam_weight,grade_scheme_id,status,created_by
  )
  select
    v_school,v_year,p_term_id,cs.id,
    p_ca_weight,p_exam_weight,
    case
      when coalesce(c.grade_level,0)>=7
        or lower(coalesce(c.curriculum_stage,'')) in ('jhs','junior high','junior_high')
      then v_jhs
      else v_primary
    end,
    'active',auth.uid()
  from public.class_subjects cs
  join public.classes c on c.id=cs.class_id
  join public.subject_catalogue s on s.id=cs.subject_id
  where cs.school_id=v_school
    and cs.is_active=true
    and c.is_active=true
    and c.academic_year_id=v_year
    and s.is_active=true
    and s.include_on_report=true
  on conflict (term_id,class_subject_id) do update set
    ca_weight=excluded.ca_weight,
    exam_weight=excluded.exam_weight,
    grade_scheme_id=excluded.grade_scheme_id,
    status=case
      when public.assessment_setups.status='draft' then 'active'
      else public.assessment_setups.status
    end,
    updated_at=now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

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
    select 1
    from public.class_subjects cs
    join public.subject_catalogue s on s.id=cs.subject_id
    where cs.id=v_cs
      and cs.school_id=v_school
      and cs.is_active=true
      and s.is_active=true
      and s.include_on_report=true
  ) then
    raise exception 'Only subjects included on report cards can have assessment setups';
  end if;

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

  return v_id;
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
    sum(case when cas.is_absent then 0 else coalesce(cas.raw_score,0) end) raw_total,
    sum(ass.max_mark) possible_total
  from public.assessment_setups a
  join public.class_subjects cls on cls.id=a.class_subject_id
  join public.students st on st.class_id=cls.class_id and st.status='active'
  left join public.ca_assessments ass on ass.setup_id=a.id and ass.status <> 'draft'
  left join public.ca_scores cas on cas.assessment_id=ass.id and cas.student_id=st.id
  group by a.id,st.id
),
exam_totals as (
  select
    a.id setup_id,
    st.id student_id,
    es.id score_id,
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
  round(case when coalesce(cat.possible_total,0)=0 then 0
    else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight end,2) ca_weighted_score,
  round(case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
    else (coalesce(et.raw_score,0)/et.max_mark)*a.exam_weight end,2) exam_weighted_score,
  round(
    case when coalesce(cat.possible_total,0)=0 then 0
      else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight end
    +
    case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
      else (coalesce(et.raw_score,0)/et.max_mark)*a.exam_weight end,2
  ) total_score,
  gb.grade,
  gb.interpretation,
  gb.remark grade_remark,
  et.is_absent exam_absent,
  coalesce(cat.assessment_count,0) ca_assessment_count,
  coalesce(cat.score_count,0) ca_score_count,
  (et.score_id is not null) exam_entered,
  (
    (a.ca_weight=0 or (
      coalesce(cat.assessment_count,0)>0
      and coalesce(cat.assessment_count,0)=coalesce(cat.score_count,0)
    ))
    and (a.exam_weight=0 or et.score_id is not null)
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
    and round(
      case when coalesce(cat.possible_total,0)=0 then 0
        else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight end
      +
      case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
        else (coalesce(et.raw_score,0)/et.max_mark)*a.exam_weight end,2
    ) between b.min_score and b.max_score
  order by b.sort_order
  limit 1
) gb on true
where a.status <> 'draft'
  and sub.include_on_report=true;

grant select on public.student_subject_results to authenticated;

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
  v_setup_count integer;
  v_student_count integer;
  v_expected integer;
  v_complete integer;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can review or publish results';
  end if;

  v_school:=public.current_school_id();

  select academic_year_id into v_year
  from public.terms
  where id=p_term_id and school_id=v_school;

  if v_year is null then raise exception 'Invalid term'; end if;

  if p_status='published' then
    select count(*) into v_setup_count
    from public.assessment_setups a
    join public.class_subjects cs on cs.id=a.class_subject_id
    join public.subject_catalogue s on s.id=cs.subject_id
    where a.term_id=p_term_id
      and cs.class_id=p_class_id
      and a.status <> 'draft'
      and s.include_on_report=true;

    select count(*) into v_student_count
    from public.students s
    where s.school_id=v_school
      and s.class_id=p_class_id
      and s.status='active';

    if v_setup_count=0 then
      raise exception 'No reportable assessment setups exist for this class and term';
    end if;

    v_expected:=v_setup_count*v_student_count;

    select count(*) into v_complete
    from public.student_subject_results r
    where r.term_id=p_term_id
      and r.class_id=p_class_id
      and r.result_complete=true;

    if v_complete<>v_expected then
      raise exception 'Results are incomplete: % of % reportable student-subject results are complete',v_complete,v_expected;
    end if;
  end if;

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
    reviewed_by=case when excluded.status in ('reviewed','published') then auth.uid()
      else public.result_publications.reviewed_by end,
    reviewed_at=case when excluded.status in ('reviewed','published') then now()
      else public.result_publications.reviewed_at end,
    published_by=case when excluded.status='published' then auth.uid() else null end,
    published_at=case when excluded.status='published' then now() else null end,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.set_subject_report_flag(
  p_subject_id uuid,
  p_include_on_report boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can change report-card subject settings';
  end if;

  v_school:=public.current_school_id();

  update public.subject_catalogue
  set include_on_report=p_include_on_report,
      updated_at=now()
  where id=p_subject_id and school_id=v_school;

  if not found then raise exception 'Subject not found'; end if;

  if not p_include_on_report then
    update public.assessment_setups a
    set status='draft',
        updated_at=now()
    from public.class_subjects cs
    where a.class_subject_id=cs.id
      and cs.subject_id=p_subject_id
      and a.school_id=v_school
      and a.status<>'draft';
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Subject Report Flag Changed','subject',p_subject_id,
    jsonb_build_object('include_on_report',p_include_on_report)
  );
end;
$$;

revoke all on function public.set_subject_report_flag(uuid,boolean) from public;
grant execute on function public.set_subject_report_flag(uuid,boolean) to authenticated;

commit;
