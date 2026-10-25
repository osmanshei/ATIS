-- ATIS Web v0.7.1 — global fees and finance student search support
begin;

alter table public.fee_items
  alter column class_id drop not null;

alter table public.fee_items
  add column if not exists applies_to_all_students boolean not null default false;

update public.fee_items
set applies_to_all_students=false
where applies_to_all_students is null;

alter table public.fee_items
  drop constraint if exists fee_items_term_id_class_id_fee_name_key;

create unique index if not exists fee_items_term_class_name_unique_idx
  on public.fee_items (term_id,class_id,lower(fee_name))
  where applies_to_all_students=false and class_id is not null;

create unique index if not exists fee_items_term_global_name_unique_idx
  on public.fee_items (term_id,lower(fee_name))
  where applies_to_all_students=true;

alter table public.fee_items
  drop constraint if exists fee_items_scope_check;

alter table public.fee_items
  add constraint fee_items_scope_check check (
    (applies_to_all_students=true and class_id is null)
    or
    (applies_to_all_students=false and class_id is not null)
  );

create or replace function public.save_fee_item(p_payload jsonb)
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
  v_name text;
  v_amount numeric;
  v_all boolean;
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_class:=nullif(p_payload->>'class_id','')::uuid;
  v_name:=nullif(trim(p_payload->>'fee_name'),'');
  v_amount:=nullif(p_payload->>'amount','')::numeric;
  v_all:=coalesce((p_payload->>'applies_to_all_students')::boolean,false);

  select academic_year_id into v_year
  from public.terms
  where id=v_term and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;
  if v_name is null then raise exception 'Fee name is required'; end if;
  if v_amount is null or v_amount<0 then raise exception 'Enter a valid amount'; end if;

  if v_all then
    v_class:=null;
  else
    if v_class is null or not exists (
      select 1 from public.classes c
      where c.id=v_class and c.school_id=v_school and c.is_active=true
    ) then
      raise exception 'Choose a valid class or mark the fee as applying to all students';
    end if;
  end if;

  if v_all then
    select id into v_id
    from public.fee_items
    where school_id=v_school
      and term_id=v_term
      and applies_to_all_students=true
      and lower(fee_name)=lower(v_name)
    limit 1;
  else
    select id into v_id
    from public.fee_items
    where school_id=v_school
      and term_id=v_term
      and class_id=v_class
      and applies_to_all_students=false
      and lower(fee_name)=lower(v_name)
    limit 1;
  end if;

  if v_id is null then
    insert into public.fee_items (
      school_id,academic_year_id,term_id,class_id,fee_name,fee_category,
      amount,due_date,is_concession_eligible,is_active,notes,created_by,
      applies_to_all_students
    ) values (
      v_school,v_year,v_term,v_class,v_name,
      coalesce(nullif(trim(p_payload->>'fee_category'),''),'school_fee'),
      v_amount,
      nullif(p_payload->>'due_date','')::date,
      coalesce((p_payload->>'is_concession_eligible')::boolean,false),
      coalesce((p_payload->>'is_active')::boolean,true),
      nullif(trim(coalesce(p_payload->>'notes','')),''),
      auth.uid(),
      v_all
    )
    returning id into v_id;
  else
    update public.fee_items
    set
      class_id=v_class,
      fee_category=coalesce(nullif(trim(p_payload->>'fee_category'),''),'school_fee'),
      amount=v_amount,
      due_date=nullif(p_payload->>'due_date','')::date,
      is_concession_eligible=coalesce((p_payload->>'is_concession_eligible')::boolean,false),
      is_active=coalesce((p_payload->>'is_active')::boolean,true),
      notes=nullif(trim(coalesce(p_payload->>'notes','')),''),
      applies_to_all_students=v_all,
      updated_at=now()
    where id=v_id;
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Item Saved','fee_item',v_id,
    jsonb_build_object(
      'term_id',v_term,
      'class_id',v_class,
      'applies_to_all_students',v_all,
      'fee_name',v_name,
      'amount',v_amount
    )
  );

  return v_id;
end;
$$;

create or replace function public.record_fee_payment(
  p_student_id uuid,
  p_term_id uuid,
  p_amount numeric,
  p_payment_method text default null,
  p_reference text default null,
  p_remarks text default null,
  p_fee_item_id uuid default null
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
  v_payment uuid;
  v_receipt text;
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();

  select class_id into v_class
  from public.students
  where id=p_student_id
    and school_id=v_school
    and status='active';

  if v_class is null then raise exception 'Choose a valid active student'; end if;

  select academic_year_id into v_year
  from public.terms
  where id=p_term_id and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;

  if p_fee_item_id is not null and not exists (
    select 1
    from public.fee_items fi
    where fi.id=p_fee_item_id
      and fi.school_id=v_school
      and fi.term_id=p_term_id
      and fi.is_active=true
      and (
        fi.applies_to_all_students=true
        or fi.class_id=v_class
      )
  ) then
    raise exception 'The selected fee item does not apply to this student';
  end if;

  v_receipt :=
    'ATIS-' || to_char(current_date,'YYYYMMDD') || '-' ||
    lpad(nextval('public.fee_receipt_seq')::text,6,'0');

  insert into public.fee_payments (
    school_id,academic_year_id,term_id,student_id,fee_item_id,amount,
    payment_date,payment_method,receipt_no,reference,remarks,recorded_by
  ) values (
    v_school,v_year,p_term_id,p_student_id,p_fee_item_id,p_amount,
    current_date,nullif(trim(coalesce(p_payment_method,'')),''),
    v_receipt,nullif(trim(coalesce(p_reference,'')),''),
    nullif(trim(coalesce(p_remarks,'')),''),auth.uid()
  )
  returning id into v_payment;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Payment Recorded','fee_payment',v_payment,
    jsonb_build_object(
      'student_id',p_student_id,'term_id',p_term_id,
      'amount',p_amount,'receipt_no',v_receipt
    )
  );

  return v_payment;
end;
$$;

create or replace function public.save_fee_adjustment(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_student uuid;
  v_term uuid;
  v_year uuid;
  v_item uuid;
  v_class uuid;
  v_id uuid;
  v_calc text;
  v_value numeric;
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();
  v_student:=nullif(p_payload->>'student_id','')::uuid;
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_item:=nullif(p_payload->>'fee_item_id','')::uuid;
  v_calc:=coalesce(nullif(p_payload->>'calculation_type',''),'amount');
  v_value:=nullif(p_payload->>'adjustment_value','')::numeric;

  select class_id into v_class
  from public.students
  where id=v_student and school_id=v_school and status='active';

  if v_class is null then raise exception 'Choose a valid active student'; end if;

  select academic_year_id into v_year
  from public.terms
  where id=v_term and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;
  if v_value is null or v_value<0 then raise exception 'Enter a valid adjustment value'; end if;
  if v_calc='percent' and v_value>100 then raise exception 'Percentage adjustment cannot exceed 100 percent'; end if;

  if v_item is not null and not exists (
    select 1 from public.fee_items fi
    where fi.id=v_item
      and fi.school_id=v_school
      and fi.term_id=v_term
      and (
        fi.applies_to_all_students=true
        or fi.class_id=v_class
      )
  ) then raise exception 'Selected fee item does not apply to this student'; end if;

  insert into public.fee_adjustments (
    school_id,academic_year_id,term_id,student_id,fee_item_id,
    adjustment_type,calculation_type,adjustment_value,reason,created_by
  ) values (
    v_school,v_year,v_term,v_student,v_item,
    coalesce(nullif(p_payload->>'adjustment_type',''),'discount'),
    v_calc,v_value,nullif(trim(coalesce(p_payload->>'reason','')),''),auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.student_fee_summary
with (security_invoker=true)
as
with charges as (
  select
    s.school_id,
    s.id student_id,
    fi.academic_year_id,
    fi.term_id,
    sum(fi.amount)::numeric(12,2) gross_fees,
    sum(
      case when fi.is_concession_eligible
        then fi.amount * (coalesce(s.concession_percent,0) / 100.0)
        else 0
      end
    )::numeric(12,2) concession_amount,
    max(coalesce(s.concession_percent,0))::numeric(5,2) concession_percent
  from public.students s
  join public.fee_items fi
    on fi.school_id=s.school_id
   and fi.is_active=true
   and (
     fi.applies_to_all_students=true
     or fi.class_id=s.class_id
   )
  where s.status='active'
  group by s.school_id,s.id,fi.academic_year_id,fi.term_id
),
adjustments as (
  select
    fa.school_id,
    fa.student_id,
    fa.academic_year_id,
    fa.term_id,
    sum(
      case
        when fa.calculation_type='amount' then fa.adjustment_value
        when fa.fee_item_id is not null then
          coalesce(fi.amount,0) * (fa.adjustment_value/100.0)
        else
          coalesce(ch.gross_fees,0) * (fa.adjustment_value/100.0)
      end
    )::numeric(12,2) adjustment_amount
  from public.fee_adjustments fa
  left join public.fee_items fi on fi.id=fa.fee_item_id
  left join charges ch
    on ch.school_id=fa.school_id
   and ch.student_id=fa.student_id
   and ch.academic_year_id=fa.academic_year_id
   and ch.term_id=fa.term_id
  where fa.status='active'
  group by fa.school_id,fa.student_id,fa.academic_year_id,fa.term_id
),
payments as (
  select
    fp.school_id,
    fp.student_id,
    fp.academic_year_id,
    fp.term_id,
    sum(fp.amount) filter (where r.id is null)::numeric(12,2) amount_paid
  from public.fee_payments fp
  left join public.fee_payment_reversals r on r.payment_id=fp.id
  group by fp.school_id,fp.student_id,fp.academic_year_id,fp.term_id
)
select
  c.school_id,
  c.student_id,
  c.academic_year_id,
  c.term_id,
  c.gross_fees,
  c.concession_percent,
  c.concession_amount,
  greatest(
    c.gross_fees-c.concession_amount-coalesce(a.adjustment_amount,0),
    0
  )::numeric(12,2) net_fees,
  coalesce(p.amount_paid,0)::numeric(12,2) amount_paid,
  greatest(
    (c.gross_fees-c.concession_amount-coalesce(a.adjustment_amount,0))-coalesce(p.amount_paid,0),
    0
  )::numeric(12,2) outstanding_balance,
  coalesce(a.adjustment_amount,0)::numeric(12,2) additional_adjustment,
  greatest(
    coalesce(p.amount_paid,0)-
      (c.gross_fees-c.concession_amount-coalesce(a.adjustment_amount,0)),
    0
  )::numeric(12,2) credit_balance
from charges c
left join adjustments a
  on a.school_id=c.school_id
 and a.student_id=c.student_id
 and a.academic_year_id=c.academic_year_id
 and a.term_id=c.term_id
left join payments p
  on p.school_id=c.school_id
 and p.student_id=c.student_id
 and p.academic_year_id=c.academic_year_id
 and p.term_id=c.term_id;

grant select on public.student_fee_summary to authenticated;

commit;
