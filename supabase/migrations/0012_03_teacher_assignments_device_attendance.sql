-- ATIS Web v0.10.2 — teacher assignment bundles and verification-device staff attendance
begin;

-- ---------------------------------------------------------------------------
-- Teacher assignment bundle
-- ---------------------------------------------------------------------------
create or replace function public.save_teacher_assignment_bundle(
  p_teacher_id uuid,
  p_class_id uuid,
  p_subject_ids uuid[],
  p_is_class_teacher boolean default false
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_year uuid;
  v_count integer;
  v_subject_id uuid;
  v_class_subject_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Teacher assignment access is required';
  end if;

  v_school:=public.current_school_id();

  select id into v_year
  from public.academic_years
  where school_id=v_school and is_current=true
  limit 1;

  if v_year is null then
    raise exception 'Configure a current academic year first';
  end if;

  if not exists(
    select 1 from public.staff
    where id=p_teacher_id
      and school_id=v_school
      and role='teacher'
      and status='active'
  ) then
    raise exception 'Choose a valid active teacher';
  end if;

  if not exists(
    select 1 from public.classes
    where id=p_class_id
      and school_id=v_school
      and academic_year_id=v_year
      and is_active=true
  ) then
    raise exception 'Choose a valid active class';
  end if;

  if coalesce(array_length(p_subject_ids,1),0)=0 then
    raise exception 'Select at least one subject';
  end if;

  -- Remove previous subject links for this teacher/class that are not selected.
  delete from public.teacher_assignments ta
  using public.class_subjects cs
  where ta.class_subject_id=cs.id
    and ta.school_id=v_school
    and ta.teacher_id=p_teacher_id
    and ta.academic_year_id=v_year
    and cs.class_id=p_class_id
    and cs.subject_id <> all(p_subject_ids);

  foreach v_subject_id in array p_subject_ids
  loop
    select id into v_class_subject_id
    from public.class_subjects
    where school_id=v_school
      and class_id=p_class_id
      and subject_id=v_subject_id
      and is_active=true
    limit 1;

    if v_class_subject_id is null then
      raise exception 'One or more selected subjects are not configured for this class';
    end if;

    insert into public.teacher_assignments(
      school_id,teacher_id,class_subject_id,academic_year_id,is_class_teacher
    ) values(
      v_school,p_teacher_id,v_class_subject_id,v_year,false
    )
    on conflict(teacher_id,class_subject_id,academic_year_id) do nothing;
  end loop;

  if p_is_class_teacher then
    update public.classes
    set class_teacher_id=p_teacher_id,updated_at=now()
    where id=p_class_id and school_id=v_school;

    update public.teacher_assignments ta
    set is_class_teacher=(ta.teacher_id=p_teacher_id),updated_at=now()
    from public.class_subjects cs
    where ta.class_subject_id=cs.id
      and ta.school_id=v_school
      and ta.academic_year_id=v_year
      and cs.class_id=p_class_id;
  else
    update public.classes
    set class_teacher_id=null,updated_at=now()
    where id=p_class_id
      and school_id=v_school
      and class_teacher_id=p_teacher_id;

    update public.teacher_assignments ta
    set is_class_teacher=false,updated_at=now()
    from public.class_subjects cs
    where ta.class_subject_id=cs.id
      and ta.school_id=v_school
      and ta.teacher_id=p_teacher_id
      and ta.academic_year_id=v_year
      and cs.class_id=p_class_id;
  end if;

  select count(*) into v_count
  from public.teacher_assignments ta
  join public.class_subjects cs on cs.id=ta.class_subject_id
  where ta.school_id=v_school
    and ta.teacher_id=p_teacher_id
    and ta.academic_year_id=v_year
    and cs.class_id=p_class_id;

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values(
    v_school,auth.uid(),'Teacher Assignment Bundle Saved','staff',p_teacher_id,
    jsonb_build_object(
      'class_id',p_class_id,
      'subject_count',v_count,
      'is_class_teacher',p_is_class_teacher
    )
  );

  return v_count;
end;
$$;

revoke all on function public.save_teacher_assignment_bundle(uuid,uuid,uuid[],boolean) from public;
grant execute on function public.save_teacher_assignment_bundle(uuid,uuid,uuid[],boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Verification-device attendance
-- ---------------------------------------------------------------------------
create table if not exists public.staff_attendance_device_mappings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  device_user_id citext not null,
  device_name text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,device_user_id),
  unique(staff_id)
);

alter table public.staff_attendance
  add column if not exists device_user_id text,
  add column if not exists device_record_id text,
  add column if not exists raw_device_payload jsonb,
  add column if not exists imported_at timestamptz;

drop trigger if exists set_staff_attendance_device_mappings_updated_at
  on public.staff_attendance_device_mappings;
create trigger set_staff_attendance_device_mappings_updated_at
before update on public.staff_attendance_device_mappings
for each row execute function public.set_updated_at();

alter table public.staff_attendance_device_mappings enable row level security;
revoke all on table public.staff_attendance_device_mappings from anon,authenticated;
grant select on table public.staff_attendance_device_mappings to authenticated;

drop policy if exists staff_attendance_device_mappings_read
  on public.staff_attendance_device_mappings;
create policy staff_attendance_device_mappings_read
on public.staff_attendance_device_mappings
for select to authenticated
using(
  school_id=public.current_school_id()
  and public.current_app_role() in ('admin','supervisor','clerk')
);

drop policy if exists staff_attendance_read on public.staff_attendance;
create policy staff_attendance_read on public.staff_attendance
for select to authenticated
using(
  school_id=public.current_school_id()
  and (
    public.current_app_role() in ('admin','supervisor','accountant','clerk')
    or staff_id=public.current_staff_id()
  )
);

create or replace function public.save_staff_attendance_device_mapping(
  p_staff_id uuid,
  p_device_user_id text,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_id uuid;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Device attendance access is required';
  end if;

  v_school:=public.current_school_id();

  if nullif(trim(p_device_user_id),'') is null then
    raise exception 'Device user ID is required';
  end if;

  if not exists(
    select 1 from public.staff
    where id=p_staff_id and school_id=v_school and status='active'
  ) then
    raise exception 'Choose a valid active staff member';
  end if;

  insert into public.staff_attendance_device_mappings(
    school_id,staff_id,device_user_id,device_name,active,created_by
  ) values(
    v_school,p_staff_id,trim(p_device_user_id),
    nullif(trim(coalesce(p_device_name,'')),''),true,auth.uid()
  )
  on conflict(staff_id) do update set
    device_user_id=excluded.device_user_id,
    device_name=excluded.device_name,
    active=true,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

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

      v_date:=nullif(v_row->>'attendance_date','')::date;
      v_check_in:=nullif(v_row->>'check_in_time','')::time;
      v_check_out:=nullif(v_row->>'check_out_time','')::time;
      v_status:=lower(coalesce(nullif(trim(v_row->>'status'),''),'present'));
      v_early:=coalesce((v_row->>'early')::boolean,false);
      v_record_id:=nullif(trim(coalesce(v_row->>'device_record_id','')),'');

      if v_identifier is null or v_date is null then
        v_skipped:=v_skipped+1;
        continue;
      end if;

      select coalesce(
        (
          select m.staff_id
          from public.staff_attendance_device_mappings m
          where m.school_id=v_school
            and m.active=true
            and lower(m.device_user_id::text)=lower(v_identifier)
          limit 1
        ),
        (
          select s.id
          from public.staff s
          where s.school_id=v_school
            and s.status='active'
            and lower(coalesce(s.employee_code::text,''))=lower(v_identifier)
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

      insert into public.staff_attendance(
        school_id,staff_id,attendance_date,check_in_time,check_out_time,
        early,status,source,notes,recorded_by,
        device_user_id,device_record_id,raw_device_payload,imported_at
      ) values(
        v_school,v_staff,v_date,v_check_in,v_check_out,
        v_early,v_status,coalesce(nullif(trim(p_source),''),'verification_device'),
        'Imported from attendance verification device',auth.uid(),
        v_identifier,v_record_id,v_row,now()
      )
      on conflict(staff_id,attendance_date) do update set
        check_in_time=excluded.check_in_time,
        check_out_time=excluded.check_out_time,
        early=excluded.early,
        status=excluded.status,
        source=excluded.source,
        notes=excluded.notes,
        recorded_by=auth.uid(),
        device_user_id=excluded.device_user_id,
        device_record_id=excluded.device_record_id,
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
      'imported',v_imported,
      'unmatched',v_unmatched,
      'skipped',v_skipped
    )
  );

  return jsonb_build_object(
    'imported',v_imported,
    'unmatched',v_unmatched,
    'skipped',v_skipped
  );
end;
$$;

revoke all on function public.save_staff_attendance_device_mapping(uuid,text,text) from public;
revoke all on function public.import_staff_device_attendance(jsonb,text) from public;
grant execute on function public.save_staff_attendance_device_mapping(uuid,text,text) to authenticated;
grant execute on function public.import_staff_device_attendance(jsonb,text) to authenticated;

-- Manual web attendance entry is no longer the preferred workflow.
revoke all on function public.save_staff_attendance(uuid,date,time,text,boolean,text) from authenticated;

commit;
