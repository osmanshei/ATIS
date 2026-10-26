-- ATIS Web v0.10.0 — Payment vouchers, payroll/payslips and feeding
begin;

-- ---------------------------------------------------------------------------
-- Payroll
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  run_no citext not null,
  payroll_month date not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','paid','cancelled')),
  pay_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, run_no),
  check (payroll_month=date_trunc('month',payroll_month)::date)
);

create unique index if not exists payroll_one_open_run_month_idx
  on public.payroll_runs (school_id,payroll_month)
  where status <> 'cancelled';

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete restrict,
  contract_id uuid references public.staff_contracts(id) on delete set null,
  base_salary numeric(12,2) not null default 0 check (base_salary >= 0),
  allowances numeric(12,2) not null default 0 check (allowances >= 0),
  deductions numeric(12,2) not null default 0 check (deductions >= 0),
  allowance_details jsonb not null default '[]'::jsonb,
  deduction_details jsonb not null default '[]'::jsonb,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_run_id,staff_id),
  check (deductions <= base_salary + allowances)
);

create index if not exists payroll_items_staff_idx
  on public.payroll_items (staff_id,payroll_run_id);

drop trigger if exists set_payroll_runs_updated_at on public.payroll_runs;
create trigger set_payroll_runs_updated_at
before update on public.payroll_runs
for each row execute function public.set_updated_at();

drop trigger if exists set_payroll_items_updated_at on public.payroll_items;
create trigger set_payroll_items_updated_at
before update on public.payroll_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payment vouchers
-- ---------------------------------------------------------------------------
create table if not exists public.payment_vouchers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  voucher_no citext not null,
  voucher_date date not null default current_date,
  payee text not null,
  category text not null default 'other'
    check (category in ('salary','feeding','supplies','utilities','maintenance','transport','refund','other')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  payment_method text,
  reference text,
  status text not null default 'draft'
    check (status in ('draft','approved','paid','cancelled')),
  payroll_run_id uuid unique references public.payroll_runs(id) on delete set null,
  prepared_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,voucher_no)
);

create index if not exists payment_vouchers_date_idx
  on public.payment_vouchers (school_id,voucher_date desc);

drop trigger if exists set_payment_vouchers_updated_at on public.payment_vouchers;
create trigger set_payment_vouchers_updated_at
before update on public.payment_vouchers
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Feeding
-- ---------------------------------------------------------------------------
create table if not exists public.feeding_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  feeding_date date not null,
  meal_name text not null default 'Lunch',
  unit_cost numeric(10,2) not null default 0 check (unit_cost >= 0),
  supplier text,
  notes text,
  is_locked boolean not null default false,
  recorded_by uuid references auth.users(id) on delete set null,
  locked_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,class_id,feeding_date,meal_name)
);

create table if not exists public.feeding_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  feeding_session_id uuid not null references public.feeding_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('fed','not_fed','exempt')),
  remark text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (feeding_session_id,student_id)
);

create index if not exists feeding_sessions_date_idx
  on public.feeding_sessions (school_id,feeding_date desc);
create index if not exists feeding_records_student_idx
  on public.feeding_records (student_id,feeding_session_id);

drop trigger if exists set_feeding_sessions_updated_at on public.feeding_sessions;
create trigger set_feeding_sessions_updated_at
before update on public.feeding_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_feeding_records_updated_at on public.feeding_records;
create trigger set_feeding_records_updated_at
before update on public.feeding_records
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.payment_vouchers enable row level security;
alter table public.feeding_sessions enable row level security;
alter table public.feeding_records enable row level security;

revoke all on table
  public.payroll_runs,
  public.payroll_items,
  public.payment_vouchers,
  public.feeding_sessions,
  public.feeding_records
from anon,authenticated;

grant select on table
  public.payroll_runs,
  public.payroll_items,
  public.payment_vouchers,
  public.feeding_sessions,
  public.feeding_records
to authenticated;

create or replace function public.is_payroll_finance_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.current_app_role() in ('admin','supervisor','accountant'),false)
$$;

revoke all on function public.is_payroll_finance_user() from public;
grant execute on function public.is_payroll_finance_user() to authenticated;

create or replace function public.can_manage_feeding()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.current_app_role() in ('admin','supervisor','clerk','staff'),false)
$$;

revoke all on function public.can_manage_feeding() from public;
grant execute on function public.can_manage_feeding() to authenticated;

drop policy if exists payroll_runs_read on public.payroll_runs;
create policy payroll_runs_read on public.payroll_runs
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    public.is_payroll_finance_user()
    or exists (
      select 1 from public.payroll_items pi
      where pi.payroll_run_id=payroll_runs.id
        and pi.staff_id=(select public.current_staff_id())
    )
  )
);

drop policy if exists payroll_items_read on public.payroll_items;
create policy payroll_items_read on public.payroll_items
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    public.is_payroll_finance_user()
    or staff_id=(select public.current_staff_id())
  )
);

drop policy if exists payment_vouchers_read on public.payment_vouchers;
create policy payment_vouchers_read on public.payment_vouchers
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and public.is_payroll_finance_user()
);

drop policy if exists feeding_sessions_read on public.feeding_sessions;
create policy feeding_sessions_read on public.feeding_sessions
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    public.can_manage_feeding()
    or (select public.current_app_role())='accountant'
  )
);

drop policy if exists feeding_records_read on public.feeding_records;
create policy feeding_records_read on public.feeding_records
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and exists (
    select 1 from public.feeding_sessions fs
    where fs.id=feeding_session_id
      and (
        public.can_manage_feeding()
        or (select public.current_app_role())='accountant'
      )
  )
);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
create or replace view public.payroll_run_summary
with (security_invoker=true)
as
select
  pr.*,
  count(pi.id)::integer staff_count,
  coalesce(sum(pi.base_salary),0)::numeric(12,2) base_total,
  coalesce(sum(pi.allowances),0)::numeric(12,2) allowance_total,
  coalesce(sum(pi.deductions),0)::numeric(12,2) deduction_total,
  coalesce(sum(pi.base_salary+pi.allowances),0)::numeric(12,2) gross_total,
  coalesce(sum(pi.base_salary+pi.allowances-pi.deductions),0)::numeric(12,2) net_total
from public.payroll_runs pr
left join public.payroll_items pi on pi.payroll_run_id=pr.id
group by pr.id;

grant select on public.payroll_run_summary to authenticated;

create or replace view public.payroll_item_summary
with (security_invoker=true)
as
select
  pi.*,
  pr.run_no,
  pr.payroll_month,
  pr.title payroll_title,
  pr.status payroll_status,
  pr.pay_date,
  s.employee_code,
  s.full_name,
  s.position_title,
  s.email,
  s.mobile,
  c.contract_no,
  (pi.base_salary+pi.allowances)::numeric(12,2) gross_pay,
  (pi.base_salary+pi.allowances-pi.deductions)::numeric(12,2) net_pay
from public.payroll_items pi
join public.payroll_runs pr on pr.id=pi.payroll_run_id
join public.staff s on s.id=pi.staff_id
left join public.staff_contracts c on c.id=pi.contract_id;

grant select on public.payroll_item_summary to authenticated;

create or replace view public.payment_voucher_summary
with (security_invoker=true)
as
select
  pv.*,
  pr.run_no payroll_run_no,
  pr.payroll_month
from public.payment_vouchers pv
left join public.payroll_runs pr on pr.id=pv.payroll_run_id;

grant select on public.payment_voucher_summary to authenticated;

create or replace view public.feeding_session_summary
with (security_invoker=true)
as
select
  fs.*,
  c.class_name,
  c.section,
  count(fr.id)::integer total_count,
  count(fr.id) filter (where fr.status='fed')::integer fed_count,
  count(fr.id) filter (where fr.status='not_fed')::integer not_fed_count,
  count(fr.id) filter (where fr.status='exempt')::integer exempt_count,
  (
    count(fr.id) filter (where fr.status='fed') * fs.unit_cost
  )::numeric(12,2) actual_cost
from public.feeding_sessions fs
join public.classes c on c.id=fs.class_id
left join public.feeding_records fr on fr.feeding_session_id=fs.id
group by fs.id,c.id;

grant select on public.feeding_session_summary to authenticated;

create or replace view public.feeding_record_summary
with (security_invoker=true)
as
select
  fr.*,
  fs.feeding_date,
  fs.class_id,
  fs.meal_name,
  fs.unit_cost,
  st.admission_number,
  st.first_name,
  st.middle_name,
  st.last_name
from public.feeding_records fr
join public.feeding_sessions fs on fs.id=fr.feeding_session_id
join public.students st on st.id=fr.student_id;

grant select on public.feeding_record_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Payroll functions
-- ---------------------------------------------------------------------------
create or replace function public.create_payroll_run(
  p_payroll_month date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_month date;
  v_month_end date;
  v_id uuid;
  v_run_no text;
  v_counter bigint;
  v_count integer;
begin
  if not public.is_payroll_finance_user() then
    raise exception 'Payroll access is required';
  end if;

  v_school:=public.current_school_id();
  v_month:=date_trunc('month',p_payroll_month)::date;
  v_month_end:=(v_month+interval '1 month - 1 day')::date;

  if p_payroll_month is null then raise exception 'Choose a payroll month'; end if;

  if exists (
    select 1 from public.payroll_runs
    where school_id=v_school
      and payroll_month=v_month
      and status<>'cancelled'
  ) then raise exception 'A payroll run already exists for this month'; end if;

  v_counter:=public.atis_take_counter(v_school,'payroll_run');
  v_run_no:='ATIS-PR-'||to_char(v_month,'YYYYMM')||'-'||lpad(v_counter::text,3,'0');

  insert into public.payroll_runs (
    school_id,run_no,payroll_month,title,status,notes,created_by
  ) values (
    v_school,v_run_no,v_month,
    'Payroll - '||to_char(v_month,'FMMonth YYYY'),
    'draft',nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  )
  returning id into v_id;

  insert into public.payroll_items (
    school_id,payroll_run_id,staff_id,contract_id,base_salary
  )
  select
    v_school,
    v_id,
    x.staff_id,
    x.id,
    x.base_salary
  from (
    select distinct on (c.staff_id)
      c.id,c.staff_id,c.base_salary,c.start_date
    from public.staff_contracts c
    join public.staff s on s.id=c.staff_id
    where c.school_id=v_school
      and s.status='active'
      and c.status in ('active','non_renewed')
      and c.start_date<=v_month_end
      and (c.end_date is null or c.end_date>=v_month)
    order by c.staff_id,c.start_date desc,c.created_at desc
  ) x;

  get diagnostics v_count=row_count;

  if v_count=0 then
    delete from public.payroll_runs where id=v_id;
    raise exception 'No active staff contracts with salary were found for this month';
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Payroll Run Created','payroll_run',v_id,
    jsonb_build_object('run_no',v_run_no,'payroll_month',v_month,'staff_count',v_count)
  );

  return v_id;
end;
$$;

create or replace function public.save_payroll_item(
  p_item_id uuid,
  p_allowances numeric,
  p_deductions numeric,
  p_allowance_details jsonb default '[]'::jsonb,
  p_deduction_details jsonb default '[]'::jsonb,
  p_remarks text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_run uuid;
  v_status text;
  v_base numeric;
begin
  if not public.is_payroll_finance_user() then
    raise exception 'Payroll access is required';
  end if;

  v_school:=public.current_school_id();

  select pi.payroll_run_id,pr.status,pi.base_salary
  into v_run,v_status,v_base
  from public.payroll_items pi
  join public.payroll_runs pr on pr.id=pi.payroll_run_id
  where pi.id=p_item_id and pi.school_id=v_school
  for update of pi;

  if v_run is null then raise exception 'Payroll item not found'; end if;
  if v_status<>'draft' then raise exception 'Only Draft payroll can be edited'; end if;
  if coalesce(p_allowances,0)<0 or coalesce(p_deductions,0)<0 then
    raise exception 'Allowances and deductions cannot be negative';
  end if;
  if coalesce(p_deductions,0)>v_base+coalesce(p_allowances,0) then
    raise exception 'Deductions cannot exceed gross pay';
  end if;

  update public.payroll_items
  set
    allowances=coalesce(p_allowances,0),
    deductions=coalesce(p_deductions,0),
    allowance_details=coalesce(p_allowance_details,'[]'::jsonb),
    deduction_details=coalesce(p_deduction_details,'[]'::jsonb),
    remarks=nullif(trim(coalesce(p_remarks,'')),''),
    updated_at=now()
  where id=p_item_id;
end;
$$;

create or replace function public.approve_payroll_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can approve payroll';
  end if;

  v_school:=public.current_school_id();

  update public.payroll_runs
  set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
  where id=p_run_id and school_id=v_school and status='draft';

  if not found then raise exception 'Draft payroll run not found'; end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (v_school,auth.uid(),'Payroll Approved','payroll_run',p_run_id,'{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment voucher functions
-- ---------------------------------------------------------------------------
create or replace function public.create_payment_voucher(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_no text;
  v_counter bigint;
  v_amount numeric;
  v_category text;
begin
  if not public.is_payroll_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();
  v_amount:=nullif(p_payload->>'amount','')::numeric;
  v_category:=coalesce(nullif(trim(p_payload->>'category'),''),'other');

  if nullif(trim(p_payload->>'payee'),'') is null then raise exception 'Payee is required'; end if;
  if nullif(trim(p_payload->>'description'),'') is null then raise exception 'Description is required'; end if;
  if v_amount is null or v_amount<0 then raise exception 'Enter a valid voucher amount'; end if;
  if v_category not in ('salary','feeding','supplies','utilities','maintenance','transport','refund','other') then
    raise exception 'Invalid voucher category';
  end if;

  v_counter:=public.atis_take_counter(v_school,'payment_voucher');
  v_no:='ATIS-PV-'||to_char(coalesce(nullif(p_payload->>'voucher_date','')::date,current_date),'YYYY')||
    '-'||lpad(v_counter::text,5,'0');

  insert into public.payment_vouchers (
    school_id,voucher_no,voucher_date,payee,category,description,amount,
    payment_method,reference,status,prepared_by,notes
  ) values (
    v_school,v_no,coalesce(nullif(p_payload->>'voucher_date','')::date,current_date),
    trim(p_payload->>'payee'),v_category,trim(p_payload->>'description'),v_amount,
    nullif(trim(coalesce(p_payload->>'payment_method','')),''),
    nullif(trim(coalesce(p_payload->>'reference','')),''),
    'draft',auth.uid(),nullif(trim(coalesce(p_payload->>'notes','')),'')
  )
  returning id into v_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Payment Voucher Created','payment_voucher',v_id,
    jsonb_build_object('voucher_no',v_no,'amount',v_amount,'category',v_category)
  );

  return v_id;
end;
$$;

create or replace function public.approve_payment_voucher(p_voucher_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can approve payment vouchers';
  end if;

  v_school:=public.current_school_id();

  update public.payment_vouchers
  set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now()
  where id=p_voucher_id and school_id=v_school and status='draft';

  if not found then raise exception 'Draft payment voucher not found'; end if;
end;
$$;

create or replace function public.mark_payment_voucher_paid(
  p_voucher_id uuid,
  p_payment_method text default null,
  p_reference text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
begin
  if not public.is_payroll_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();

  update public.payment_vouchers
  set
    status='paid',
    payment_method=coalesce(nullif(trim(p_payment_method),''),payment_method),
    reference=coalesce(nullif(trim(p_reference),''),reference),
    paid_by=auth.uid(),
    paid_at=now(),
    updated_at=now()
  where id=p_voucher_id and school_id=v_school and status='approved';

  if not found then raise exception 'Approved payment voucher not found'; end if;
end;
$$;

create or replace function public.mark_payroll_paid(
  p_run_id uuid,
  p_pay_date date,
  p_payment_method text default null,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_run public.payroll_runs%rowtype;
  v_total numeric;
  v_voucher uuid;
  v_no text;
  v_counter bigint;
begin
  if not public.is_payroll_finance_user() then
    raise exception 'Payroll access is required';
  end if;

  v_school:=public.current_school_id();

  select * into v_run
  from public.payroll_runs
  where id=p_run_id and school_id=v_school
  for update;

  if v_run.id is null then raise exception 'Payroll run not found'; end if;
  if v_run.status<>'approved' then raise exception 'Payroll must be approved before payment'; end if;
  if p_pay_date is null then raise exception 'Payment date is required'; end if;

  select coalesce(sum(base_salary+allowances-deductions),0)
  into v_total
  from public.payroll_items
  where payroll_run_id=p_run_id;

  v_counter:=public.atis_take_counter(v_school,'payment_voucher');
  v_no:='ATIS-PV-'||to_char(p_pay_date,'YYYY')||'-'||lpad(v_counter::text,5,'0');

  insert into public.payment_vouchers (
    school_id,voucher_no,voucher_date,payee,category,description,amount,
    payment_method,reference,status,payroll_run_id,prepared_by,
    approved_by,approved_at,paid_by,paid_at
  ) values (
    v_school,v_no,p_pay_date,'ATIS Staff Payroll','salary',
    v_run.title,v_total,nullif(trim(p_payment_method),''),
    nullif(trim(p_reference),''),'paid',p_run_id,auth.uid(),
    v_run.approved_by,v_run.approved_at,auth.uid(),now()
  )
  returning id into v_voucher;

  update public.payroll_runs
  set
    status='paid',
    pay_date=p_pay_date,
    paid_by=auth.uid(),
    paid_at=now(),
    updated_at=now()
  where id=p_run_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Payroll Paid','payroll_run',p_run_id,
    jsonb_build_object('amount',v_total,'voucher_id',v_voucher,'voucher_no',v_no)
  );

  return v_voucher;
end;
$$;

-- ---------------------------------------------------------------------------
-- Feeding functions
-- ---------------------------------------------------------------------------
create or replace function public.save_feeding_register(
  p_class_id uuid,
  p_feeding_date date,
  p_unit_cost numeric,
  p_records jsonb,
  p_supplier text default null,
  p_notes text default null,
  p_meal_name text default 'Lunch'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_term uuid;
  v_session uuid;
  v_expected integer;
  v_submitted integer;
  v_unique integer;
  v_row jsonb;
  v_student uuid;
  v_status text;
begin
  if not public.can_manage_feeding() then
    raise exception 'Feeding access is required';
  end if;

  v_school:=public.current_school_id();

  if p_feeding_date is null then raise exception 'Feeding date is required'; end if;
  if extract(isodow from p_feeding_date)::integer not between 1 and 4 then
    raise exception 'ATIS feeding days are Monday to Thursday';
  end if;
  if p_feeding_date>current_date then raise exception 'Future feeding cannot be recorded'; end if;
  if coalesce(p_unit_cost,0)<0 then raise exception 'Unit cost cannot be negative'; end if;

  if not exists (
    select 1 from public.classes
    where id=p_class_id and school_id=v_school and is_active=true
  ) then raise exception 'Choose a valid active class'; end if;

  select ay.id into v_year
  from public.academic_years ay
  where ay.school_id=v_school
    and p_feeding_date between ay.starts_on and ay.ends_on
  order by ay.starts_on desc
  limit 1;

  if v_year is null then raise exception 'Feeding date is outside a configured academic year'; end if;

  select t.id into v_term
  from public.terms t
  where t.school_id=v_school
    and t.academic_year_id=v_year
    and p_feeding_date between t.starts_on and t.ends_on
  order by t.starts_on desc
  limit 1;

  if v_term is null then raise exception 'Feeding date is outside a configured school term'; end if;
  if jsonb_typeof(p_records)<>'array' then raise exception 'Feeding records must be an array'; end if;

  select count(*) into v_expected
  from public.students st
  where st.school_id=v_school
    and st.class_id=p_class_id
    and st.status='active';

  if v_expected=0 then raise exception 'This class has no active students'; end if;

  v_submitted:=jsonb_array_length(p_records);
  select count(distinct (x->>'student_id')) into v_unique
  from jsonb_array_elements(p_records) x;

  if v_submitted<>v_expected or v_unique<>v_expected then
    raise exception 'Feeding register must include every active student exactly once';
  end if;

  for v_row in select * from jsonb_array_elements(p_records)
  loop
    v_student:=nullif(v_row->>'student_id','')::uuid;
    v_status:=lower(nullif(trim(v_row->>'status'),''));

    if v_status not in ('fed','not_fed','exempt') then raise exception 'Invalid feeding status'; end if;

    if not exists (
      select 1 from public.students st
      where st.id=v_student
        and st.school_id=v_school
        and st.class_id=p_class_id
        and st.status='active'
    ) then raise exception 'Feeding register contains a student outside this class'; end if;
  end loop;

  select id into v_session
  from public.feeding_sessions
  where school_id=v_school
    and class_id=p_class_id
    and feeding_date=p_feeding_date
    and meal_name=coalesce(nullif(trim(p_meal_name),''),'Lunch')
  for update;

  if v_session is not null and exists (
    select 1 from public.feeding_sessions where id=v_session and is_locked=true
  ) then raise exception 'This feeding register is locked'; end if;

  if v_session is null then
    insert into public.feeding_sessions (
      school_id,academic_year_id,term_id,class_id,feeding_date,meal_name,
      unit_cost,supplier,notes,recorded_by
    ) values (
      v_school,v_year,v_term,p_class_id,p_feeding_date,
      coalesce(nullif(trim(p_meal_name),''),'Lunch'),
      coalesce(p_unit_cost,0),
      nullif(trim(coalesce(p_supplier,'')),''),
      nullif(trim(coalesce(p_notes,'')),''),
      auth.uid()
    )
    returning id into v_session;
  else
    update public.feeding_sessions
    set
      academic_year_id=v_year,
      term_id=v_term,
      unit_cost=coalesce(p_unit_cost,0),
      supplier=nullif(trim(coalesce(p_supplier,'')),''),
      notes=nullif(trim(coalesce(p_notes,'')),''),
      recorded_by=auth.uid(),
      updated_at=now()
    where id=v_session;
  end if;

  for v_row in select * from jsonb_array_elements(p_records)
  loop
    v_student:=(v_row->>'student_id')::uuid;
    v_status:=lower(v_row->>'status');

    insert into public.feeding_records (
      school_id,feeding_session_id,student_id,status,remark,recorded_by
    ) values (
      v_school,v_session,v_student,v_status,
      nullif(trim(coalesce(v_row->>'remark','')),''),auth.uid()
    )
    on conflict (feeding_session_id,student_id) do update set
      status=excluded.status,
      remark=excluded.remark,
      recorded_by=auth.uid(),
      updated_at=now();
  end loop;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Feeding Register Saved','feeding_session',v_session,
    jsonb_build_object('class_id',p_class_id,'feeding_date',p_feeding_date,'student_count',v_expected)
  );

  return v_session;
end;
$$;

create or replace function public.set_feeding_lock(
  p_session_id uuid,
  p_locked boolean
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
    raise exception 'Only Admin or Supervisor can lock feeding records';
  end if;

  v_school:=public.current_school_id();

  update public.feeding_sessions
  set
    is_locked=p_locked,
    locked_by=case when p_locked then auth.uid() else null end,
    locked_at=case when p_locked then now() else null end,
    updated_at=now()
  where id=p_session_id and school_id=v_school;

  if not found then raise exception 'Feeding session not found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------------
revoke all on function public.create_payroll_run(date,text) from public;
revoke all on function public.save_payroll_item(uuid,numeric,numeric,jsonb,jsonb,text) from public;
revoke all on function public.approve_payroll_run(uuid) from public;
revoke all on function public.create_payment_voucher(jsonb) from public;
revoke all on function public.approve_payment_voucher(uuid) from public;
revoke all on function public.mark_payment_voucher_paid(uuid,text,text) from public;
revoke all on function public.mark_payroll_paid(uuid,date,text,text) from public;
revoke all on function public.save_feeding_register(uuid,date,numeric,jsonb,text,text,text) from public;
revoke all on function public.set_feeding_lock(uuid,boolean) from public;

grant execute on function public.create_payroll_run(date,text) to authenticated;
grant execute on function public.save_payroll_item(uuid,numeric,numeric,jsonb,jsonb,text) to authenticated;
grant execute on function public.approve_payroll_run(uuid) to authenticated;
grant execute on function public.create_payment_voucher(jsonb) to authenticated;
grant execute on function public.approve_payment_voucher(uuid) to authenticated;
grant execute on function public.mark_payment_voucher_paid(uuid,text,text) to authenticated;
grant execute on function public.mark_payroll_paid(uuid,date,text,text) to authenticated;
grant execute on function public.save_feeding_register(uuid,date,numeric,jsonb,text,text,text) to authenticated;
grant execute on function public.set_feeding_lock(uuid,boolean) to authenticated;

commit;
