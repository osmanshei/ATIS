-- ATIS: fixed SSNIT contributions/deductions and clearer early-attendance payroll
begin;

alter table public.payroll_items
  add column if not exists employer_ssnit_contribution numeric(12,2) not null default 0
    check (employer_ssnit_contribution >= 0);

-- The school policy is a fixed GHS 80 for both sides, not a percentage of salary.
insert into public.payroll_settings(school_id,key,value,description)
select id,'SSNIT_FIXED_AMOUNT',80,
       'Fixed monthly SSNIT amount: employee deduction and matching employer contribution (GHS)'
from public.schools
on conflict(school_id,key) do update set
  value=80,
  description=excluded.description,
  updated_at=now();

-- Retire the percentage-based setting and profile overrides so they cannot mislead users.
update public.payroll_settings
set value=0,
    description='Retired: SSNIT is now a fixed monthly amount; see SSNIT_FIXED_AMOUNT.',
    updated_at=now()
where key='EMPLOYEE_SSNIT_RATE';

update public.payroll_profiles
set ssnit_rate_override=null,
    updated_at=now()
where ssnit_rate_override is not null;

-- The old "SSNIT Contribution" allowance was a legacy workaround. It must not
-- increase gross salary because the employer contribution is now tracked separately.
update public.staff_allowances
set active=false, updated_at=now()
where allowance_type_id in (
  select id from public.payroll_allowance_types
  where lower(name)='ssnit contribution'
);
update public.payroll_allowance_types
set active=false,
    notes='Retired legacy item. Employer SSNIT is calculated separately from payroll allowances.',
    updated_at=now()
where lower(name)='ssnit contribution';

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
  v_ssnit_amount numeric;
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
         coalesce(max(value) filter(where key='RETENTION_BONUS_PER_YEAR'),10),
         coalesce(max(value) filter(where key='SSNIT_FIXED_AMOUNT'),80)
  into v_early_min,v_early_amount,v_long_rate,v_ssnit_amount
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
        'detail',v_early_days||' qualifying early day(s) out of '||v_total_att||' present day(s); minimum '||v_early_min||' days; cutoff 7:30 AM'
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
      v_ssnit_amount
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
      ssnit_deduction,employer_ssnit_contribution,loan_deduction,other_deductions,loan_details,
      early_days,total_attendance,service_years
    ) values(
      v_school,v_id,r.staff_id,v_base,v_auto_allow,v_ssnit+v_loan,
      v_allow_json,v_deduct_json,v_auto_allow,0,v_ssnit,v_ssnit,v_loan,0,v_loan_json,
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
  coalesce(sum(pi.base_salary+pi.allowances-pi.deductions),0)::numeric(12,2) net_total,
  coalesce(sum(pi.employer_ssnit_contribution),0)::numeric(12,2) employer_ssnit_total
from public.payroll_runs pr
left join public.payroll_items pi on pi.payroll_run_id=pr.id
group by pr.id;

grant select on public.payroll_run_summary to authenticated;

create or replace view public.payroll_item_summary
with (security_invoker=false)
as
select
  pi.id,
  pi.school_id,
  pi.payroll_run_id,
  pi.staff_id,
  pi.contract_id,
  pi.base_salary,
  pi.allowances,
  pi.deductions,
  pi.allowance_details,
  pi.deduction_details,
  pi.remarks,
  pi.created_at,
  pi.updated_at,
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
  (pi.base_salary+pi.allowances-pi.deductions)::numeric(12,2) net_pay,
  pi.automatic_allowances,
  pi.other_allowances,
  pi.ssnit_deduction,
  pi.loan_deduction,
  pi.other_deductions,
  pi.loan_details,
  pi.early_days,
  pi.total_attendance,
  pi.service_years,
  pi.employer_ssnit_contribution
from public.payroll_items pi
join public.payroll_runs pr on pr.id=pi.payroll_run_id
join public.staff s on s.id=pi.staff_id
left join public.staff_contracts c on c.id=pi.contract_id
where pi.school_id=public.current_school_id()
  and (
    public.is_payroll_finance_user()
    or pi.staff_id=public.current_staff_id()
  );

grant select on public.payroll_item_summary to authenticated;

commit;
