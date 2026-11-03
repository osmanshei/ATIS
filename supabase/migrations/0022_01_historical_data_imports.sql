-- Historical fee arrears and aggregate attendance imports.
-- Imported values are kept separate from current-term billing and dated registers.

begin;

create table if not exists public.historical_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  import_type text not null check (import_type in ('fee_arrears','attendance_totals')),
  file_name text not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_fee_arrears (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  arrears_amount numeric(12,2) not null check (arrears_amount >= 0),
  source_batch_id uuid references public.historical_import_batches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id)
);

create table if not exists public.student_historical_attendance_totals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  total_attendance integer not null check (total_attendance >= 0),
  source_batch_id uuid references public.historical_import_batches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id)
);

create index if not exists historical_import_batches_school_created_idx
  on public.historical_import_batches (school_id, created_at desc);

create index if not exists student_fee_arrears_school_class_idx
  on public.student_fee_arrears (school_id, class_id);

create index if not exists student_historical_attendance_school_class_idx
  on public.student_historical_attendance_totals (school_id, class_id);

drop trigger if exists set_student_fee_arrears_updated_at on public.student_fee_arrears;
create trigger set_student_fee_arrears_updated_at
before update on public.student_fee_arrears
for each row execute function public.set_updated_at();

drop trigger if exists set_student_historical_attendance_updated_at on public.student_historical_attendance_totals;
create trigger set_student_historical_attendance_updated_at
before update on public.student_historical_attendance_totals
for each row execute function public.set_updated_at();

alter table public.historical_import_batches enable row level security;
alter table public.student_fee_arrears enable row level security;
alter table public.student_historical_attendance_totals enable row level security;

revoke all on table public.historical_import_batches,
  public.student_fee_arrears,
  public.student_historical_attendance_totals
from anon, authenticated;

grant select on table public.historical_import_batches,
  public.student_fee_arrears,
  public.student_historical_attendance_totals
to authenticated;

drop policy if exists historical_import_batches_admin_read on public.historical_import_batches;
create policy historical_import_batches_admin_read on public.historical_import_batches
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role())='admin'
);

drop policy if exists student_fee_arrears_finance_read on public.student_fee_arrears;
create policy student_fee_arrears_finance_read on public.student_fee_arrears
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','accountant')
);

drop policy if exists student_historical_attendance_read on public.student_historical_attendance_totals;
create policy student_historical_attendance_read on public.student_historical_attendance_totals
for select to authenticated
using (
  school_id=(select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor')
    or (
      (select public.current_app_role())='teacher'
      and public.can_manage_attendance_class(class_id)
    )
  )
);

comment on table public.student_fee_arrears is
  'Imported opening balances for fees owed before the current ATIS term ledger. Re-imports replace the imported amount for that student.';

comment on table public.student_historical_attendance_totals is
  'Imported aggregate attendance totals from before ATIS dated attendance registers. These are not individual attendance sessions.';

create or replace function public.import_historical_records(
  p_import_type text,
  p_file_name text,
  p_rows jsonb,
  p_total_rows integer,
  p_skipped_rows integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_batch uuid;
  v_row jsonb;
  v_student uuid;
  v_class uuid;
  v_numeric numeric;
  v_imported integer := 0;
  v_matched integer;
  v_unique integer;
  v_file_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if public.current_app_role() <> 'admin' then
    raise exception 'Only an administrator can import historical records';
  end if;

  if p_import_type not in ('fee_arrears','attendance_totals') then
    raise exception 'Choose a valid historical import type';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be an array';
  end if;

  v_matched := jsonb_array_length(p_rows);
  if v_matched < 1 or v_matched > 1500 then
    raise exception 'Import between 1 and 1500 matched rows at a time';
  end if;

  if p_total_rows is null or p_total_rows < v_matched or p_total_rows > 1500 then
    raise exception 'The total row count is invalid';
  end if;

  if p_skipped_rows is null or p_skipped_rows <> p_total_rows-v_matched then
    raise exception 'The skipped row count is invalid';
  end if;

  select count(distinct nullif(value->>'student_id',''))
  into v_unique
  from jsonb_array_elements(p_rows) as r(value);

  if v_unique <> v_matched then
    raise exception 'A student appears more than once in the import';
  end if;

  v_school := public.current_school_id();
  v_file_name := left(trim(coalesce(p_file_name,'')),255);

  if v_file_name = '' then
    raise exception 'The import file name is required';
  end if;

  insert into public.historical_import_batches (
    school_id,import_type,file_name,total_rows,imported_rows,skipped_rows,created_by
  ) values (
    v_school,p_import_type,v_file_name,p_total_rows,0,p_skipped_rows,auth.uid()
  )
  returning id into v_batch;

  for v_row in
    select value from jsonb_array_elements(p_rows) as r(value)
  loop
    v_student := nullif(v_row->>'student_id','')::uuid;
    v_class := nullif(v_row->>'class_id','')::uuid;
    v_numeric := nullif(v_row->>'value','')::numeric;

    if v_student is null or v_class is null or v_numeric is null or v_numeric < 0 then
      raise exception 'A matched row contains a missing or invalid value';
    end if;

    if not exists (
      select 1
      from public.students s
      where s.id=v_student
        and s.school_id=v_school
        and s.class_id=v_class
    ) then
      raise exception 'A selected student or class no longer matches the school record. Preview the file again.';
    end if;

    if p_import_type='fee_arrears' then
      insert into public.student_fee_arrears (
        school_id,student_id,class_id,arrears_amount,source_batch_id,created_by
      ) values (
        v_school,v_student,v_class,v_numeric,v_batch,auth.uid()
      )
      on conflict (school_id,student_id) do update set
        class_id=excluded.class_id,
        arrears_amount=excluded.arrears_amount,
        source_batch_id=excluded.source_batch_id,
        updated_at=now();
    else
      if trunc(v_numeric) <> v_numeric or v_numeric > 2147483647 then
        raise exception 'Historical attendance must be a non-negative whole number';
      end if;

      insert into public.student_historical_attendance_totals (
        school_id,student_id,class_id,total_attendance,source_batch_id,created_by
      ) values (
        v_school,v_student,v_class,v_numeric::integer,v_batch,auth.uid()
      )
      on conflict (school_id,student_id) do update set
        class_id=excluded.class_id,
        total_attendance=excluded.total_attendance,
        source_batch_id=excluded.source_batch_id,
        updated_at=now();
    end if;

    v_imported := v_imported + 1;
  end loop;

  update public.historical_import_batches
  set imported_rows=v_imported
  where id=v_batch;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,
    auth.uid(),
    case
      when p_import_type='fee_arrears' then 'Historical Fee Arrears Imported'
      else 'Historical Attendance Totals Imported'
    end,
    'historical_import_batch',
    v_batch,
    jsonb_build_object(
      'import_type',p_import_type,
      'file_name',v_file_name,
      'total_rows',p_total_rows,
      'imported_rows',v_imported,
      'skipped_rows',p_skipped_rows
    )
  );

  return jsonb_build_object(
    'batch_id',v_batch,
    'imported_rows',v_imported,
    'total_rows',p_total_rows,
    'skipped_rows',p_skipped_rows
  );
end;
$$;

revoke all on function public.import_historical_records(text,text,jsonb,integer,integer) from public;
grant execute on function public.import_historical_records(text,text,jsonb,integer,integer) to authenticated;

commit;
