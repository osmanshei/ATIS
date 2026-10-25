-- ATIS Web v0.6.1 — school fee foundation for report cards
begin;

create table if not exists public.fee_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  fee_name text not null,
  fee_category text not null default 'school_fee',
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  is_concession_eligible boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, class_id, fee_name)
);

create table if not exists public.fee_payments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text,
  receipt_no citext,
  reference text,
  remarks text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fee_payments_receipt_unique_idx
  on public.fee_payments (school_id, receipt_no)
  where receipt_no is not null and receipt_no::text <> '';

create index if not exists fee_items_class_term_idx
  on public.fee_items (class_id, term_id)
  where is_active=true;

create index if not exists fee_payments_student_term_idx
  on public.fee_payments (student_id, term_id);

drop trigger if exists set_fee_items_updated_at on public.fee_items;
create trigger set_fee_items_updated_at
before update on public.fee_items
for each row execute function public.set_updated_at();

drop trigger if exists set_fee_payments_updated_at on public.fee_payments;
create trigger set_fee_payments_updated_at
before update on public.fee_payments
for each row execute function public.set_updated_at();

alter table public.fee_items enable row level security;
alter table public.fee_payments enable row level security;

revoke all on table public.fee_items, public.fee_payments from anon, authenticated;
grant select on table public.fee_items, public.fee_payments to authenticated;
grant insert, update on table public.fee_items, public.fee_payments to authenticated;

drop policy if exists fee_items_read on public.fee_items;
create policy fee_items_read on public.fee_items
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
);

drop policy if exists fee_items_write on public.fee_items;
create policy fee_items_write on public.fee_items
for all to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
)
with check (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
);

drop policy if exists fee_payments_read on public.fee_payments;
create policy fee_payments_read on public.fee_payments
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','accountant')
    or student_id=(select public.current_student_id())
    or exists (
      select 1
      from public.student_guardians sg
      where sg.student_id=fee_payments.student_id
        and sg.guardian_id=(select public.current_guardian_id())
    )
  )
);

drop policy if exists fee_payments_write on public.fee_payments;
create policy fee_payments_write on public.fee_payments
for all to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
)
with check (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
);

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
        then fi.amount * (s.concession_percent / 100.0)
        else 0
      end
    )::numeric(12,2) concession_amount,
    max(s.concession_percent)::numeric(5,2) concession_percent
  from public.students s
  join public.fee_items fi
    on fi.school_id=s.school_id
   and fi.class_id=s.class_id
   and fi.is_active=true
  where s.status='active'
  group by s.school_id,s.id,fi.academic_year_id,fi.term_id
),
payments as (
  select
    school_id,
    student_id,
    academic_year_id,
    term_id,
    sum(amount)::numeric(12,2) amount_paid
  from public.fee_payments
  group by school_id,student_id,academic_year_id,term_id
)
select
  c.school_id,
  c.student_id,
  c.academic_year_id,
  c.term_id,
  c.gross_fees,
  c.concession_percent,
  c.concession_amount,
  greatest(c.gross_fees-c.concession_amount,0)::numeric(12,2) net_fees,
  coalesce(p.amount_paid,0)::numeric(12,2) amount_paid,
  greatest(
    (c.gross_fees-c.concession_amount)-coalesce(p.amount_paid,0),
    0
  )::numeric(12,2) outstanding_balance
from charges c
left join payments p
  on p.school_id=c.school_id
 and p.student_id=c.student_id
 and p.academic_year_id=c.academic_year_id
 and p.term_id=c.term_id;

grant select on public.student_fee_summary to authenticated;

commit;
