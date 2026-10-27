-- ATIS Web v0.10.3 — automatic 07:30 early-attendance rule
begin;

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
