-- ATIS Web v0.6.0 — result completion metadata
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
  coalesce(cat.assessment_count,0) ca_assessment_count,
  coalesce(cat.score_count,0) ca_score_count,
  (et.score_id is not null) exam_entered,
  (
    coalesce(cat.assessment_count,0)=coalesce(cat.score_count,0)
    and et.score_id is not null
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

commit;
