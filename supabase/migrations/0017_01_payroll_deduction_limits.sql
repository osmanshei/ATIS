-- ATIS: prevent payroll deductions from exceeding gross pay.
-- Preserve the fixed GHS 80 SSNIT deduction; cap loan repayments to remaining net pay.
begin;

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

    -- The fixed employee SSNIT deduction must remain GHS 80 when enabled.
    -- If gross pay cannot cover it, stop with a clear message for the affected staff member.
    if v_ssnit > (v_base+v_auto_allow) then
      raise exception 'Cannot create payroll for %: fixed SSNIT deduction (GHS %) exceeds gross pay (GHS %). Review the staff base pay/allowances or SSNIT eligibility.',
        r.full_name, to_char(v_ssnit,'FM999999990.00'),
        to_char(v_base+v_auto_allow,'FM999999990.00');
    end if;

    -- Loan repayments may use only the amount remaining after SSNIT.
    -- Allocate the available amount in a stable order so loan balances are
    -- reduced only by what is actually deducted from this month's pay.
    with loan_rows as (
      select
        l.*,
        least(l.monthly_deduction,l.balance) requested_deduction,
        coalesce(
          sum(least(l.monthly_deduction,l.balance)) over (
            order by l.start_month,l.created_at,l.id
            rows between unbounded preceding and 1 preceding
          ),0
        ) prior_requested
      from public.staff_loans l
      where l.staff_id=r.staff_id
        and l.status='active'
        and l.start_month<=v_month
        and l.balance>0
    ),
    loan_allocations as (
      select
        loan_rows.*,
        greatest(
          least(requested_deduction,(v_base+v_auto_allow-v_ssnit)-prior_requested),
          0
        ) actual_deduction
      from loan_rows
    )
    select
      coalesce(sum(actual_deduction),0),
      coalesce(jsonb_agg(jsonb_build_object(
        'loanId',id,
        'name',loan_name,
        'deduction',actual_deduction,
        'requestedDeduction',requested_deduction,
        'balanceBefore',balance,
        'balanceAfter',greatest(balance-actual_deduction,0)
      ) order by start_month,created_at,id)
      filter(where actual_deduction>0),'[]'::jsonb)
    into v_loan,v_loan_json
    from loan_allocations;

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

commit;
