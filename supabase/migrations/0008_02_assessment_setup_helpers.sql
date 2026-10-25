-- ATIS Web v0.6.0 — assessment setup helpers
begin;

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
  where cs.school_id=v_school
    and cs.is_active=true
    and c.is_active=true
    and c.academic_year_id=v_year
  on conflict (term_id,class_subject_id) do nothing;

  get diagnostics v_count = row_count;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,details
  ) values (
    v_school,auth.uid(),'Term Assessments Initialized','assessment_setup',
    jsonb_build_object(
      'term_id',p_term_id,
      'created_setups',v_count,
      'ca_weight',p_ca_weight,
      'exam_weight',p_exam_weight
    )
  );

  return v_count;
end;
$$;

revoke all on function public.initialize_term_assessments(uuid,numeric,numeric) from public;
grant execute on function public.initialize_term_assessments(uuid,numeric,numeric) to authenticated;

commit;
