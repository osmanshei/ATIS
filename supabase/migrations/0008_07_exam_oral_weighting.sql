-- ATIS Web v0.6.3 — written + oral examination weighting
-- Matches the school score sheet: written contributes 80%, oral contributes 20%,
-- and the combined examination score is converted to the configured exam weight.
begin;

alter table public.exam_scores
  add column if not exists oral_score numeric(7,2);

comment on column public.exam_scores.oral_score is
  'Oral examination mark out of 20; combined with the written paper weighted to 80.';

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

  if not public.can_manage_assessment_setup(p_setup_id) then
    raise exception 'Not authorized';
  end if;
  if p_max_mark is null or p_max_mark<=0 then
    raise exception 'Exam maximum mark must be greater than zero';
  end if;
  if jsonb_typeof(p_records)<>'array' then
    raise exception 'Exam scores must be provided as a list';
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

    if not v_absent and (v_score is null or v_score<0 or v_score>p_max_mark) then
      raise exception 'Written exam score must be between 0 and %',p_max_mark;
    end if;

    if not v_absent and (v_oral is null or v_oral<0 or v_oral>20) then
      raise exception 'Oral assessment score must be between 0 and 20';
    end if;

    insert into public.exam_scores (
      school_id,setup_id,student_id,raw_score,oral_score,max_mark,
      is_absent,remark,entered_by
    ) values (
      v_school,p_setup_id,v_student,
      case when v_absent then null else v_score end,
      case when v_absent then null else v_oral end,
      p_max_mark,
      v_absent,
      nullif(trim(coalesce(v_row->>'remark','')),''),
      auth.uid()
    )
    on conflict (setup_id,student_id) do update set
      raw_score=excluded.raw_score,
      oral_score=excluded.oral_score,
      max_mark=excluded.max_mark,
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
  round(case when coalesce(cat.possible_total,0)=0 then 0
    else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight end,2) ca_weighted_score,
  round(case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
    else (
      ((coalesce(et.raw_score,0)/et.max_mark)*80) + coalesce(et.oral_score,0)
    ) / 100 * a.exam_weight end,2) exam_weighted_score,
  round(
    case when coalesce(cat.possible_total,0)=0 then 0
      else (coalesce(cat.raw_total,0)/cat.possible_total)*a.ca_weight end
    +
    case when coalesce(et.max_mark,0)=0 or et.is_absent then 0
      else (
        ((coalesce(et.raw_score,0)/et.max_mark)*80) + coalesce(et.oral_score,0)
      ) / 100 * a.exam_weight end,2
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
        else (
          ((coalesce(et.raw_score,0)/et.max_mark)*80) + coalesce(et.oral_score,0)
        ) / 100 * a.exam_weight end,2
    ) between b.min_score and b.max_score
  order by b.sort_order
  limit 1
) gb on true
where a.status <> 'draft'
  and sub.include_on_report=true;

grant select on public.student_subject_results to authenticated;

commit;
