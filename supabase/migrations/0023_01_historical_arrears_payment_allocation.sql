-- Historical arrears-first payment allocation.
-- General payments clear imported opening arrears before current-term fees.
-- Fee-item-specific payments remain allocated entirely to the selected current-term item.

begin;

create table if not exists public.fee_payment_arrears_allocations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null unique references public.fee_payments(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete cascade,
  arrears_amount numeric(12,2) not null check (arrears_amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists fee_payment_arrears_allocations_school_student_idx
  on public.fee_payment_arrears_allocations (school_id, student_id);

alter table public.fee_payment_arrears_allocations enable row level security;

revoke all on table public.fee_payment_arrears_allocations from anon, authenticated;
grant select on table public.fee_payment_arrears_allocations to authenticated;

drop policy if exists fee_payment_arrears_allocations_read
  on public.fee_payment_arrears_allocations;

create policy fee_payment_arrears_allocations_read
on public.fee_payment_arrears_allocations
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','accountant')
    or student_id=(select public.current_student_id())
    or exists (
      select 1
      from public.student_guardians sg
      where sg.student_id=fee_payment_arrears_allocations.student_id
        and sg.guardian_id=(select public.current_guardian_id())
    )
  )
);

-- The imported arrears amount remains intact as the opening balance.
-- This view calculates the live amount still outstanding after valid allocations.
create or replace view public.student_fee_arrears_summary
with (security_invoker=true)
as
with applied as (
  select
    a.school_id,
    a.student_id,
    sum(a.arrears_amount) filter (where r.id is null)::numeric(12,2) arrears_paid
  from public.fee_payment_arrears_allocations a
  join public.fee_payments fp on fp.id=a.payment_id
  left join public.fee_payment_reversals r on r.payment_id=fp.id
  group by a.school_id,a.student_id
)
select
  sfa.school_id,
  sfa.student_id,
  sfa.class_id,
  sfa.arrears_amount::numeric(12,2) original_arrears_amount,
  coalesce(a.arrears_paid,0)::numeric(12,2) arrears_paid,
  greatest(sfa.arrears_amount-coalesce(a.arrears_paid,0),0)::numeric(12,2) remaining_arrears,
  sfa.updated_at
from public.student_fee_arrears sfa
left join applied a
  on a.school_id=sfa.school_id
 and a.student_id=sfa.student_id;

grant select on public.student_fee_arrears_summary to authenticated;

-- Count only the portion allocated to current-term charges as term payments.
-- The full receipt amount remains on fee_payments for the cash audit trail.
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
    sum(greatest(fp.amount-coalesce(a.arrears_amount,0),0))
      filter (where r.id is null)::numeric(12,2) amount_paid
  from public.fee_payments fp
  left join public.fee_payment_reversals r on r.payment_id=fp.id
  left join public.fee_payment_arrears_allocations a on a.payment_id=fp.id
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

-- Keep the original receipt columns and append the two allocation amounts.
create or replace view public.fee_payment_summary
with (security_invoker=true)
as
select
  fp.id,
  fp.school_id,
  fp.academic_year_id,
  fp.term_id,
  t.name term_name,
  fp.student_id,
  st.admission_number,
  st.first_name,
  st.middle_name,
  st.last_name,
  st.class_id,
  c.class_name,
  c.section,
  fp.fee_item_id,
  fi.fee_name,
  fp.amount,
  fp.payment_date,
  fp.payment_method,
  fp.receipt_no,
  fp.reference,
  fp.remarks,
  fp.recorded_by,
  (r.id is not null) is_reversed,
  r.reason reversal_reason,
  r.reversed_at,
  coalesce(a.arrears_amount,0)::numeric(12,2) arrears_amount_applied,
  greatest(fp.amount-coalesce(a.arrears_amount,0),0)::numeric(12,2) term_amount_applied
from public.fee_payments fp
join public.students st on st.id=fp.student_id
left join public.classes c on c.id=st.class_id
join public.terms t on t.id=fp.term_id
left join public.fee_items fi on fi.id=fp.fee_item_id
left join public.fee_payment_reversals r on r.payment_id=fp.id
left join public.fee_payment_arrears_allocations a on a.payment_id=fp.id;

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
  v_amount numeric(12,2);
  v_opening_arrears numeric(12,2) := 0;
  v_arrears_paid numeric(12,2) := 0;
  v_arrears_due numeric(12,2) := 0;
  v_arrears_applied numeric(12,2) := 0;
  v_term_applied numeric(12,2) := 0;
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();
  v_amount:=round(p_amount,2);

  -- Serialize payments for a student so two cashiers cannot allocate the
  -- same remaining opening arrears at the same time.
  select class_id into v_class
  from public.students
  where id=p_student_id
    and school_id=v_school
    and status='active'
  for update;

  if v_class is null then raise exception 'Choose a valid active student'; end if;

  select academic_year_id into v_year
  from public.terms
  where id=p_term_id and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;
  if v_amount is null or v_amount<=0 then raise exception 'Payment amount must be greater than zero'; end if;

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

  -- General payments are allocated to historical arrears first.
  -- Selecting a fee item explicitly bypasses arrears and posts the full
  -- amount against that current-term item.
  if p_fee_item_id is null then
    select arrears_amount
    into v_opening_arrears
    from public.student_fee_arrears
    where school_id=v_school
      and student_id=p_student_id
    for update;

    if v_opening_arrears is not null and v_opening_arrears>0 then
      select coalesce(sum(a.arrears_amount),0)::numeric(12,2)
      into v_arrears_paid
      from public.fee_payment_arrears_allocations a
      left join public.fee_payment_reversals r on r.payment_id=a.payment_id
      where a.school_id=v_school
        and a.student_id=p_student_id
        and r.id is null;

      v_arrears_due:=greatest(v_opening_arrears-v_arrears_paid,0);
    end if;
  end if;

  v_arrears_applied:=least(v_amount,v_arrears_due);
  v_term_applied:=v_amount-v_arrears_applied;

  if v_term_applied>0 and not exists (
    select 1
    from public.fee_items fi
    where fi.school_id=v_school
      and fi.term_id=p_term_id
      and fi.is_active=true
      and (
        fi.applies_to_all_students=true
        or fi.class_id=v_class
      )
  ) then
    raise exception 'This payment exceeds the remaining previous arrears, but no current-term fees are configured for this student';
  end if;

  v_receipt :=
    'ATIS-' || to_char(current_date,'YYYYMMDD') || '-' ||
    lpad(nextval('public.fee_receipt_seq')::text,6,'0');

  insert into public.fee_payments (
    school_id,academic_year_id,term_id,student_id,fee_item_id,amount,
    payment_date,payment_method,receipt_no,reference,remarks,recorded_by
  ) values (
    v_school,v_year,p_term_id,p_student_id,p_fee_item_id,v_amount,
    current_date,nullif(trim(coalesce(p_payment_method,'')),''), 
    v_receipt,nullif(trim(coalesce(p_reference,'')),''), 
    nullif(trim(coalesce(p_remarks,'')),''),auth.uid()
  )
  returning id into v_payment;

  if v_arrears_applied>0 then
    insert into public.fee_payment_arrears_allocations (
      school_id,payment_id,student_id,arrears_amount
    ) values (
      v_school,v_payment,p_student_id,v_arrears_applied
    );
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Payment Recorded','fee_payment',v_payment,
    jsonb_build_object(
      'student_id',p_student_id,
      'term_id',p_term_id,
      'amount',v_amount,
      'arrears_amount_applied',v_arrears_applied,
      'term_amount_applied',v_term_applied,
      'receipt_no',v_receipt
    )
  );

  return v_payment;
end;
$$;

revoke all on function public.record_fee_payment(uuid,uuid,numeric,text,text,text,uuid) from public;
grant execute on function public.record_fee_payment(uuid,uuid,numeric,text,text,text,uuid) to authenticated;

comment on table public.fee_payment_arrears_allocations is
  'Auditable portion of a fee payment allocated to imported historical arrears. Reversed payments are automatically excluded from the live arrears balance.';

commit;
