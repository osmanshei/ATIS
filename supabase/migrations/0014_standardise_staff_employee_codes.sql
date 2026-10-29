-- ATIS Web — Standardise every staff employee code
-- Former employee codes remain valid for historical attendance-device imports.
begin;

create table if not exists public.staff_employee_code_history (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  legacy_employee_code citext not null,
  recorded_at timestamptz not null default now(),
  unique (school_id, legacy_employee_code)
);

create index if not exists staff_employee_code_history_staff_idx
  on public.staff_employee_code_history (staff_id);

alter table public.staff_employee_code_history enable row level security;
revoke all on table public.staff_employee_code_history from anon, authenticated;

-- Keep a permanent lookup of each existing code before changing it.
insert into public.staff_employee_code_history (
  school_id, staff_id, legacy_employee_code
)
select school_id, id, employee_code
from public.staff
where nullif(trim(employee_code::text), '') is not null
on conflict (school_id, legacy_employee_code) do update
set staff_id = excluded.staff_id;

-- Renumber every staff member, including inactive staff, consistently per school.
with legacy_max as (
  -- Start above every historical code that already resembles the new format.
  -- This prevents an old device code from becoming another employee's new code.
  select
    school_id,
    coalesce(
      max(substring(legacy_employee_code::text from '^ATIS-STF-([0-9]+)

-- Keep the generator in sync so the next new employee receives the next number.
create table if not exists public.staff_employee_code_counters (
  school_id uuid primary key references public.schools(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

insert into public.staff_employee_code_counters (school_id, last_number)
select
  school_id,
  max(substring(employee_code::text from '^ATIS-STF-([0-9]+)

alter table public.staff_employee_code_counters enable row level security;
revoke all on table public.staff_employee_code_counters from anon, authenticated;

-- Replace the previous counter-backed generator with an atomic per-school counter.
create or replace function public.next_staff_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_no bigint;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  insert into public.staff_employee_code_counters (school_id, last_number)
  values (v_school, 1)
  on conflict (school_id) do update
    set last_number = public.staff_employee_code_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_no;

  return 'ATIS-STF-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function public.next_staff_employee_code() from public;
grant execute on function public.next_staff_employee_code() to authenticated;

-- Device exports can continue using old employee codes, current codes, device IDs,
-- or staff names. The 07:30 early-attendance calculation is unchanged.
create or replace function public.import_staff_device_attendance(
  p_rows jsonb,
  p_source text default 'verification_device'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_row jsonb;
  v_identifier text;
  v_name text;
  v_staff uuid;
  v_date date;
  v_check_in time;
  v_check_out time;
  v_status text;
  v_early boolean;
  v_record_id text;
  v_imported integer:=0;
  v_unmatched integer:=0;
  v_skipped integer:=0;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Device attendance access is required';
  end if;

  if jsonb_typeof(p_rows)<>'array' then
    raise exception 'Attendance import must be an array';
  end if;

  v_school:=public.current_school_id();

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_identifier:=nullif(trim(coalesce(
        v_row->>'device_user_id',
        v_row->>'employee_code',
        v_row->>'user_id',
        v_row->>'staff_code'
      )),'');

      v_name:=nullif(trim(coalesce(v_row->>'staff_name',v_row->>'name')),'');
      v_date:=nullif(v_row->>'attendance_date','')::date;
      v_check_in:=nullif(v_row->>'check_in_time','')::time;
      v_check_out:=nullif(v_row->>'check_out_time','')::time;
      v_status:=lower(coalesce(nullif(trim(v_row->>'status'),''),'present'));
      v_record_id:=nullif(trim(coalesce(v_row->>'device_record_id','')),'');

      if (v_identifier is null and v_name is null) or v_date is null then
        v_skipped:=v_skipped+1;
        continue;
      end if;

      select coalesce(
        (
          select m.staff_id
          from public.staff_attendance_device_mappings m
          where m.school_id=v_school
            and m.active=true
            and v_identifier is not null
            and lower(m.device_user_id::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(coalesce(s.employee_code::text,''))=lower(v_identifier)
          limit 1
        ),
        (
          select h.staff_id
          from public.staff_employee_code_history h
          join public.staff s on s.id=h.staff_id
          where h.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(h.legacy_employee_code::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_name is not null
            and lower(regexp_replace(trim(s.full_name),'\s+',' ','g'))
                = lower(regexp_replace(trim(v_name),'\s+',' ','g'))
          limit 1
        )
      ) into v_staff;

      if v_staff is null then
        v_unmatched:=v_unmatched+1;
        continue;
      end if;

      if v_status not in ('present','absent','leave','sick','official') then
        v_status:='present';
      end if;

      -- ATIS rule: first registration at 07:30:00 or earlier counts as Early.
      -- The device's own early/late flag is deliberately ignored.
      v_early:=(
        v_status='present'
        and v_check_in is not null
        and v_check_in <= time '07:30:00'
      );

      insert into public.staff_attendance(
        school_id,staff_id,attendance_date,check_in_time,check_out_time,
        early,status,source,notes,recorded_by,
        device_user_id,device_record_id,raw_device_payload,imported_at
      ) values(
        v_school,v_staff,v_date,v_check_in,v_check_out,
        v_early,v_status,coalesce(nullif(trim(p_source),''),'verification_device'),
        'Imported from attendance verification device · Early cutoff 07:30',auth.uid(),
        coalesce(v_identifier,v_name),v_record_id,v_row,now()
      )
      on conflict(staff_id,attendance_date) do update set
        check_in_time=case
          when public.staff_attendance.check_in_time is null then excluded.check_in_time
          when excluded.check_in_time is null then public.staff_attendance.check_in_time
          else least(public.staff_attendance.check_in_time,excluded.check_in_time)
        end,
        check_out_time=case
          when public.staff_attendance.check_out_time is null then excluded.check_out_time
          when excluded.check_out_time is null then public.staff_attendance.check_out_time
          else greatest(public.staff_attendance.check_out_time,excluded.check_out_time)
        end,
        early=(
          excluded.status='present'
          and (
            case
              when public.staff_attendance.check_in_time is null then excluded.check_in_time
              when excluded.check_in_time is null then public.staff_attendance.check_in_time
              else least(public.staff_attendance.check_in_time,excluded.check_in_time)
            end
          ) <= time '07:30:00'
        ),
        status=excluded.status,
        source=excluded.source,
        notes=excluded.notes,
        recorded_by=auth.uid(),
        device_user_id=coalesce(excluded.device_user_id,public.staff_attendance.device_user_id),
        device_record_id=coalesce(excluded.device_record_id,public.staff_attendance.device_record_id),
        raw_device_payload=excluded.raw_device_payload,
        imported_at=now(),
        updated_at=now();

      v_imported:=v_imported+1;
    exception when others then
      v_skipped:=v_skipped+1;
    end;
  end loop;

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,details
  ) values(
    v_school,auth.uid(),'Device Staff Attendance Imported','staff_attendance',
    jsonb_build_object(
      'source',coalesce(nullif(trim(p_source),''),'verification_device'),
      'early_cutoff','07:30:00',
      'imported',v_imported,
      'unmatched',v_unmatched,
      'skipped',v_skipped
    )
  );

  return jsonb_build_object(
    'imported',v_imported,
    'unmatched',v_unmatched,
    'skipped',v_skipped,
    'early_cutoff','07:30:00'
  );
end;
$$;

revoke all on function public.import_staff_device_attendance(jsonb,text) from public;
grant execute on function public.import_staff_device_attendance(jsonb,text) to authenticated;

commit;

commit;
)::bigint),
      0
    ) as last_legacy_number
  from public.staff_employee_code_history
  group by school_id
),
numbered as (
  select
    s.id,
    row_number() over (
      partition by s.school_id
      order by s.created_at asc, s.id asc
    ) + coalesce(lm.last_legacy_number, 0) as staff_number
  from public.staff s
  left join legacy_max lm on lm.school_id = s.school_id
)
update public.staff s
set employee_code = 'ATIS-STF-' || lpad(numbered.staff_number::text, 4, '0'),
    updated_at = now()
from numbered
where numbered.id = s.id;

-- Keep the generator in sync so the next new employee receives the next number.
create table if not exists public.staff_employee_code_counters (
  school_id uuid primary key references public.schools(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

insert into public.staff_employee_code_counters (school_id, last_number)
select school_id, count(*)::bigint
from public.staff
group by school_id
on conflict (school_id) do update
set last_number = excluded.last_number,
    updated_at = now();

alter table public.staff_employee_code_counters enable row level security;
revoke all on table public.staff_employee_code_counters from anon, authenticated;

-- Replace the previous counter-backed generator with an atomic per-school counter.
create or replace function public.next_staff_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_no bigint;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  insert into public.staff_employee_code_counters (school_id, last_number)
  values (v_school, 1)
  on conflict (school_id) do update
    set last_number = public.staff_employee_code_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_no;

  return 'ATIS-STF-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function public.next_staff_employee_code() from public;
grant execute on function public.next_staff_employee_code() to authenticated;

-- Device exports can continue using old employee codes, current codes, device IDs,
-- or staff names. The 07:30 early-attendance calculation is unchanged.
create or replace function public.import_staff_device_attendance(
  p_rows jsonb,
  p_source text default 'verification_device'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_row jsonb;
  v_identifier text;
  v_name text;
  v_staff uuid;
  v_date date;
  v_check_in time;
  v_check_out time;
  v_status text;
  v_early boolean;
  v_record_id text;
  v_imported integer:=0;
  v_unmatched integer:=0;
  v_skipped integer:=0;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Device attendance access is required';
  end if;

  if jsonb_typeof(p_rows)<>'array' then
    raise exception 'Attendance import must be an array';
  end if;

  v_school:=public.current_school_id();

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_identifier:=nullif(trim(coalesce(
        v_row->>'device_user_id',
        v_row->>'employee_code',
        v_row->>'user_id',
        v_row->>'staff_code'
      )),'');

      v_name:=nullif(trim(coalesce(v_row->>'staff_name',v_row->>'name')),'');
      v_date:=nullif(v_row->>'attendance_date','')::date;
      v_check_in:=nullif(v_row->>'check_in_time','')::time;
      v_check_out:=nullif(v_row->>'check_out_time','')::time;
      v_status:=lower(coalesce(nullif(trim(v_row->>'status'),''),'present'));
      v_record_id:=nullif(trim(coalesce(v_row->>'device_record_id','')),'');

      if (v_identifier is null and v_name is null) or v_date is null then
        v_skipped:=v_skipped+1;
        continue;
      end if;

      select coalesce(
        (
          select m.staff_id
          from public.staff_attendance_device_mappings m
          where m.school_id=v_school
            and m.active=true
            and v_identifier is not null
            and lower(m.device_user_id::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(coalesce(s.employee_code::text,''))=lower(v_identifier)
          limit 1
        ),
        (
          select h.staff_id
          from public.staff_employee_code_history h
          join public.staff s on s.id=h.staff_id
          where h.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(h.legacy_employee_code::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_name is not null
            and lower(regexp_replace(trim(s.full_name),'\s+',' ','g'))
                = lower(regexp_replace(trim(v_name),'\s+',' ','g'))
          limit 1
        )
      ) into v_staff;

      if v_staff is null then
        v_unmatched:=v_unmatched+1;
        continue;
      end if;

      if v_status not in ('present','absent','leave','sick','official') then
        v_status:='present';
      end if;

      -- ATIS rule: first registration at 07:30:00 or earlier counts as Early.
      -- The device's own early/late flag is deliberately ignored.
      v_early:=(
        v_status='present'
        and v_check_in is not null
        and v_check_in <= time '07:30:00'
      );

      insert into public.staff_attendance(
        school_id,staff_id,attendance_date,check_in_time,check_out_time,
        early,status,source,notes,recorded_by,
        device_user_id,device_record_id,raw_device_payload,imported_at
      ) values(
        v_school,v_staff,v_date,v_check_in,v_check_out,
        v_early,v_status,coalesce(nullif(trim(p_source),''),'verification_device'),
        'Imported from attendance verification device · Early cutoff 07:30',auth.uid(),
        coalesce(v_identifier,v_name),v_record_id,v_row,now()
      )
      on conflict(staff_id,attendance_date) do update set
        check_in_time=case
          when public.staff_attendance.check_in_time is null then excluded.check_in_time
          when excluded.check_in_time is null then public.staff_attendance.check_in_time
          else least(public.staff_attendance.check_in_time,excluded.check_in_time)
        end,
        check_out_time=case
          when public.staff_attendance.check_out_time is null then excluded.check_out_time
          when excluded.check_out_time is null then public.staff_attendance.check_out_time
          else greatest(public.staff_attendance.check_out_time,excluded.check_out_time)
        end,
        early=(
          excluded.status='present'
          and (
            case
              when public.staff_attendance.check_in_time is null then excluded.check_in_time
              when excluded.check_in_time is null then public.staff_attendance.check_in_time
              else least(public.staff_attendance.check_in_time,excluded.check_in_time)
            end
          ) <= time '07:30:00'
        ),
        status=excluded.status,
        source=excluded.source,
        notes=excluded.notes,
        recorded_by=auth.uid(),
        device_user_id=coalesce(excluded.device_user_id,public.staff_attendance.device_user_id),
        device_record_id=coalesce(excluded.device_record_id,public.staff_attendance.device_record_id),
        raw_device_payload=excluded.raw_device_payload,
        imported_at=now(),
        updated_at=now();

      v_imported:=v_imported+1;
    exception when others then
      v_skipped:=v_skipped+1;
    end;
  end loop;

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,details
  ) values(
    v_school,auth.uid(),'Device Staff Attendance Imported','staff_attendance',
    jsonb_build_object(
      'source',coalesce(nullif(trim(p_source),''),'verification_device'),
      'early_cutoff','07:30:00',
      'imported',v_imported,
      'unmatched',v_unmatched,
      'skipped',v_skipped
    )
  );

  return jsonb_build_object(
    'imported',v_imported,
    'unmatched',v_unmatched,
    'skipped',v_skipped,
    'early_cutoff','07:30:00'
  );
end;
$$;

revoke all on function public.import_staff_device_attendance(jsonb,text) from public;
grant execute on function public.import_staff_device_attendance(jsonb,text) to authenticated;

commit;

commit;
)::bigint)
from public.staff
group by school_id
on conflict (school_id) do update
set last_number = excluded.last_number,
    updated_at = now();

alter table public.staff_employee_code_counters enable row level security;
revoke all on table public.staff_employee_code_counters from anon, authenticated;

-- Replace the previous counter-backed generator with an atomic per-school counter.
create or replace function public.next_staff_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_no bigint;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  insert into public.staff_employee_code_counters (school_id, last_number)
  values (v_school, 1)
  on conflict (school_id) do update
    set last_number = public.staff_employee_code_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_no;

  return 'ATIS-STF-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function public.next_staff_employee_code() from public;
grant execute on function public.next_staff_employee_code() to authenticated;

-- Device exports can continue using old employee codes, current codes, device IDs,
-- or staff names. The 07:30 early-attendance calculation is unchanged.
create or replace function public.import_staff_device_attendance(
  p_rows jsonb,
  p_source text default 'verification_device'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_row jsonb;
  v_identifier text;
  v_name text;
  v_staff uuid;
  v_date date;
  v_check_in time;
  v_check_out time;
  v_status text;
  v_early boolean;
  v_record_id text;
  v_imported integer:=0;
  v_unmatched integer:=0;
  v_skipped integer:=0;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Device attendance access is required';
  end if;

  if jsonb_typeof(p_rows)<>'array' then
    raise exception 'Attendance import must be an array';
  end if;

  v_school:=public.current_school_id();

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_identifier:=nullif(trim(coalesce(
        v_row->>'device_user_id',
        v_row->>'employee_code',
        v_row->>'user_id',
        v_row->>'staff_code'
      )),'');

      v_name:=nullif(trim(coalesce(v_row->>'staff_name',v_row->>'name')),'');
      v_date:=nullif(v_row->>'attendance_date','')::date;
      v_check_in:=nullif(v_row->>'check_in_time','')::time;
      v_check_out:=nullif(v_row->>'check_out_time','')::time;
      v_status:=lower(coalesce(nullif(trim(v_row->>'status'),''),'present'));
      v_record_id:=nullif(trim(coalesce(v_row->>'device_record_id','')),'');

      if (v_identifier is null and v_name is null) or v_date is null then
        v_skipped:=v_skipped+1;
        continue;
      end if;

      select coalesce(
        (
          select m.staff_id
          from public.staff_attendance_device_mappings m
          where m.school_id=v_school
            and m.active=true
            and v_identifier is not null
            and lower(m.device_user_id::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(coalesce(s.employee_code::text,''))=lower(v_identifier)
          limit 1
        ),
        (
          select h.staff_id
          from public.staff_employee_code_history h
          join public.staff s on s.id=h.staff_id
          where h.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(h.legacy_employee_code::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_name is not null
            and lower(regexp_replace(trim(s.full_name),'\s+',' ','g'))
                = lower(regexp_replace(trim(v_name),'\s+',' ','g'))
          limit 1
        )
      ) into v_staff;

      if v_staff is null then
        v_unmatched:=v_unmatched+1;
        continue;
      end if;

      if v_status not in ('present','absent','leave','sick','official') then
        v_status:='present';
      end if;

      -- ATIS rule: first registration at 07:30:00 or earlier counts as Early.
      -- The device's own early/late flag is deliberately ignored.
      v_early:=(
        v_status='present'
        and v_check_in is not null
        and v_check_in <= time '07:30:00'
      );

      insert into public.staff_attendance(
        school_id,staff_id,attendance_date,check_in_time,check_out_time,
        early,status,source,notes,recorded_by,
        device_user_id,device_record_id,raw_device_payload,imported_at
      ) values(
        v_school,v_staff,v_date,v_check_in,v_check_out,
        v_early,v_status,coalesce(nullif(trim(p_source),''),'verification_device'),
        'Imported from attendance verification device · Early cutoff 07:30',auth.uid(),
        coalesce(v_identifier,v_name),v_record_id,v_row,now()
      )
      on conflict(staff_id,attendance_date) do update set
        check_in_time=case
          when public.staff_attendance.check_in_time is null then excluded.check_in_time
          when excluded.check_in_time is null then public.staff_attendance.check_in_time
          else least(public.staff_attendance.check_in_time,excluded.check_in_time)
        end,
        check_out_time=case
          when public.staff_attendance.check_out_time is null then excluded.check_out_time
          when excluded.check_out_time is null then public.staff_attendance.check_out_time
          else greatest(public.staff_attendance.check_out_time,excluded.check_out_time)
        end,
        early=(
          excluded.status='present'
          and (
            case
              when public.staff_attendance.check_in_time is null then excluded.check_in_time
              when excluded.check_in_time is null then public.staff_attendance.check_in_time
              else least(public.staff_attendance.check_in_time,excluded.check_in_time)
            end
          ) <= time '07:30:00'
        ),
        status=excluded.status,
        source=excluded.source,
        notes=excluded.notes,
        recorded_by=auth.uid(),
        device_user_id=coalesce(excluded.device_user_id,public.staff_attendance.device_user_id),
        device_record_id=coalesce(excluded.device_record_id,public.staff_attendance.device_record_id),
        raw_device_payload=excluded.raw_device_payload,
        imported_at=now(),
        updated_at=now();

      v_imported:=v_imported+1;
    exception when others then
      v_skipped:=v_skipped+1;
    end;
  end loop;

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,details
  ) values(
    v_school,auth.uid(),'Device Staff Attendance Imported','staff_attendance',
    jsonb_build_object(
      'source',coalesce(nullif(trim(p_source),''),'verification_device'),
      'early_cutoff','07:30:00',
      'imported',v_imported,
      'unmatched',v_unmatched,
      'skipped',v_skipped
    )
  );

  return jsonb_build_object(
    'imported',v_imported,
    'unmatched',v_unmatched,
    'skipped',v_skipped,
    'early_cutoff','07:30:00'
  );
end;
$$;

revoke all on function public.import_staff_device_attendance(jsonb,text) from public;
grant execute on function public.import_staff_device_attendance(jsonb,text) to authenticated;

commit;

commit;
)::bigint),
      0
    ) as last_legacy_number
  from public.staff_employee_code_history
  group by school_id
),
numbered as (
  select
    s.id,
    row_number() over (
      partition by s.school_id
      order by s.created_at asc, s.id asc
    ) + coalesce(lm.last_legacy_number, 0) as staff_number
  from public.staff s
  left join legacy_max lm on lm.school_id = s.school_id
)
update public.staff s
set employee_code = 'ATIS-STF-' || lpad(numbered.staff_number::text, 4, '0'),
    updated_at = now()
from numbered
where numbered.id = s.id;

-- Keep the generator in sync so the next new employee receives the next number.
create table if not exists public.staff_employee_code_counters (
  school_id uuid primary key references public.schools(id) on delete cascade,
  last_number bigint not null default 0 check (last_number >= 0),
  updated_at timestamptz not null default now()
);

insert into public.staff_employee_code_counters (school_id, last_number)
select school_id, count(*)::bigint
from public.staff
group by school_id
on conflict (school_id) do update
set last_number = excluded.last_number,
    updated_at = now();

alter table public.staff_employee_code_counters enable row level security;
revoke all on table public.staff_employee_code_counters from anon, authenticated;

-- Replace the previous counter-backed generator with an atomic per-school counter.
create or replace function public.next_staff_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_no bigint;
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  insert into public.staff_employee_code_counters (school_id, last_number)
  values (v_school, 1)
  on conflict (school_id) do update
    set last_number = public.staff_employee_code_counters.last_number + 1,
        updated_at = now()
  returning last_number into v_no;

  return 'ATIS-STF-' || lpad(v_no::text, 4, '0');
end;
$$;

revoke all on function public.next_staff_employee_code() from public;
grant execute on function public.next_staff_employee_code() to authenticated;

-- Device exports can continue using old employee codes, current codes, device IDs,
-- or staff names. The 07:30 early-attendance calculation is unchanged.
create or replace function public.import_staff_device_attendance(
  p_rows jsonb,
  p_source text default 'verification_device'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_row jsonb;
  v_identifier text;
  v_name text;
  v_staff uuid;
  v_date date;
  v_check_in time;
  v_check_out time;
  v_status text;
  v_early boolean;
  v_record_id text;
  v_imported integer:=0;
  v_unmatched integer:=0;
  v_skipped integer:=0;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Device attendance access is required';
  end if;

  if jsonb_typeof(p_rows)<>'array' then
    raise exception 'Attendance import must be an array';
  end if;

  v_school:=public.current_school_id();

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    begin
      v_identifier:=nullif(trim(coalesce(
        v_row->>'device_user_id',
        v_row->>'employee_code',
        v_row->>'user_id',
        v_row->>'staff_code'
      )),'');

      v_name:=nullif(trim(coalesce(v_row->>'staff_name',v_row->>'name')),'');
      v_date:=nullif(v_row->>'attendance_date','')::date;
      v_check_in:=nullif(v_row->>'check_in_time','')::time;
      v_check_out:=nullif(v_row->>'check_out_time','')::time;
      v_status:=lower(coalesce(nullif(trim(v_row->>'status'),''),'present'));
      v_record_id:=nullif(trim(coalesce(v_row->>'device_record_id','')),'');

      if (v_identifier is null and v_name is null) or v_date is null then
        v_skipped:=v_skipped+1;
        continue;
      end if;

      select coalesce(
        (
          select m.staff_id
          from public.staff_attendance_device_mappings m
          where m.school_id=v_school
            and m.active=true
            and v_identifier is not null
            and lower(m.device_user_id::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(coalesce(s.employee_code::text,''))=lower(v_identifier)
          limit 1
        ),
        (
          select h.staff_id
          from public.staff_employee_code_history h
          join public.staff s on s.id=h.staff_id
          where h.school_id=v_school
            and s.status='active'
            and v_identifier is not null
            and lower(h.legacy_employee_code::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and v_name is not null
            and lower(regexp_replace(trim(s.full_name),'\s+',' ','g'))
                = lower(regexp_replace(trim(v_name),'\s+',' ','g'))
          limit 1
        )
      ) into v_staff;

      if v_staff is null then
        v_unmatched:=v_unmatched+1;
        continue;
      end if;

      if v_status not in ('present','absent','leave','sick','official') then
        v_status:='present';
      end if;

      -- ATIS rule: first registration at 07:30:00 or earlier counts as Early.
      -- The device's own early/late flag is deliberately ignored.
      v_early:=(
        v_status='present'
        and v_check_in is not null
        and v_check_in <= time '07:30:00'
      );

      insert into public.staff_attendance(
        school_id,staff_id,attendance_date,check_in_time,check_out_time,
        early,status,source,notes,recorded_by,
        device_user_id,device_record_id,raw_device_payload,imported_at
      ) values(
        v_school,v_staff,v_date,v_check_in,v_check_out,
        v_early,v_status,coalesce(nullif(trim(p_source),''),'verification_device'),
        'Imported from attendance verification device · Early cutoff 07:30',auth.uid(),
        coalesce(v_identifier,v_name),v_record_id,v_row,now()
      )
      on conflict(staff_id,attendance_date) do update set
        check_in_time=case
          when public.staff_attendance.check_in_time is null then excluded.check_in_time
          when excluded.check_in_time is null then public.staff_attendance.check_in_time
          else least(public.staff_attendance.check_in_time,excluded.check_in_time)
        end,
        check_out_time=case
          when public.staff_attendance.check_out_time is null then excluded.check_out_time
          when excluded.check_out_time is null then public.staff_attendance.check_out_time
          else greatest(public.staff_attendance.check_out_time,excluded.check_out_time)
        end,
        early=(
          excluded.status='present'
          and (
            case
              when public.staff_attendance.check_in_time is null then excluded.check_in_time
              when excluded.check_in_time is null then public.staff_attendance.check_in_time
              else least(public.staff_attendance.check_in_time,excluded.check_in_time)
            end
          ) <= time '07:30:00'
        ),
        status=excluded.status,
        source=excluded.source,
        notes=excluded.notes,
        recorded_by=auth.uid(),
        device_user_id=coalesce(excluded.device_user_id,public.staff_attendance.device_user_id),
        device_record_id=coalesce(excluded.device_record_id,public.staff_attendance.device_record_id),
        raw_device_payload=excluded.raw_device_payload,
        imported_at=now(),
        updated_at=now();

      v_imported:=v_imported+1;
    exception when others then
      v_skipped:=v_skipped+1;
    end;
  end loop;

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,details
  ) values(
    v_school,auth.uid(),'Device Staff Attendance Imported','staff_attendance',
    jsonb_build_object(
      'source',coalesce(nullif(trim(p_source),''),'verification_device'),
      'early_cutoff','07:30:00',
      'imported',v_imported,
      'unmatched',v_unmatched,
      'skipped',v_skipped
    )
  );

  return jsonb_build_object(
    'imported',v_imported,
    'unmatched',v_unmatched,
    'skipped',v_skipped,
    'early_cutoff','07:30:00'
  );
end;
$$;

revoke all on function public.import_staff_device_attendance(jsonb,text) from public;
grant execute on function public.import_staff_device_attendance(jsonb,text) to authenticated;

commit;

commit;
