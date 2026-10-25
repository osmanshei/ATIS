-- ATIS Web v0.6.0 — completion and publication safeguards
begin;

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
  coalesce(cat.assessment_count,0) ca_assessment_count,
  coalesce(cat.score_count,0) ca_score_count,
  (et.score_id is not null) exam_entered,
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
  et.is_absent exam_absent,
  (
    (
      a.ca_weight=0
      or (
        coalesce(cat.assessment_count,0)>0
        and coalesce(cat.assessment_count,0)=coalesce(cat.score_count,0)
      )
    )
    and (
      a.exam_weight=0
      or et.score_id is not null
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
  if p_status not in ('draft','reviewed','published') then
    raise exception 'Invalid publication status';
  end if;

  select academic_year_id into v_year
  from public.terms
  where id=p_term_id and school_id=v_school;

  if v_year is null then raise exception 'Invalid term'; end if;

  if not exists (
    select 1 from public.classes
    where id=p_class_id and school_id=v_school
  ) then raise exception 'Invalid class'; end if;

  if p_status='published' then
    select count(*) into v_setup_count
    from public.assessment_setups a
    join public.class_subjects cs on cs.id=a.class_subject_id
    where a.term_id=p_term_id
      and cs.class_id=p_class_id
      and a.status <> 'draft';

    select count(*) into v_student_count
    from public.students s
    where s.school_id=v_school
      and s.class_id=p_class_id
      and s.status='active';

    if v_setup_count=0 then
      raise exception 'No active assessment setups exist for this class and term';
    end if;

    v_expected:=v_setup_count*v_student_count;

    select count(*) into v_complete
    from public.student_subject_results r
    where r.term_id=p_term_id
      and r.class_id=p_class_id
      and r.result_complete=true;

    if v_complete<>v_expected then
      raise exception 'Results are incomplete: % of % student-subject results are complete',v_complete,v_expected;
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
    reviewed_by=case
      when excluded.status in ('reviewed','published') then auth.uid()
      else public.result_publications.reviewed_by
    end,
    reviewed_at=case
      when excluded.status in ('reviewed','published') then now()
      else public.result_publications.reviewed_at
    end,
    published_by=case when excluded.status='published' then auth.uid() else null end,
    published_at=case when excluded.status='published' then now() else null end,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Result Publication Status Changed','result_publication',v_id,
    jsonb_build_object('class_id',p_class_id,'term_id',p_term_id,'status',p_status)
  );

  return v_id;
end;
$$;

commit;
