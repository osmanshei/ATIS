-- ATIS: include employer SSNIT in gross pay and prevent duplicate active staff allowances.
begin;

-- 1. Gross up pay by the employer SSNIT contribution. The matching SSNIT
-- deduction then offsets this addition, so it does not reduce agreed net pay.
do $$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.create_payroll_run(date,text)'::regprocedure)
    into v_definition;

  v_old := 'v_school,v_id,r.staff_id,v_base,v_auto_allow,v_ssnit+v_loan,';
  v_new := 'v_school,v_id,r.staff_id,v_base,v_auto_allow+v_ssnit,v_ssnit+v_loan,';

  if position(v_old in v_definition)=0 then
    raise exception 'Could not safely update payroll calculation: gross-pay insertion pattern was not found';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  v_old := $old$
    if v_loan>0 then
      v_deduct_json:=v_deduct_json||v_loan_json;
    end if;

    insert into public.payroll_items($old$;
  v_new := $new$
    if v_loan>0 then
      v_deduct_json:=v_deduct_json||v_loan_json;
    end if;

    -- Present the employer contribution as a gross-pay earning as well as
    -- the matching deduction. The net-pay effect is therefore zero.
    if v_ssnit>0 then
      v_allow_json:=v_allow_json||jsonb_build_array(jsonb_build_object(
        'type','employer_ssnit',
        'name','Employer SSNIT Contribution',
        'amount',v_ssnit,
        'detail','Employer contribution included in gross pay and offset by the SSNIT deduction'
      ));
    end if;

    insert into public.payroll_items($new$;

  if position(v_old in v_definition)=0 then
    raise exception 'Could not safely update payroll calculation: allowance detail insertion point was not found';
  end if;
  v_definition := replace(v_definition,v_old,v_new);

  execute v_definition;
end;
$$;

-- 2. Keep only the most recently updated active assignment when duplicate
-- allowance types exist for the same staff member.
with ranked as (
  select
    id,
    row_number() over (
      partition by staff_id, allowance_type_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.staff_allowances
  where active=true
)
update public.staff_allowances sa
set active=false,
    updated_at=now(),
    notes=concat_ws(E'\\n',nullif(sa.notes,''),'Deactivated automatically because this was a duplicate active allowance assignment.')
from ranked r
where sa.id=r.id
  and r.rn>1;

-- One active assignment of a given allowance type per staff member.
create unique index if not exists staff_allowances_one_active_type_per_staff
  on public.staff_allowances(staff_id,allowance_type_id)
  where active=true;

-- Saving an allowance already assigned to a staff member updates that
-- assignment instead of creating a duplicate row.
create or replace function public.save_staff_allowance(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_active boolean;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Not authorized';
  end if;

  v_school:=public.current_school_id();
  v_active:=coalesce((p_payload->>'active')::boolean,true);

  if v_active then
    insert into public.staff_allowances(
      school_id,staff_id,allowance_type_id,amount,active,
      effective_from,effective_to,notes,updated_by
    ) values(
      v_school,
      (p_payload->>'staff_id')::uuid,
      (p_payload->>'allowance_type_id')::uuid,
      nullif(p_payload->>'amount','')::numeric,
      true,
      nullif(p_payload->>'effective_from','')::date,
      nullif(p_payload->>'effective_to','')::date,
      nullif(trim(coalesce(p_payload->>'notes','')),''),
      auth.uid()
    )
    on conflict (staff_id,allowance_type_id) where active=true
    do update set
      amount=excluded.amount,
      effective_from=excluded.effective_from,
      effective_to=excluded.effective_to,
      notes=excluded.notes,
      updated_by=auth.uid(),
      updated_at=now()
    returning id into v_id;
  else
    insert into public.staff_allowances(
      school_id,staff_id,allowance_type_id,amount,active,
      effective_from,effective_to,notes,updated_by
    ) values(
      v_school,
      (p_payload->>'staff_id')::uuid,
      (p_payload->>'allowance_type_id')::uuid,
      nullif(p_payload->>'amount','')::numeric,
      false,
      nullif(p_payload->>'effective_from','')::date,
      nullif(p_payload->>'effective_to','')::date,
      nullif(trim(coalesce(p_payload->>'notes','')),''),
      auth.uid()
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_staff_allowance(jsonb) from public;
grant execute on function public.save_staff_allowance(jsonb) to authenticated;

commit;
