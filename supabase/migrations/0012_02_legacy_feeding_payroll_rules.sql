-- ATIS Web v0.10.1 — legacy-compatible feeding and payroll rules
begin;

-- ===========================================================================
-- FEEDING: rates, plans, prepaid credits and attendance-driven consumption
-- ===========================================================================

create table if not exists public.feeding_rates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  daily_rate numeric(10,2) not null default 0 check (daily_rate >= 0),
  weekly_rate numeric(10,2) not null default 0 check (weekly_rate >= 0),
  monthly_rate numeric(10,2) not null default 0 check (monthly_rate >= 0),
  termly_rate numeric(10,2) not null default 0 check (termly_rate >= 0),
  status text not null default 'active' check (status in ('active','inactive')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id,class_id)
);

create table if not exists public.student_feeding_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  frequency text not null default 'daily'
    check (frequency in ('daily','weekly','monthly','termly','exempt')),
  exemption_type text
    check (exemption_type is null or exemption_type in ('staff_child','management_child','other')),
  related_staff_id uuid references public.staff(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive')),
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id,student_id),
  check (
    (frequency='exempt' and exemption_type is not null)
    or
    (frequency<>'exempt')
  )
);

create table if not exists public.feeding_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  frequency text not null check (frequency in ('daily','weekly','monthly','termly')),
  coverage_label text,
  coverage_start date,
  coverage_end date,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text,
  receipt_no citext not null,
  reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now(),
  unique (school_id,receipt_no)
);

create table if not exists public.feeding_wallet_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  entry_date date not null,
  entry_type text not null check (entry_type in ('payment','charge','adjustment','refund')),
  amount numeric(12,2) not null check (amount <> 0),
  payment_id uuid references public.feeding_payments(id) on delete cascade,
  attendance_record_id uuid references public.attendance_records(id) on delete cascade,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (entry_type='payment' and amount>0 and payment_id is not null)
    or (entry_type='charge' and amount<0 and attendance_record_id is not null)
    or entry_type in ('adjustment','refund')
  )
);

create unique index if not exists feeding_wallet_payment_unique_idx
  on public.feeding_wallet_entries(payment_id) where payment_id is not null;
create unique index if not exists feeding_wallet_attendance_unique_idx
  on public.feeding_wallet_entries(attendance_record_id) where attendance_record_id is not null;
create index if not exists feeding_wallet_student_term_idx
  on public.feeding_wallet_entries(student_id,term_id,entry_date);
create index if not exists feeding_payments_student_term_idx
  on public.feeding_payments(student_id,term_id,payment_date desc);

drop trigger if exists set_feeding_rates_updated_at on public.feeding_rates;
create trigger set_feeding_rates_updated_at before update on public.feeding_rates
for each row execute function public.set_updated_at();

drop trigger if exists set_student_feeding_plans_updated_at on public.student_feeding_plans;
create trigger set_student_feeding_plans_updated_at before update on public.student_feeding_plans
for each row execute function public.set_updated_at();

alter table public.feeding_rates enable row level security;
alter table public.student_feeding_plans enable row level security;
alter table public.feeding_payments enable row level security;
alter table public.feeding_wallet_entries enable row level security;

revoke all on table public.feeding_rates,public.student_feeding_plans,
  public.feeding_payments,public.feeding_wallet_entries from anon,authenticated;
grant select on table public.feeding_rates,public.student_feeding_plans,
  public.feeding_payments,public.feeding_wallet_entries to authenticated;

drop policy if exists feeding_rates_read on public.feeding_rates;
create policy feeding_rates_read on public.feeding_rates for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant','clerk','staff')
);

drop policy if exists feeding_plans_read on public.student_feeding_plans;
create policy feeding_plans_read on public.student_feeding_plans for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant','clerk','staff')
);

drop policy if exists feeding_payments_read on public.feeding_payments;
create policy feeding_payments_read on public.feeding_payments for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant','clerk')
);

drop policy if exists feeding_wallet_read on public.feeding_wallet_entries;
create policy feeding_wallet_read on public.feeding_wallet_entries for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant','clerk','staff')
);

create or replace function public.feeding_frequency_rate(
  p_class_id uuid,
  p_term_id uuid,
  p_frequency text
)
returns numeric
language sql
stable
security definer
set search_path=public
as $$
  select case p_frequency
    when 'daily' then fr.daily_rate
    when 'weekly' then fr.weekly_rate
    when 'monthly' then fr.monthly_rate
    when 'termly' then fr.termly_rate
    else 0
  end
  from public.feeding_rates fr
  where fr.school_id=public.current_school_id()
    and fr.class_id=p_class_id
    and fr.term_id=p_term_id
    and fr.status='active'
  limit 1
$$;

create or replace function public.feeding_balance(
  p_student_id uuid,
  p_term_id uuid
)
returns numeric
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(sum(e.amount),0)::numeric(12,2)
  from public.feeding_wallet_entries e
  where e.school_id=public.current_school_id()
    and e.student_id=p_student_id
    and e.term_id=p_term_id
$$;

revoke all on function public.feeding_frequency_rate(uuid,uuid,text) from public;
revoke all on function public.feeding_balance(uuid,uuid) from public;
grant execute on function public.feeding_frequency_rate(uuid,uuid,text) to authenticated;
grant execute on function public.feeding_balance(uuid,uuid) to authenticated;

create or replace function public.save_feeding_rate(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_term uuid;
  v_year uuid;
  v_class uuid;
  v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor','accountant') then
    raise exception 'Feeding rate access is required';
  end if;

  v_school:=public.current_school_id();
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_class:=nullif(p_payload->>'class_id','')::uuid;

  select academic_year_id into v_year
  from public.terms where id=v_term and school_id=v_school;
  if v_year is null then raise exception 'Choose a valid term'; end if;
  if not exists(select 1 from public.classes where id=v_class and school_id=v_school) then
    raise exception 'Choose a valid class';
  end if;

  insert into public.feeding_rates(
    school_id,academic_year_id,term_id,class_id,daily_rate,weekly_rate,
    monthly_rate,termly_rate,status,notes,created_by
  ) values(
    v_school,v_year,v_term,v_class,
    greatest(coalesce(nullif(p_payload->>'daily_rate','')::numeric,0),0),
    greatest(coalesce(nullif(p_payload->>'weekly_rate','')::numeric,0),0),
    greatest(coalesce(nullif(p_payload->>'monthly_rate','')::numeric,0),0),
    greatest(coalesce(nullif(p_payload->>'termly_rate','')::numeric,0),0),
    coalesce(nullif(p_payload->>'status',''),'active'),
    nullif(trim(coalesce(p_payload->>'notes','')),''),
    auth.uid()
  )
  on conflict(term_id,class_id) do update set
    daily_rate=excluded.daily_rate,
    weekly_rate=excluded.weekly_rate,
    monthly_rate=excluded.monthly_rate,
    termly_rate=excluded.termly_rate,
    status=excluded.status,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.resync_student_feeding(
  p_student_id uuid,
  p_term_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $
begin
  -- Replaced with the full implementation later in this migration.
  return;
end;
$;

create or replace function public.save_student_feeding_plan(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_student public.students%rowtype;
  v_term uuid;
  v_year uuid;
  v_frequency text;
  v_staff uuid;
  v_exemption text;
  v_id uuid;
  v_role public.app_role;
begin
  if public.current_app_role() not in ('admin','supervisor','accountant','clerk') then
    raise exception 'Feeding plan access is required';
  end if;

  v_school:=public.current_school_id();
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_frequency:=coalesce(nullif(lower(trim(p_payload->>'frequency')),''),'daily');
  v_staff:=nullif(p_payload->>'related_staff_id','')::uuid;

  if v_frequency not in ('daily','weekly','monthly','termly','exempt') then
    raise exception 'Invalid feeding frequency';
  end if;

  select * into v_student
  from public.students
  where id=nullif(p_payload->>'student_id','')::uuid
    and school_id=v_school
    and status='active';
  if v_student.id is null then raise exception 'Choose an active student'; end if;

  select academic_year_id into v_year
  from public.terms where id=v_term and school_id=v_school;
  if v_year is null then raise exception 'Choose a valid term'; end if;

  if v_frequency='exempt' then
    if v_staff is not null then
      select role into v_role from public.staff
      where id=v_staff and school_id=v_school and status='active';
      if v_role is null then raise exception 'Choose a valid staff member for the exemption'; end if;
      v_exemption:=case when v_role in ('admin','supervisor') then 'management_child' else 'staff_child' end;
    else
      v_exemption:='other';
    end if;
  else
    v_staff:=null;
    v_exemption:=null;
  end if;

  insert into public.student_feeding_plans(
    school_id,academic_year_id,term_id,student_id,frequency,exemption_type,
    related_staff_id,status,notes,updated_by
  ) values(
    v_school,v_year,v_term,v_student.id,v_frequency,v_exemption,v_staff,
    coalesce(nullif(p_payload->>'status',''),'active'),
    nullif(trim(coalesce(p_payload->>'notes','')),''),
    auth.uid()
  )
  on conflict(term_id,student_id) do update set
    frequency=excluded.frequency,
    exemption_type=excluded.exemption_type,
    related_staff_id=excluded.related_staff_id,
    status=excluded.status,
    notes=excluded.notes,
    updated_by=auth.uid(),
    updated_at=now()
  returning id into v_id;

  perform public.resync_student_feeding(v_student.id,v_term);
  return v_id;
end;
$$;

-- Declared before payment/attendance sync callers; implementation follows.
create or replace function public.resync_student_feeding(
  p_student_id uuid,
  p_term_id uuid
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_frequency text;
  v_exempt boolean;
  v_credit numeric := 0;
  r record;
  v_rate numeric;
begin
  v_school:=public.current_school_id();

  select frequency into v_frequency
  from public.student_feeding_plans
  where school_id=v_school
    and student_id=p_student_id
    and term_id=p_term_id
    and status='active';

  v_exempt:=coalesce(v_frequency='exempt',false);

  delete from public.feeding_wallet_entries
  where school_id=v_school
    and student_id=p_student_id
    and term_id=p_term_id
    and entry_type='charge';

  select coalesce(sum(amount),0) into v_credit
  from public.feeding_wallet_entries
  where school_id=v_school
    and student_id=p_student_id
    and term_id=p_term_id
    and entry_type in ('payment','adjustment','refund');

  if v_exempt then return; end if;

  for r in
    select
      ar.id attendance_record_id,
      ar.status,
      s.attendance_date,
      s.class_id
    from public.attendance_records ar
    join public.attendance_sessions s on s.id=ar.session_id
    where ar.school_id=v_school
      and ar.student_id=p_student_id
      and s.term_id=p_term_id
      and s.mode='daily'
      and extract(isodow from s.attendance_date)::integer between 1 and 4
    order by s.attendance_date,ar.created_at
  loop
    if r.status in ('present','late') then
      select daily_rate into v_rate
      from public.feeding_rates
      where school_id=v_school
        and term_id=p_term_id
        and class_id=r.class_id
        and status='active'
      limit 1;

      v_rate:=coalesce(v_rate,0);

      if v_rate>0 and v_credit>=v_rate then
        insert into public.feeding_wallet_entries(
          school_id,academic_year_id,term_id,student_id,entry_date,entry_type,
          amount,attendance_record_id,description,created_by
        )
        select
          v_school,t.academic_year_id,p_term_id,p_student_id,r.attendance_date,
          'charge',-v_rate,r.attendance_record_id,
          'Feeding charge - '||r.attendance_date::text,auth.uid()
        from public.terms t where t.id=p_term_id;
        v_credit:=v_credit-v_rate;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.record_feeding_payment(
  p_student_id uuid,
  p_term_id uuid,
  p_frequency text,
  p_payment_date date default current_date,
  p_payment_method text default null,
  p_reference text default null,
  p_remarks text default null,
  p_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_class uuid;
  v_amount numeric;
  v_id uuid;
  v_receipt text;
  v_counter bigint;
  v_start date;
  v_end date;
  v_label text;
begin
  if public.current_app_role() not in ('admin','supervisor','accountant','clerk') then
    raise exception 'Feeding payment access is required';
  end if;

  v_school:=public.current_school_id();

  select st.class_id,t.academic_year_id
  into v_class,v_year
  from public.students st
  join public.terms t on t.id=p_term_id
  where st.id=p_student_id and st.school_id=v_school and st.status='active'
    and t.school_id=v_school;

  if v_class is null or v_year is null then raise exception 'Choose a valid student and term'; end if;
  if p_frequency not in ('daily','weekly','monthly','termly') then raise exception 'Invalid feeding frequency'; end if;

  if exists(
    select 1 from public.student_feeding_plans
    where term_id=p_term_id and student_id=p_student_id
      and frequency='exempt' and status='active'
  ) then raise exception 'This student is exempt from feeding fees'; end if;

  v_amount:=coalesce(
    p_amount,
    public.feeding_frequency_rate(v_class,p_term_id,p_frequency)
  );
  if coalesce(v_amount,0)<=0 then raise exception 'Configure a feeding rate before recording payment'; end if;

  v_start:=coalesce(p_payment_date,current_date);
  v_end:=case p_frequency
    when 'daily' then v_start
    when 'weekly' then v_start+6
    when 'monthly' then (v_start+interval '1 month - 1 day')::date
    when 'termly' then (select ends_on from public.terms where id=p_term_id)
  end;
  v_label:=case p_frequency
    when 'daily' then v_start::text
    when 'weekly' then 'Week from '||v_start::text
    when 'monthly' then to_char(v_start,'FMMonth YYYY')
    when 'termly' then (select name from public.terms where id=p_term_id)
  end;

  insert into public.student_feeding_plans(
    school_id,academic_year_id,term_id,student_id,frequency,status,updated_by
  ) values(v_school,v_year,p_term_id,p_student_id,p_frequency,'active',auth.uid())
  on conflict(term_id,student_id) do update set
    frequency=excluded.frequency,
    exemption_type=null,
    related_staff_id=null,
    status='active',
    updated_by=auth.uid(),
    updated_at=now();

  v_counter:=public.atis_take_counter(v_school,'feeding_receipt');
  v_receipt:='ATIS-FD-'||to_char(coalesce(p_payment_date,current_date),'YYYYMMDD')||
    '-'||lpad(v_counter::text,4,'0');

  insert into public.feeding_payments(
    school_id,academic_year_id,term_id,student_id,frequency,coverage_label,
    coverage_start,coverage_end,amount,payment_date,payment_method,receipt_no,
    reference,recorded_by,remarks
  ) values(
    v_school,v_year,p_term_id,p_student_id,p_frequency,v_label,v_start,v_end,
    v_amount,coalesce(p_payment_date,current_date),nullif(trim(p_payment_method),''),
    v_receipt,nullif(trim(p_reference),''),auth.uid(),nullif(trim(p_remarks),'')
  )
  returning id into v_id;

  insert into public.feeding_wallet_entries(
    school_id,academic_year_id,term_id,student_id,entry_date,entry_type,
    amount,payment_id,description,created_by
  ) values(
    v_school,v_year,p_term_id,p_student_id,coalesce(p_payment_date,current_date),
    'payment',v_amount,v_id,'Feeding payment - '||v_label,auth.uid()
  );

  perform public.resync_student_feeding(p_student_id,p_term_id);

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values(
    v_school,auth.uid(),'Feeding Payment Recorded','feeding_payment',v_id,
    jsonb_build_object('student_id',p_student_id,'frequency',p_frequency,'amount',v_amount,'receipt_no',v_receipt)
  );

  return v_id;
end;
$$;

create or replace function public.sync_feeding_after_attendance()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_student uuid;
  v_term uuid;
begin
  if tg_op='DELETE' then
    v_student:=old.student_id;
    select term_id into v_term from public.attendance_sessions where id=old.session_id;
  else
    v_student:=new.student_id;
    select term_id into v_term from public.attendance_sessions where id=new.session_id;
  end if;

  if v_student is not null and v_term is not null then
    perform public.resync_student_feeding(v_student,v_term);
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$;

drop trigger if exists sync_feeding_on_attendance_change on public.attendance_records;
create trigger sync_feeding_on_attendance_change
after insert or update or delete on public.attendance_records
for each row execute function public.sync_feeding_after_attendance();

create or replace view public.feeding_student_balance
with (security_invoker=true)
as
select
  st.school_id,
  p.term_id,
  st.id student_id,
  st.admission_number,
  st.first_name,
  st.middle_name,
  st.last_name,
  st.class_id,
  c.class_name,
  c.section,
  coalesce(p.frequency,'daily') frequency,
  p.exemption_type,
  p.related_staff_id,
  coalesce(sum(e.amount) filter (where e.entry_type='payment'),0)::numeric(12,2) total_paid,
  abs(coalesce(sum(e.amount) filter (where e.entry_type='charge'),0))::numeric(12,2) total_charged,
  coalesce(sum(e.amount),0)::numeric(12,2) credit_balance
from public.students st
join public.classes c on c.id=st.class_id
join public.terms t on t.school_id=st.school_id and t.is_current=true
left join public.student_feeding_plans p on p.student_id=st.id and p.term_id=t.id and p.status='active'
left join public.feeding_wallet_entries e on e.student_id=st.id and e.term_id=t.id
where st.status='active'
group by st.school_id,p.term_id,t.id,st.id,c.id,p.id;

grant select on public.feeding_student_balance to authenticated;

create or replace view public.feeding_daily_register
with (security_invoker=true)
as
select
  ar.id attendance_record_id,
  s.school_id,
  s.academic_year_id,
  s.term_id,
  s.attendance_date feeding_date,
  s.class_id,
  c.class_name,
  c.section,
  ar.student_id,
  st.admission_number,
  st.first_name,
  st.middle_name,
  st.last_name,
  ar.status attendance_status,
  coalesce(fp.frequency,'daily') plan_frequency,
  fp.exemption_type,
  fr.daily_rate,
  case
    when fp.frequency='exempt' then 'exempt'
    when ar.status not in ('present','late') then
      case when coalesce(b.credit_balance,0)>0 then 'credit_carried_forward' else 'absent' end
    when ch.id is not null then 'paid'
    else 'unpaid'
  end payment_mark,
  case when ch.id is not null then abs(ch.amount) else 0 end::numeric(12,2) daily_charge,
  coalesce(b.credit_balance,0)::numeric(12,2) credit_balance,
  st.dietary_requirements,
  st.allergies
from public.attendance_records ar
join public.attendance_sessions s on s.id=ar.session_id and s.mode='daily'
join public.students st on st.id=ar.student_id
join public.classes c on c.id=s.class_id
left join public.student_feeding_plans fp
  on fp.student_id=ar.student_id and fp.term_id=s.term_id and fp.status='active'
left join public.feeding_rates fr
  on fr.class_id=s.class_id and fr.term_id=s.term_id and fr.status='active'
left join public.feeding_wallet_entries ch
  on ch.attendance_record_id=ar.id and ch.entry_type='charge'
left join public.feeding_student_balance b
  on b.student_id=ar.student_id and b.term_id=s.term_id
where extract(isodow from s.attendance_date)::integer between 1 and 4;

grant select on public.feeding_daily_register to authenticated;

-- Seed current-term legacy rates where a current term exists and rates are absent.
insert into public.feeding_rates(
  school_id,academic_year_id,term_id,class_id,daily_rate,weekly_rate,monthly_rate,termly_rate,status,notes
)
select
  c.school_id,t.academic_year_id,t.id,c.id,4,16,64,236,'active','Migrated from ATIS Google Script feeding structure'
from public.classes c
join public.terms t on t.school_id=c.school_id and t.academic_year_id=c.academic_year_id and t.is_current=true
where c.is_active=true
on conflict(term_id,class_id) do nothing;

-- ===========================================================================
-- PAYROLL: categories, profiles, automatic allowances, attendance and loans
-- ===========================================================================

create table if not exists public.payroll_settings (
  school_id uuid not null references public.schools(id) on delete cascade,
  key text not null,
  value numeric(12,2) not null,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(school_id,key)
);

create table if not exists public.payroll_categories (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  category_name citext not null,
  base_pay numeric(12,2) not null default 0 check (base_pay>=0),
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,category_name)
);

create table if not exists public.payroll_profiles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null unique references public.staff(id) on delete cascade,
  category_id uuid references public.payroll_categories(id) on delete set null,
  base_pay_override numeric(12,2) check (base_pay_override is null or base_pay_override>=0),
  ssnit_enabled boolean not null default true,
  ssnit_rate_override numeric(6,3) check (ssnit_rate_override is null or ssnit_rate_override between 0 and 100),
  early_allowance_eligible boolean not null default true,
  long_service_eligible boolean not null default true,
  active boolean not null default true,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payroll_allowance_types (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name citext not null,
  calculation_type text not null
    check (calculation_type in ('fixed','percentage_base','system_early','system_long_service')),
  default_amount numeric(12,2) not null default 0 check(default_amount>=0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,name)
);

create table if not exists public.staff_allowances (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  allowance_type_id uuid not null references public.payroll_allowance_types(id) on delete cascade,
  amount numeric(12,2),
  active boolean not null default true,
  effective_from date,
  effective_to date,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_loans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  loan_name text not null,
  principal numeric(12,2) not null check(principal>0),
  monthly_deduction numeric(12,2) not null check(monthly_deduction>0),
  amount_paid numeric(12,2) not null default 0 check(amount_paid>=0),
  balance numeric(12,2) not null check(balance>=0),
  start_month date not null,
  status text not null default 'active' check(status in ('active','cleared','cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(start_month=date_trunc('month',start_month)::date)
);

create table if not exists public.staff_loan_repayments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  loan_id uuid not null references public.staff_loans(id) on delete cascade,
  payroll_run_id uuid references public.payroll_runs(id) on delete set null,
  payroll_item_id uuid references public.payroll_items(id) on delete set null,
  amount numeric(12,2) not null check(amount>0),
  repayment_date date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(loan_id,payroll_run_id)
);

create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  attendance_date date not null,
  check_in_time time,
  check_out_time time,
  early boolean not null default false,
  status text not null default 'present' check(status in ('present','absent','leave','sick','official')),
  source text not null default 'manual',
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id,attendance_date)
);

alter table public.payroll_items
  add column if not exists automatic_allowances numeric(12,2) not null default 0,
  add column if not exists other_allowances numeric(12,2) not null default 0,
  add column if not exists ssnit_deduction numeric(12,2) not null default 0,
  add column if not exists loan_deduction numeric(12,2) not null default 0,
  add column if not exists other_deductions numeric(12,2) not null default 0,
  add column if not exists loan_details jsonb not null default '[]'::jsonb,
  add column if not exists early_days integer not null default 0,
  add column if not exists total_attendance integer not null default 0,
  add column if not exists service_years integer not null default 0;

drop trigger if exists set_payroll_categories_updated_at on public.payroll_categories;
create trigger set_payroll_categories_updated_at before update on public.payroll_categories
for each row execute function public.set_updated_at();
drop trigger if exists set_payroll_profiles_updated_at on public.payroll_profiles;
create trigger set_payroll_profiles_updated_at before update on public.payroll_profiles
for each row execute function public.set_updated_at();
drop trigger if exists set_payroll_allowance_types_updated_at on public.payroll_allowance_types;
create trigger set_payroll_allowance_types_updated_at before update on public.payroll_allowance_types
for each row execute function public.set_updated_at();
drop trigger if exists set_staff_allowances_updated_at on public.staff_allowances;
create trigger set_staff_allowances_updated_at before update on public.staff_allowances
for each row execute function public.set_updated_at();
drop trigger if exists set_staff_loans_updated_at on public.staff_loans;
create trigger set_staff_loans_updated_at before update on public.staff_loans
for each row execute function public.set_updated_at();
drop trigger if exists set_staff_attendance_updated_at on public.staff_attendance;
create trigger set_staff_attendance_updated_at before update on public.staff_attendance
for each row execute function public.set_updated_at();

alter table public.payroll_settings enable row level security;
alter table public.payroll_categories enable row level security;
alter table public.payroll_profiles enable row level security;
alter table public.payroll_allowance_types enable row level security;
alter table public.staff_allowances enable row level security;
alter table public.staff_loans enable row level security;
alter table public.staff_loan_repayments enable row level security;
alter table public.staff_attendance enable row level security;

revoke all on table public.payroll_settings,public.payroll_categories,public.payroll_profiles,
  public.payroll_allowance_types,public.staff_allowances,public.staff_loans,
  public.staff_loan_repayments,public.staff_attendance from anon,authenticated;
grant select on table public.payroll_settings,public.payroll_categories,public.payroll_profiles,
  public.payroll_allowance_types,public.staff_allowances,public.staff_loans,
  public.staff_loan_repayments,public.staff_attendance to authenticated;

drop policy if exists payroll_settings_read on public.payroll_settings;
create policy payroll_settings_read on public.payroll_settings for select to authenticated
using(school_id=public.current_school_id() and public.is_payroll_finance_user());
drop policy if exists payroll_categories_read on public.payroll_categories;
create policy payroll_categories_read on public.payroll_categories for select to authenticated
using(school_id=public.current_school_id() and public.is_payroll_finance_user());
drop policy if exists payroll_profiles_read on public.payroll_profiles;
create policy payroll_profiles_read on public.payroll_profiles for select to authenticated
using(school_id=public.current_school_id() and (public.is_payroll_finance_user() or staff_id=public.current_staff_id()));
drop policy if exists payroll_allowance_types_read on public.payroll_allowance_types;
create policy payroll_allowance_types_read on public.payroll_allowance_types for select to authenticated
using(school_id=public.current_school_id() and public.is_payroll_finance_user());
drop policy if exists staff_allowances_read on public.staff_allowances;
create policy staff_allowances_read on public.staff_allowances for select to authenticated
using(school_id=public.current_school_id() and (public.is_payroll_finance_user() or staff_id=public.current_staff_id()));
drop policy if exists staff_loans_read on public.staff_loans;
create policy staff_loans_read on public.staff_loans for select to authenticated
using(school_id=public.current_school_id() and (public.is_payroll_finance_user() or staff_id=public.current_staff_id()));
drop policy if exists staff_loan_repayments_read on public.staff_loan_repayments;
create policy staff_loan_repayments_read on public.staff_loan_repayments for select to authenticated
using(school_id=public.current_school_id() and (public.is_payroll_finance_user() or exists(
  select 1 from public.staff_loans l where l.id=loan_id and l.staff_id=public.current_staff_id()
)));
drop policy if exists staff_attendance_read on public.staff_attendance;
create policy staff_attendance_read on public.staff_attendance for select to authenticated
using(school_id=public.current_school_id() and (public.is_payroll_finance_user() or staff_id=public.current_staff_id()));

-- Seed legacy payroll settings.
insert into public.payroll_settings(school_id,key,value,description)
select id,'EMPLOYEE_SSNIT_RATE',20,'Default employee SSNIT deduction rate (%) - configurable' from public.schools
on conflict(school_id,key) do nothing;
insert into public.payroll_settings(school_id,key,value,description)
select id,'EARLY_ALLOWANCE_AMOUNT',50,'Monthly early-attendance allowance' from public.schools
on conflict(school_id,key) do nothing;
insert into public.payroll_settings(school_id,key,value,description)
select id,'EARLY_ALLOWANCE_MIN_DAYS',15,'Minimum qualifying early-attendance days in a payroll month' from public.schools
on conflict(school_id,key) do nothing;
insert into public.payroll_settings(school_id,key,value,description)
select id,'LONG_SERVICE_PER_YEAR',10,'Long-service allowance per completed year' from public.schools
on conflict(school_id,key) do nothing;

insert into public.payroll_allowance_types(school_id,name,calculation_type,default_amount,notes)
select id,'Early Attendance Allowance','system_early',50,'Automatic when early-day threshold is met' from public.schools
on conflict(school_id,name) do nothing;
insert into public.payroll_allowance_types(school_id,name,calculation_type,default_amount,notes)
select id,'Long Service Allowance','system_long_service',10,'Automatic amount per completed year of service' from public.schools
on conflict(school_id,name) do nothing;

-- Derive initial categories from current staff contracts.
insert into public.payroll_categories(school_id,category_name,base_pay,notes)
select
  c.school_id,
  coalesce(nullif(trim(c.position_title),''),'General Staff') category_name,
  max(c.base_salary) base_pay,
  'Initialized from staff contract categories'
from public.staff_contracts c
where c.status in ('active','non_renewed')
group by c.school_id,coalesce(nullif(trim(c.position_title),''),'General Staff')
on conflict(school_id,category_name) do nothing;

insert into public.payroll_profiles(
  school_id,staff_id,category_id,ssnit_enabled,early_allowance_eligible,long_service_eligible,active
)
select
  s.school_id,
  s.id,
  pc.id,
  true,true,true,true
from public.staff s
left join lateral (
  select c.position_title
  from public.staff_contracts c
  where c.staff_id=s.id and c.status in ('active','non_renewed')
  order by c.start_date desc limit 1
) cc on true
left join public.payroll_categories pc
  on pc.school_id=s.school_id
 and lower(pc.category_name::text)=lower(coalesce(nullif(trim(cc.position_title),''),'General Staff'))
where s.status='active'
on conflict(staff_id) do nothing;

create or replace function public.save_payroll_setting(
  p_key text,
  p_value numeric,
  p_description text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $
begin
  if public.current_app_role() not in ('admin','supervisor') then raise exception 'Not authorized'; end if;
  if nullif(trim(p_key),'') is null then raise exception 'Setting key is required'; end if;
  if p_value is null or p_value<0 then raise exception 'Setting value must be zero or greater'; end if;

  insert into public.payroll_settings(school_id,key,value,description,updated_by)
  values(public.current_school_id(),upper(trim(p_key)),p_value,nullif(trim(coalesce(p_description,'')),''),auth.uid())
  on conflict(school_id,key) do update set
    value=excluded.value,
    description=coalesce(excluded.description,public.payroll_settings.description),
    updated_by=auth.uid(),
    updated_at=now();
end;
$;

create or replace function public.save_payroll_allowance_type(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $
declare v_school uuid; v_id uuid; v_type text; v_name text;
begin
  if public.current_app_role() not in ('admin','supervisor') then raise exception 'Not authorized'; end if;
  v_school:=public.current_school_id();
  v_name:=nullif(trim(p_payload->>'name'),'');
  v_type:=coalesce(nullif(trim(p_payload->>'calculation_type'),''),'fixed');
  if v_name is null then raise exception 'Allowance name is required'; end if;
  if v_type not in ('fixed','percentage_base','system_early','system_long_service') then
    raise exception 'Invalid allowance calculation type';
  end if;

  insert into public.payroll_allowance_types(
    school_id,name,calculation_type,default_amount,active,notes
  ) values(
    v_school,v_name,v_type,
    greatest(coalesce(nullif(p_payload->>'default_amount','')::numeric,0),0),
    coalesce((p_payload->>'active')::boolean,true),
    nullif(trim(coalesce(p_payload->>'notes','')),'')
  )
  on conflict(school_id,name) do update set
    calculation_type=excluded.calculation_type,
    default_amount=excluded.default_amount,
    active=excluded.active,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$;

create or replace function public.save_payroll_category(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_school uuid; v_id uuid; v_name text; v_pay numeric;
begin
  if public.current_app_role() not in ('admin','supervisor') then raise exception 'Not authorized'; end if;
  v_school:=public.current_school_id();
  v_name:=nullif(trim(p_payload->>'category_name'),'');
  v_pay:=nullif(p_payload->>'base_pay','')::numeric;
  if v_name is null then raise exception 'Category name is required'; end if;
  if v_pay is null or v_pay<0 then raise exception 'Enter a valid base pay'; end if;

  insert into public.payroll_categories(school_id,category_name,base_pay,active,notes,created_by)
  values(v_school,v_name,v_pay,coalesce((p_payload->>'active')::boolean,true),
    nullif(trim(coalesce(p_payload->>'notes','')),''),auth.uid())
  on conflict(school_id,category_name) do update set
    base_pay=excluded.base_pay,active=excluded.active,notes=excluded.notes,updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_payroll_profile(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_school uuid; v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then raise exception 'Not authorized'; end if;
  v_school:=public.current_school_id();

  insert into public.payroll_profiles(
    school_id,staff_id,category_id,base_pay_override,ssnit_enabled,ssnit_rate_override,
    early_allowance_eligible,long_service_eligible,active,notes,updated_by
  ) values(
    v_school,(p_payload->>'staff_id')::uuid,nullif(p_payload->>'category_id','')::uuid,
    nullif(p_payload->>'base_pay_override','')::numeric,
    coalesce((p_payload->>'ssnit_enabled')::boolean,true),
    nullif(p_payload->>'ssnit_rate_override','')::numeric,
    coalesce((p_payload->>'early_allowance_eligible')::boolean,true),
    coalesce((p_payload->>'long_service_eligible')::boolean,true),
    coalesce((p_payload->>'active')::boolean,true),
    nullif(trim(coalesce(p_payload->>'notes','')),''),auth.uid()
  )
  on conflict(staff_id) do update set
    category_id=excluded.category_id,
    base_pay_override=excluded.base_pay_override,
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

create or replace function public.save_staff_allowance(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_school uuid; v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then raise exception 'Not authorized'; end if;
  v_school:=public.current_school_id();

  insert into public.staff_allowances(
    school_id,staff_id,allowance_type_id,amount,active,effective_from,effective_to,notes,updated_by
  ) values(
    v_school,(p_payload->>'staff_id')::uuid,(p_payload->>'allowance_type_id')::uuid,
    nullif(p_payload->>'amount','')::numeric,
    coalesce((p_payload->>'active')::boolean,true),
    nullif(p_payload->>'effective_from','')::date,
    nullif(p_payload->>'effective_to','')::date,
    nullif(trim(coalesce(p_payload->>'notes','')),''),auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_staff_loan(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_school uuid; v_id uuid; v_principal numeric; v_monthly numeric; v_start date;
begin
  if public.current_app_role() not in ('admin','supervisor','accountant') then raise exception 'Not authorized'; end if;
  v_school:=public.current_school_id();
  v_principal:=(p_payload->>'principal')::numeric;
  v_monthly:=(p_payload->>'monthly_deduction')::numeric;
  v_start:=date_trunc('month',(p_payload->>'start_month')::date)::date;
  if v_principal<=0 or v_monthly<=0 then raise exception 'Loan amounts must be greater than zero'; end if;

  insert into public.staff_loans(
    school_id,staff_id,loan_name,principal,monthly_deduction,amount_paid,balance,
    start_month,status,notes,created_by
  ) values(
    v_school,(p_payload->>'staff_id')::uuid,trim(p_payload->>'loan_name'),
    v_principal,v_monthly,0,v_principal,v_start,'active',
    nullif(trim(coalesce(p_payload->>'notes','')),''),auth.uid()
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_staff_attendance(
  p_staff_id uuid,
  p_attendance_date date,
  p_check_in_time time,
  p_status text default 'present',
  p_early boolean default false,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_school uuid; v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then raise exception 'Not authorized'; end if;
  v_school:=public.current_school_id();

  insert into public.staff_attendance(
    school_id,staff_id,attendance_date,check_in_time,early,status,source,notes,recorded_by
  ) values(
    v_school,p_staff_id,p_attendance_date,p_check_in_time,coalesce(p_early,false),
    coalesce(nullif(p_status,''),'present'),'manual',
    nullif(trim(coalesce(p_notes,'')),''),auth.uid()
  )
  on conflict(staff_id,attendance_date) do update set
    check_in_time=excluded.check_in_time,
    early=excluded.early,
    status=excluded.status,
    notes=excluded.notes,
    recorded_by=auth.uid(),
    updated_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

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
  v_count integer:=0;
  v_early_min numeric;
  v_early_amount numeric;
  v_long_rate numeric;
  v_default_ssnit numeric;
  r record;
  v_base numeric;
  v_auto_allow numeric;
  v_fixed_allow numeric;
  v_early_days integer;
  v_total_att integer;
  v_years integer;
  v_ssnit numeric;
  v_loan numeric;
  v_loan_json jsonb;
  v_allow_json jsonb;
  v_deduct_json jsonb;
begin
  if not public.is_payroll_finance_user() then raise exception 'Payroll access is required'; end if;
  v_school:=public.current_school_id();
  if p_payroll_month is null then raise exception 'Choose a payroll month'; end if;
  v_month:=date_trunc('month',p_payroll_month)::date;
  v_month_end:=(v_month+interval '1 month - 1 day')::date;

  if exists(select 1 from public.payroll_runs where school_id=v_school and payroll_month=v_month and status<>'cancelled') then
    raise exception 'A payroll run already exists for this month';
  end if;

  select coalesce(max(value) filter(where key='EARLY_ALLOWANCE_MIN_DAYS'),15),
         coalesce(max(value) filter(where key='EARLY_ALLOWANCE_AMOUNT'),50),
         coalesce(max(value) filter(where key='LONG_SERVICE_PER_YEAR'),10),
         coalesce(max(value) filter(where key='EMPLOYEE_SSNIT_RATE'),0)
  into v_early_min,v_early_amount,v_long_rate,v_default_ssnit
  from public.payroll_settings where school_id=v_school;

  v_counter:=public.atis_take_counter(v_school,'payroll_run');
  v_run_no:='ATIS-PR-'||to_char(v_month,'YYYYMM')||'-'||lpad(v_counter::text,3,'0');

  insert into public.payroll_runs(school_id,run_no,payroll_month,title,status,notes,created_by)
  values(v_school,v_run_no,v_month,'Payroll - '||to_char(v_month,'FMMonth YYYY'),'draft',
    nullif(trim(coalesce(p_notes,'')),''),auth.uid())
  returning id into v_id;

  for r in
    select
      s.id staff_id,s.full_name,s.joining_date,
      pp.id profile_id,pp.base_pay_override,pp.ssnit_enabled,pp.ssnit_rate_override,
      pp.early_allowance_eligible,pp.long_service_eligible,
      pc.base_pay category_base
    from public.staff s
    join public.payroll_profiles pp on pp.staff_id=s.id and pp.active=true
    left join public.payroll_categories pc on pc.id=pp.category_id
    where s.school_id=v_school and s.status='active'
  loop
    v_base:=coalesce(r.base_pay_override,r.category_base,0);

    select count(*) filter(where early=true and status='present'),
           count(*) filter(where status='present')
    into v_early_days,v_total_att
    from public.staff_attendance
    where staff_id=r.staff_id and attendance_date between v_month and v_month_end;

    v_years:=greatest(
      extract(year from age(v_month_end,coalesce(r.joining_date,v_month_end)))::integer,
      0
    );

    v_allow_json:='[]'::jsonb;
    v_auto_allow:=0;

    if r.early_allowance_eligible and v_early_days>=v_early_min then
      v_auto_allow:=v_auto_allow+v_early_amount;
      v_allow_json:=v_allow_json||jsonb_build_array(jsonb_build_object(
        'type','system_early','name','Early Attendance Allowance','amount',v_early_amount,
        'detail',v_early_days||' qualifying early day(s) out of '||v_total_att||' attendance day(s)'
      ));
    end if;

    if r.long_service_eligible and v_years>0 then
      v_auto_allow:=v_auto_allow+(v_years*v_long_rate);
      v_allow_json:=v_allow_json||jsonb_build_array(jsonb_build_object(
        'type','system_long_service','name','Long Service Allowance',
        'amount',v_years*v_long_rate,'detail',v_years||' completed year(s)'
      ));
    end if;

    select
      coalesce(sum(
        case at.calculation_type
          when 'percentage_base' then v_base*coalesce(sa.amount,at.default_amount)/100.0
          else coalesce(sa.amount,at.default_amount)
        end
      ),0),
      coalesce(jsonb_agg(jsonb_build_object(
        'type',at.calculation_type,'name',at.name,
        'amount',case at.calculation_type
          when 'percentage_base' then v_base*coalesce(sa.amount,at.default_amount)/100.0
          else coalesce(sa.amount,at.default_amount)
        end
      )) filter(where sa.id is not null),'[]'::jsonb)
    into v_fixed_allow,v_allow_json
    from public.staff_allowances sa
    join public.payroll_allowance_types at on at.id=sa.allowance_type_id
    where sa.staff_id=r.staff_id
      and sa.active=true and at.active=true
      and at.calculation_type in ('fixed','percentage_base')
      and (sa.effective_from is null or sa.effective_from<=v_month_end)
      and (sa.effective_to is null or sa.effective_to>=v_month);

    -- Re-add system allowances after aggregation.
    if r.early_allowance_eligible and v_early_days>=v_early_min then
      v_allow_json:=v_allow_json||jsonb_build_array(jsonb_build_object(
        'type','system_early','name','Early Attendance Allowance','amount',v_early_amount,
        'detail',v_early_days||' qualifying early day(s) out of '||v_total_att||' attendance day(s)'
      ));
    end if;
    if r.long_service_eligible and v_years>0 then
      v_allow_json:=v_allow_json||jsonb_build_array(jsonb_build_object(
        'type','system_long_service','name','Long Service Allowance',
        'amount',v_years*v_long_rate,'detail',v_years||' completed year(s)'
      ));
    end if;

    v_auto_allow:=v_auto_allow+v_fixed_allow;

    v_ssnit:=case when r.ssnit_enabled then
      round(v_base*coalesce(r.ssnit_rate_override,v_default_ssnit)/100.0,2)
      else 0 end;

    select
      coalesce(sum(least(l.monthly_deduction,l.balance)),0),
      coalesce(jsonb_agg(jsonb_build_object(
        'loanId',l.id,'name',l.loan_name,'deduction',least(l.monthly_deduction,l.balance),
        'balanceBefore',l.balance,'balanceAfter',greatest(l.balance-least(l.monthly_deduction,l.balance),0)
      )) filter(where l.id is not null),'[]'::jsonb)
    into v_loan,v_loan_json
    from public.staff_loans l
    where l.staff_id=r.staff_id
      and l.status='active'
      and l.start_month<=v_month
      and l.balance>0;

    v_deduct_json:='[]'::jsonb;
    if v_ssnit>0 then
      v_deduct_json:=v_deduct_json||jsonb_build_array(jsonb_build_object(
        'type','ssnit','name','SSNIT / Statutory Deduction','amount',v_ssnit
      ));
    end if;
    if v_loan>0 then
      v_deduct_json:=v_deduct_json||v_loan_json;
    end if;

    insert into public.payroll_items(
      school_id,payroll_run_id,staff_id,base_salary,allowances,deductions,
      allowance_details,deduction_details,automatic_allowances,other_allowances,
      ssnit_deduction,loan_deduction,other_deductions,loan_details,
      early_days,total_attendance,service_years
    ) values(
      v_school,v_id,r.staff_id,v_base,v_auto_allow,v_ssnit+v_loan,
      v_allow_json,v_deduct_json,v_auto_allow,0,v_ssnit,v_loan,0,v_loan_json,
      v_early_days,v_total_att,v_years
    );
    v_count:=v_count+1;
  end loop;

  if v_count=0 then
    delete from public.payroll_runs where id=v_id;
    raise exception 'No active payroll profiles were found';
  end if;

  insert into public.audit_logs(school_id,actor_user_id,action,entity_type,entity_id,details)
  values(v_school,auth.uid(),'Payroll Run Created','payroll_run',v_id,
    jsonb_build_object('run_no',v_run_no,'payroll_month',v_month,'staff_count',v_count));

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
  v_status text;
  v_auto_allow numeric;
  v_ssnit numeric;
  v_loan numeric;
  v_base numeric;
begin
  if not public.is_payroll_finance_user() then raise exception 'Payroll access is required'; end if;
  v_school:=public.current_school_id();

  select pr.status,pi.automatic_allowances,pi.ssnit_deduction,pi.loan_deduction,pi.base_salary
  into v_status,v_auto_allow,v_ssnit,v_loan,v_base
  from public.payroll_items pi
  join public.payroll_runs pr on pr.id=pi.payroll_run_id
  where pi.id=p_item_id and pi.school_id=v_school
  for update of pi;

  if v_status is null then raise exception 'Payroll item not found'; end if;
  if v_status<>'draft' then raise exception 'Only Draft payroll can be edited'; end if;

  update public.payroll_items
  set
    other_allowances=greatest(coalesce(p_allowances,0),0),
    other_deductions=greatest(coalesce(p_deductions,0),0),
    allowances=v_auto_allow+greatest(coalesce(p_allowances,0),0),
    deductions=v_ssnit+v_loan+greatest(coalesce(p_deductions,0),0),
    allowance_details=
      jsonb_path_query_array(coalesce(allowance_details,'[]'::jsonb), '$[*] ? (@.type != "manual")')
      || coalesce(p_allowance_details,'[]'::jsonb),
    deduction_details=
      jsonb_path_query_array(coalesce(deduction_details,'[]'::jsonb), '$[*] ? (@.type != "manual")')
      || coalesce(p_deduction_details,'[]'::jsonb),
    remarks=nullif(trim(coalesce(p_remarks,'')),''),
    updated_at=now()
  where id=p_item_id;

  if exists(
    select 1 from public.payroll_items
    where id=p_item_id and deductions>base_salary+allowances
  ) then raise exception 'Deductions cannot exceed gross pay'; end if;
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
  r record;
  v_deduct numeric;
  v_loan_json jsonb;
  v_repayment uuid;
begin
  if not public.is_payroll_finance_user() then raise exception 'Payroll access is required'; end if;
  v_school:=public.current_school_id();

  select * into v_run from public.payroll_runs
  where id=p_run_id and school_id=v_school for update;
  if v_run.id is null then raise exception 'Payroll run not found'; end if;
  if v_run.status<>'approved' then raise exception 'Payroll must be approved before payment'; end if;

  select coalesce(sum(base_salary+allowances-deductions),0) into v_total
  from public.payroll_items where payroll_run_id=p_run_id;

  for r in
    select pi.id item_id,pi.loan_details
    from public.payroll_items pi
    where pi.payroll_run_id=p_run_id and jsonb_array_length(pi.loan_details)>0
  loop
    for v_loan_json in select * from jsonb_array_elements(r.loan_details)
    loop
      v_deduct:=(v_loan_json->>'deduction')::numeric;

      v_repayment:=null;
      insert into public.staff_loan_repayments(
        school_id,loan_id,payroll_run_id,payroll_item_id,amount,repayment_date,created_by
      ) values(
        v_school,(v_loan_json->>'loanId')::uuid,p_run_id,r.item_id,v_deduct,p_pay_date,auth.uid()
      )
      on conflict(loan_id,payroll_run_id) do nothing
      returning id into v_repayment;

      if v_repayment is not null then
        update public.staff_loans
        set
          amount_paid=least(principal,amount_paid+v_deduct),
          balance=greatest(balance-v_deduct,0),
          status=case when greatest(balance-v_deduct,0)=0 then 'cleared' else status end,
          updated_at=now()
        where id=(v_loan_json->>'loanId')::uuid;
      end if;
    end loop;
  end loop;

  v_counter:=public.atis_take_counter(v_school,'payment_voucher');
  v_no:='ATIS-PV-'||to_char(p_pay_date,'YYYY')||'-'||lpad(v_counter::text,5,'0');

  insert into public.payment_vouchers(
    school_id,voucher_no,voucher_date,payee,category,description,amount,
    payment_method,reference,status,payroll_run_id,prepared_by,
    approved_by,approved_at,paid_by,paid_at
  ) values(
    v_school,v_no,p_pay_date,'ATIS Staff Payroll','salary',v_run.title,v_total,
    nullif(trim(p_payment_method),''),nullif(trim(p_reference),''),
    'paid',p_run_id,auth.uid(),v_run.approved_by,v_run.approved_at,auth.uid(),now()
  ) returning id into v_voucher;

  update public.payroll_runs
  set status='paid',pay_date=p_pay_date,paid_by=auth.uid(),paid_at=now(),updated_at=now()
  where id=p_run_id;

  return v_voucher;
end;
$$;

create or replace view public.staff_early_attendance_summary
with (security_invoker=true)
as
select
  sa.school_id,
  date_trunc('month',sa.attendance_date)::date payroll_month,
  sa.staff_id,
  st.full_name,
  st.employee_code,
  count(*) filter(where sa.early=true and sa.status='present')::integer early_days,
  count(*) filter(where sa.status='present')::integer total_attendance
from public.staff_attendance sa
join public.staff st on st.id=sa.staff_id
group by sa.school_id,date_trunc('month',sa.attendance_date)::date,sa.staff_id,st.id;

grant select on public.staff_early_attendance_summary to authenticated;

create or replace view public.payroll_profile_summary
with (security_invoker=true)
as
select
  pp.*,
  st.full_name,
  st.employee_code,
  st.position_title,
  st.joining_date,
  pc.category_name,
  pc.base_pay category_base_pay,
  coalesce(pp.base_pay_override,pc.base_pay,0)::numeric(12,2) effective_base_pay
from public.payroll_profiles pp
join public.staff st on st.id=pp.staff_id
left join public.payroll_categories pc on pc.id=pp.category_id;

grant select on public.payroll_profile_summary to authenticated;

-- Rebuild payroll item summary with legacy fields.
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

-- Function permissions
revoke all on function public.save_feeding_rate(jsonb) from public;
revoke all on function public.save_student_feeding_plan(jsonb) from public;
revoke all on function public.record_feeding_payment(uuid,uuid,text,date,text,text,text,numeric) from public;
revoke all on function public.resync_student_feeding(uuid,uuid) from public;
revoke all on function public.save_payroll_setting(text,numeric,text) from public;
revoke all on function public.save_payroll_allowance_type(jsonb) from public;
revoke all on function public.save_payroll_category(jsonb) from public;
revoke all on function public.save_payroll_profile(jsonb) from public;
revoke all on function public.save_staff_allowance(jsonb) from public;
revoke all on function public.create_staff_loan(jsonb) from public;
revoke all on function public.save_staff_attendance(uuid,date,time,text,boolean,text) from public;

grant execute on function public.save_feeding_rate(jsonb) to authenticated;
grant execute on function public.save_student_feeding_plan(jsonb) to authenticated;
grant execute on function public.record_feeding_payment(uuid,uuid,text,date,text,text,text,numeric) to authenticated;
grant execute on function public.resync_student_feeding(uuid,uuid) to authenticated;
grant execute on function public.save_payroll_setting(text,numeric,text) to authenticated;
grant execute on function public.save_payroll_allowance_type(jsonb) to authenticated;
grant execute on function public.save_payroll_category(jsonb) to authenticated;
grant execute on function public.save_payroll_profile(jsonb) to authenticated;
grant execute on function public.save_staff_allowance(jsonb) to authenticated;
grant execute on function public.create_staff_loan(jsonb) to authenticated;
grant execute on function public.save_staff_attendance(uuid,date,time,text,boolean,text) to authenticated;

commit;
