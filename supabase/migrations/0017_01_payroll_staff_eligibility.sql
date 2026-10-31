-- ATIS: explicit payroll inclusion and individual statutory/allowance eligibility.
begin;

-- Existing configured profiles remain in the payroll roster until an administrator
-- explicitly excludes them. New profiles are excluded until inclusion is selected.
alter table public.payroll_profiles
  add column if not exists payroll_included boolean not null default false;

update public.payroll_profiles
set payroll_included = active
where payroll_included = false;

-- New staff profiles must opt in to SSNIT and early-attendance allowance.
-- Existing individual eligibility selections are deliberately preserved.
alter table public.payroll_profiles
  alter column ssnit_enabled set default false,
  alter column early_allowance_eligible set default false;

create or replace function public.save_payroll_profile(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Not authorized';
  end if;
  v_school:=public.current_school_id();

  insert into public.payroll_profiles(
    school_id,staff_id,category_id,base_pay_override,payroll_included,
    ssnit_enabled,ssnit_rate_override,early_allowance_eligible,
    long_service_eligible,active,notes,updated_by
  ) values(
    v_school,
    (p_payload->>'staff_id')::uuid,
    nullif(p_payload->>'category_id','')::uuid,
    nullif(p_payload->>'base_pay_override','')::numeric,
    coalesce((p_payload->>'payroll_included')::boolean,false),
    coalesce((p_payload->>'ssnit_enabled')::boolean,false),
    nullif(p_payload->>'ssnit_rate_override','')::numeric,
    coalesce((p_payload->>'early_allowance_eligible')::boolean,false),
    coalesce((p_payload->>'long_service_eligible')::boolean,true),
    coalesce((p_payload->>'active')::boolean,true),
    nullif(trim(coalesce(p_payload->>'notes','')),''),
    auth.uid()
  )
  on conflict(staff_id) do update set
    category_id=excluded.category_id,
    base_pay_override=excluded.base_pay_override,
    payroll_included=excluded.payroll_included,
    ssnit_enabled=excluded.ssnit_enabled,
    ssnit_rate_override=excluded.ssnit_rate_override,
    early_allowance_eligible=excluded.early_allowance_eligible,
    long_service_eligible=excluded.long_service_eligible,
    active=excluded.active,
    notes=excluded.notes,
    updated_by=auth.uid(),
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Keep the existing payroll calculation intact, but process only staff explicitly
-- included in payroll. This avoids accidentally generating salaries for non-salaried
-- administrators/supervisors or other staff.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.create_payroll_run(date,text)'::regprocedure)
  into v_definition;

  if position('pp.active=true' in v_definition)=0 then
    raise exception 'Could not safely update create_payroll_run: expected profile filter was not found';
  end if;

  v_definition:=replace(
    v_definition,
    'pp.active=true',
    'pp.active=true and pp.payroll_included=true'
  );

  execute v_definition;
end;
$$;

-- Rebuild the profile view with the new flag appended, preserving existing column order.
create or replace view public.payroll_profile_summary
with (security_invoker=false)
as
select
  pp.id,
  pp.school_id,
  pp.staff_id,
  pp.category_id,
  pp.base_pay_override,
  pp.ssnit_enabled,
  pp.ssnit_rate_override,
  pp.early_allowance_eligible,
  pp.long_service_eligible,
  pp.active,
  pp.notes,
  pp.updated_by,
  pp.created_at,
  pp.updated_at,
  st.full_name,
  st.employee_code,
  st.position_title,
  st.joining_date,
  pc.category_name,
  pc.base_pay category_base_pay,
  coalesce(pp.base_pay_override,pc.base_pay,0)::numeric(12,2) effective_base_pay,
  pp.payroll_included
from public.payroll_profiles pp
join public.staff st on st.id=pp.staff_id
left join public.payroll_categories pc on pc.id=pp.category_id
where pp.school_id=public.current_school_id()
  and (
    public.is_payroll_finance_user()
    or pp.staff_id=public.current_staff_id()
  );

grant select on public.payroll_profile_summary to authenticated;

commit;
