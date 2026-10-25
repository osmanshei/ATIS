-- ATIS Web v0.7.0 — Finance & Fees
begin;

alter table public.fee_payments
  add column if not exists fee_item_id uuid references public.fee_items(id) on delete set null;

create sequence if not exists public.fee_receipt_seq start 1;

create table if not exists public.fee_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  fee_item_id uuid references public.fee_items(id) on delete set null,
  adjustment_type text not null default 'discount'
    check (adjustment_type in ('discount','exemption','scholarship','sibling','merit','other')),
  calculation_type text not null default 'amount'
    check (calculation_type in ('amount','percent')),
  adjustment_value numeric(12,2) not null check (adjustment_value >= 0),
  reason text,
  status text not null default 'active' check (status in ('active','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fee_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_id uuid not null unique references public.fee_payments(id) on delete restrict,
  reason text not null,
  reversed_by uuid references auth.users(id) on delete set null,
  reversed_at timestamptz not null default now()
);

create index if not exists fee_adjustments_student_term_idx
  on public.fee_adjustments (student_id,term_id)
  where status='active';

create index if not exists fee_payment_reversals_payment_idx
  on public.fee_payment_reversals (payment_id);

drop trigger if exists set_fee_adjustments_updated_at on public.fee_adjustments;
create trigger set_fee_adjustments_updated_at
before update on public.fee_adjustments
for each row execute function public.set_updated_at();

alter table public.fee_adjustments enable row level security;
alter table public.fee_payment_reversals enable row level security;

revoke all on table public.fee_adjustments, public.fee_payment_reversals from anon,authenticated;
grant select on table public.fee_adjustments, public.fee_payment_reversals to authenticated;

drop policy if exists fee_adjustments_read on public.fee_adjustments;
create policy fee_adjustments_read on public.fee_adjustments
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','accountant')
    or student_id=(select public.current_student_id())
    or exists (
      select 1
      from public.student_guardians sg
      where sg.student_id=fee_adjustments.student_id
        and sg.guardian_id=(select public.current_guardian_id())
    )
  )
);

drop policy if exists fee_payment_reversals_read on public.fee_payment_reversals;
create policy fee_payment_reversals_read on public.fee_payment_reversals
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
);

create or replace function public.is_finance_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.current_app_role() in ('admin','supervisor','accountant'),false)
$$;

revoke all on function public.is_finance_user() from public;
grant execute on function public.is_finance_user() to authenticated;

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
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();
  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_class:=nullif(p_payload->>'class_id','')::uuid;
  v_name:=nullif(trim(p_payload->>'fee_name'),'');
  v_amount:=nullif(p_payload->>'amount','')::numeric;

  select academic_year_id into v_year
  from public.terms
  where id=v_term and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;
  if v_name is null then raise exception 'Fee name is required'; end if;
  if v_amount is null or v_amount<0 then raise exception 'Enter a valid amount'; end if;

  if not exists (
    select 1 from public.classes c
    where c.id=v_class and c.school_id=v_school
  ) then raise exception 'Choose a valid class'; end if;

  insert into public.fee_items (
    school_id,academic_year_id,term_id,class_id,fee_name,fee_category,
    amount,due_date,is_concession_eligible,is_active,notes,created_by
  ) values (
    v_school,v_year,v_term,v_class,v_name,
    coalesce(nullif(trim(p_payload->>'fee_category'),''),'school_fee'),
    v_amount,
    nullif(p_payload->>'due_date','')::date,
    coalesce((p_payload->>'is_concession_eligible')::boolean,false),
    coalesce((p_payload->>'is_active')::boolean,true),
    nullif(trim(coalesce(p_payload->>'notes','')),''),
    auth.uid()
  )
  on conflict (term_id,class_id,fee_name) do update set
    fee_category=excluded.fee_category,
    amount=excluded.amount,
    due_date=excluded.due_date,
    is_concession_eligible=excluded.is_concession_eligible,
    is_active=excluded.is_active,
    notes=excluded.notes,
    updated_at=now()
  returning id into v_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Item Saved','fee_item',v_id,
    jsonb_build_object('term_id',v_term,'class_id',v_class,'fee_name',v_name,'amount',v_amount)
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
      and fi.class_id=v_class
      and fi.is_active=true
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

create or replace function public.reverse_fee_payment(
  p_payment_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
  v_student uuid;
  v_amount numeric;
  v_receipt text;
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();

  select student_id,amount,receipt_no::text
  into v_student,v_amount,v_receipt
  from public.fee_payments
  where id=p_payment_id and school_id=v_school;

  if v_student is null then raise exception 'Payment not found'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'A reversal reason is required';
  end if;

  if exists (
    select 1 from public.fee_payment_reversals
    where payment_id=p_payment_id
  ) then raise exception 'This payment has already been reversed'; end if;

  insert into public.fee_payment_reversals (
    school_id,payment_id,reason,reversed_by
  ) values (
    v_school,p_payment_id,trim(p_reason),auth.uid()
  )
  returning id into v_id;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Payment Reversed','fee_payment',p_payment_id,
    jsonb_build_object(
      'student_id',v_student,'amount',v_amount,'receipt_no',v_receipt,'reason',trim(p_reason)
    )
  );

  return v_id;
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
  if v_calc='percent' and v_value>100 then raise exception 'Percentage adjustment cannot exceed 100%'; end if;

  if v_item is not null and not exists (
    select 1 from public.fee_items fi
    where fi.id=v_item
      and fi.school_id=v_school
      and fi.term_id=v_term
      and fi.class_id=v_class
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

revoke all on function public.save_fee_item(jsonb) from public;
revoke all on function public.record_fee_payment(uuid,uuid,numeric,text,text,text,uuid) from public;
revoke all on function public.reverse_fee_payment(uuid,text) from public;
revoke all on function public.save_fee_adjustment(jsonb) from public;

grant execute on function public.save_fee_item(jsonb) to authenticated;
grant execute on function public.record_fee_payment(uuid,uuid,numeric,text,text,text,uuid) to authenticated;
grant execute on function public.reverse_fee_payment(uuid,text) to authenticated;
grant execute on function public.save_fee_adjustment(jsonb) to authenticated;

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
  r.reversed_at
from public.fee_payments fp
join public.students st on st.id=fp.student_id
left join public.classes c on c.id=st.class_id
join public.terms t on t.id=fp.term_id
left join public.fee_items fi on fi.id=fp.fee_item_id
left join public.fee_payment_reversals r on r.payment_id=fp.id;

grant select on public.fee_payment_summary to authenticated;

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
   and fi.class_id=s.class_id
   and fi.is_active=true
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
  coalesce(a.adjustment_amount,0)::numeric(12,2) additional_adjustment,
  greatest(
    c.gross_fees-c.concession_amount-coalesce(a.adjustment_amount,0),
    0
  )::numeric(12,2) net_fees,
  coalesce(p.amount_paid,0)::numeric(12,2) amount_paid,
  greatest(
    (c.gross_fees-c.concession_amount-coalesce(a.adjustment_amount,0))-coalesce(p.amount_paid,0),
    0
  )::numeric(12,2) outstanding_balance,
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

create or replace view public.finance_student_summary
with (security_invoker=true)
as
select
  fs.*,
  st.admission_number,
  st.first_name,
  st.middle_name,
  st.last_name,
  st.class_id,
  c.class_name,
  c.section
from public.student_fee_summary fs
join public.students st on st.id=fs.student_id
left join public.classes c on c.id=st.class_id;

grant select on public.finance_student_summary to authenticated;

commit;
