-- Fix the one-time duplicate administrator created when the initial manual
-- bootstrap staff insert retained placeholder Full Name / Email values.
-- This keeps the staff row linked to Supabase Auth and merges the imported
-- legacy administrator data into it.

begin;

with params as (
  select
    s.id as school_id,
    p.user_id as admin_user_id
  from public.schools s
  join public.profiles p
    on p.school_id = s.id
   and p.username = 'admin'
  where s.code = 'ATIS'
  limit 1
),
imported_admin as (
  delete from public.staff st
  using params p
  where st.school_id = p.school_id
    and st.legacy_id = 1
    and st.user_id is null
  returning st.*
)
update public.staff target
set
  legacy_id = src.legacy_id,
  employee_code = src.employee_code,
  full_name = src.full_name,
  email = src.email,
  mobile = src.mobile,
  role = src.role,
  position_title = src.position_title,
  gender = src.gender,
  date_of_birth = src.date_of_birth,
  qualification = src.qualification,
  specialization_duty = src.specialization_duty,
  joining_date = src.joining_date,
  address = src.address,
  emergency_contact_name = src.emergency_contact_name,
  emergency_contact_phone = src.emergency_contact_phone,
  status = src.status,
  legacy_payload = src.legacy_payload,
  updated_at = now()
from imported_admin src, params p
where target.school_id = p.school_id
  and target.user_id = p.admin_user_id;

-- Defensive cleanup: remove the exact unlinked placeholder only if one remains.
delete from public.staff
where school_id = (select id from public.schools where code = 'ATIS')
  and user_id is null
  and legacy_id is null
  and full_name = 'YOUR FULL NAME'
  and email::text = 'YOUR EMAIL ADDRESS';

commit;

-- Expected: 21 staff records.
select
  count(*) as staff_count
from public.staff
where school_id = (select id from public.schools where code = 'ATIS');

select
  legacy_id, employee_code, full_name, email, role,
  case when user_id is null then 'NO AUTH LINK' else 'AUTH LINKED' end as auth_status
from public.staff
where school_id = (select id from public.schools where code = 'ATIS')
  and (legacy_id = 1 or user_id = (
    select user_id
    from public.profiles
    where school_id = (select id from public.schools where code = 'ATIS')
      and username = 'admin'
    limit 1
  ));
