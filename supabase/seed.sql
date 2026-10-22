-- ATIS initial school + academic calendar seed.
-- Safe to run more than once.

insert into public.schools (
  code, name, short_name, country, timezone, currency_code
)
values (
  'ATIS', 'AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL', 'ATIS',
  'Ghana', 'Africa/Accra', 'GHS'
)
on conflict (code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  updated_at = now();

with school as (
  select id from public.schools where code = 'ATIS'
)
insert into public.academic_years (
  school_id, name, starts_on, ends_on, is_current
)
select id, '2026-2027', '2026-09-01', '2027-07-29', true
from school
on conflict (school_id, name) do update set
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  is_current = excluded.is_current,
  updated_at = now();

with school as (
  select id from public.schools where code = 'ATIS'
), year as (
  select ay.id as academic_year_id, ay.school_id
  from public.academic_years ay
  join school s on s.id = ay.school_id
  where ay.name = '2026-2027'
)
insert into public.terms (school_id, academic_year_id, name, starts_on, ends_on, is_current)
select school_id, academic_year_id, x.name, x.starts_on, x.ends_on, x.is_current
from year
cross join (values
  ('Term 1'::text, '2026-09-01'::date, '2026-12-15'::date, true),
  ('Term 2'::text, '2027-01-04'::date, '2027-04-01'::date, false),
  ('Term 3'::text, '2027-04-20'::date, '2027-07-29'::date, false)
) as x(name, starts_on, ends_on, is_current)
on conflict (academic_year_id, name) do update set
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  is_current = excluded.is_current,
  updated_at = now();
