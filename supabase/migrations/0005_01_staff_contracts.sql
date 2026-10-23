-- ATIS Web v0.3.0 — Staff appointments, contracts and delivery logs
begin;

create table if not exists public.staff_contracts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  contract_no citext not null,
  employment_type text not null default 'fixed_term'
    check (employment_type in ('fixed_term','permanent','probationary','temporary','part_time')),
  position_title text not null,
  system_role public.app_role not null,
  department text,
  assigned_class text,
  subjects text,
  start_date date not null,
  probation_end_date date,
  end_date date,
  base_salary numeric(12,2) not null default 0 check (base_salary >= 0),
  working_hours text,
  reporting_to text,
  work_location text not null default 'ATIS',
  notice_period text,
  benefits_notes text,
  status text not null default 'draft'
    check (status in ('draft','active','renewed','terminated','non_renewed')),
  previous_contract_id uuid references public.staff_contracts(id) on delete set null,
  decision_reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, contract_no)
);

create index if not exists staff_contracts_staff_idx
  on public.staff_contracts (staff_id, start_date desc);

create index if not exists staff_contracts_status_idx
  on public.staff_contracts (school_id, status);

drop trigger if exists set_staff_contracts_updated_at on public.staff_contracts;
create trigger set_staff_contracts_updated_at
before update on public.staff_contracts
for each row execute function public.set_updated_at();

create table if not exists public.staff_delivery_logs (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  kind text not null check (kind in ('staff_login','appointment')),
  channel text not null check (channel in ('sms','email','manual')),
  destination text,
  status text not null,
  provider_reference text,
  details jsonb not null default '{}'::jsonb,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_delivery_logs_staff_idx
  on public.staff_delivery_logs (staff_id, created_at desc);

alter table public.staff_contracts enable row level security;
alter table public.staff_delivery_logs enable row level security;

revoke all on table public.staff_contracts, public.staff_delivery_logs from anon, authenticated;
grant select, insert, update on table public.staff_contracts to authenticated;
grant select on table public.staff_delivery_logs to authenticated;

create policy staff_contracts_read on public.staff_contracts
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','clerk')
    or staff_id = (select public.current_staff_id())
  )
);

create policy staff_contracts_insert on public.staff_contracts
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) = 'admin'
);

create policy staff_contracts_update on public.staff_contracts
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) = 'admin'
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) = 'admin'
);

create policy staff_delivery_logs_read on public.staff_delivery_logs
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_app_role()) = 'admin'
    or staff_id = (select public.current_staff_id())
  )
);

create or replace function public.staff_contract_effective_status(
  p_status text,
  p_start_date date,
  p_probation_end_date date,
  p_end_date date,
  p_today date default current_date
)
returns text
language plpgsql
immutable
as $$
begin
  if p_status in ('draft','renewed','terminated') then return p_status; end if;
  if p_status='non_renewed' then
    if p_end_date is not null and p_end_date < p_today then return 'non_renewed'; end if;
    return 'non_renewal_pending';
  end if;
  if p_status <> 'active' then return p_status; end if;
  if p_end_date is not null and p_end_date < p_today then return 'expired'; end if;
  if p_probation_end_date is not null
     and p_start_date <= p_today and p_today <= p_probation_end_date then
    return 'probation';
  end if;
  if p_end_date is not null and p_end_date - p_today between 0 and 30 then return 'expiring_30'; end if;
  if p_end_date is not null and p_end_date - p_today between 31 and 60 then return 'expiring_60'; end if;
  if p_end_date is not null and p_end_date - p_today between 61 and 90 then return 'expiring_90'; end if;
  return 'active';
end;
$$;

create or replace view public.staff_contract_summary
with (security_invoker = true)
as
select
  c.*,
  s.full_name,
  s.employee_code,
  s.email,
  s.mobile,
  public.staff_contract_effective_status(
    c.status,c.start_date,c.probation_end_date,c.end_date,current_date
  ) as effective_status,
  case when c.end_date is null then null else c.end_date-current_date end as days_to_end
from public.staff_contracts c
join public.staff s on s.id=c.staff_id;

grant select on public.staff_contract_summary to authenticated;

create or replace function public.save_staff_contract(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_staff public.staff%rowtype;
  v_id uuid;
  v_contract_no text;
  v_counter bigint;
  v_type text;
  v_status text;
  v_start date;
  v_probation date;
  v_end date;
begin
  if public.current_app_role() <> 'admin' then raise exception 'Not authorized'; end if;
  v_school := public.current_school_id();

  select * into v_staff
  from public.staff
  where id=nullif(p_payload->>'staff_id','')::uuid
    and school_id=v_school
    and status='active';

  if v_staff.id is null then raise exception 'Choose a valid active staff member'; end if;

  v_type := coalesce(nullif(p_payload->>'employment_type',''),'fixed_term');
  v_status := coalesce(nullif(p_payload->>'status',''),'draft');
  v_start := nullif(p_payload->>'start_date','')::date;
  v_probation := nullif(p_payload->>'probation_end_date','')::date;
  v_end := nullif(p_payload->>'end_date','')::date;

  if v_start is null then raise exception 'Contract start date is required'; end if;
  if v_type='fixed_term' and v_end is null then raise exception 'Fixed-term contracts require an end date'; end if;
  if v_end is not null and v_end < v_start then raise exception 'Contract end date cannot be before start date'; end if;
  if v_probation is not null and v_probation < v_start then raise exception 'Probation end date cannot be before start date'; end if;
  if v_probation is not null and v_end is not null and v_probation > v_end then
    raise exception 'Probation end date cannot be after contract end date';
  end if;
  if v_status not in ('draft','active') then raise exception 'New contracts must be Draft or Active'; end if;

  if v_status='active' and exists (
    select 1
    from public.staff_contracts c
    where c.school_id=v_school
      and c.staff_id=v_staff.id
      and public.staff_contract_effective_status(
        c.status,c.start_date,c.probation_end_date,c.end_date,current_date
      ) in ('active','probation','expiring_30','expiring_60','expiring_90','non_renewal_pending')
  ) then
    raise exception 'This staff member already has a current contract';
  end if;

  v_counter := public.atis_take_counter(v_school,'staff_contract');
  v_contract_no := 'ATIS-CON-' || to_char(current_date,'YYYY') || '-' || lpad(v_counter::text,4,'0');

  insert into public.staff_contracts (
    school_id,staff_id,contract_no,employment_type,position_title,system_role,
    department,assigned_class,subjects,start_date,probation_end_date,end_date,
    base_salary,working_hours,reporting_to,work_location,notice_period,benefits_notes,
    status,notes,created_by,updated_by
  ) values (
    v_school,v_staff.id,v_contract_no,v_type,
    coalesce(nullif(trim(p_payload->>'position_title'),''),coalesce(v_staff.position_title,v_staff.role::text)),
    v_staff.role,
    nullif(trim(p_payload->>'department'),''),
    nullif(trim(p_payload->>'assigned_class'),''),
    nullif(trim(p_payload->>'subjects'),''),
    v_start,v_probation,v_end,
    greatest(coalesce(nullif(p_payload->>'base_salary','')::numeric,0),0),
    nullif(trim(p_payload->>'working_hours'),''),
    nullif(trim(p_payload->>'reporting_to'),''),
    coalesce(nullif(trim(p_payload->>'work_location'),''),'ATIS'),
    nullif(trim(p_payload->>'notice_period'),''),
    nullif(trim(p_payload->>'benefits_notes'),''),
    v_status,
    nullif(trim(p_payload->>'notes'),''),
    auth.uid(),auth.uid()
  )
  returning id into v_id;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school,auth.uid(),'Staff Contract Created','staff_contract',v_id,
    jsonb_build_object('contract_no',v_contract_no,'staff_id',v_staff.id,'status',v_status)
  );

  return v_id;
end;
$$;

create or replace function public.activate_staff_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_contract public.staff_contracts%rowtype;
begin
  if public.current_app_role() <> 'admin' then raise exception 'Not authorized'; end if;
  v_school := public.current_school_id();

  select * into v_contract
  from public.staff_contracts
  where id=p_contract_id and school_id=v_school
  for update;

  if v_contract.id is null then raise exception 'Contract not found'; end if;
  if v_contract.status <> 'draft' then raise exception 'Only Draft contracts can be activated'; end if;

  if exists (
    select 1 from public.staff_contracts c
    where c.school_id=v_school
      and c.staff_id=v_contract.staff_id
      and c.id<>v_contract.id
      and public.staff_contract_effective_status(
        c.status,c.start_date,c.probation_end_date,c.end_date,current_date
      ) in ('active','probation','expiring_30','expiring_60','expiring_90','non_renewal_pending')
  ) then
    raise exception 'This staff member already has another current contract';
  end if;

  update public.staff_contracts
  set status='active',updated_by=auth.uid(),updated_at=now()
  where id=p_contract_id;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school,auth.uid(),'Staff Contract Activated','staff_contract',p_contract_id,
    jsonb_build_object('contract_no',v_contract.contract_no,'staff_id',v_contract.staff_id)
  );
end;
$$;

create or replace function public.terminate_staff_contract(
  p_contract_id uuid,
  p_termination_date date,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_contract public.staff_contracts%rowtype;
begin
  if public.current_app_role() <> 'admin' then raise exception 'Not authorized'; end if;
  v_school := public.current_school_id();

  select * into v_contract
  from public.staff_contracts
  where id=p_contract_id and school_id=v_school
  for update;

  if v_contract.id is null then raise exception 'Contract not found'; end if;
  if v_contract.status in ('renewed','terminated') then raise exception 'Contract is already closed'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Termination reason is required'; end if;
  if p_termination_date < v_contract.start_date then raise exception 'Termination date cannot be before start date'; end if;

  update public.staff_contracts
  set
    end_date=p_termination_date,
    status='terminated',
    decision_reason=trim(p_reason),
    updated_by=auth.uid(),
    updated_at=now()
  where id=p_contract_id;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school,auth.uid(),'Staff Contract Terminated','staff_contract',p_contract_id,
    jsonb_build_object('reason',p_reason,'termination_date',p_termination_date)
  );
end;
$$;

revoke all on function public.save_staff_contract(jsonb) from public;
revoke all on function public.activate_staff_contract(uuid) from public;
revoke all on function public.terminate_staff_contract(uuid,date,text) from public;
grant execute on function public.save_staff_contract(jsonb) to authenticated;
grant execute on function public.activate_staff_contract(uuid) to authenticated;
grant execute on function public.terminate_staff_contract(uuid,date,text) to authenticated;

commit;
