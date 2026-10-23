-- ATIS Web v0.2.0 — Transactional student bulk onboarding
begin;

create or replace function public.atis_upsert_guardian(
  p_school_id uuid,
  p_full_name text,
  p_mobile text,
  p_occupation text,
  p_address text,
  p_city text,
  p_relation text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_digits text;
  v_key text;
  v_id uuid;
begin
  v_name := nullif(trim(coalesce(p_full_name,'')),'');
  v_digits := regexp_replace(coalesce(p_mobile,''),'[^0-9]','','g');

  if v_name is null and v_digits='' then return null; end if;
  if v_name is null then v_name := 'Guardian'; end if;

  -- Reuse an existing guardian regardless of whether it came from the legacy
  -- migration or from the hosted app.
  select id into v_id
  from public.guardians
  where school_id=p_school_id
    and lower(trim(full_name))=lower(v_name)
    and regexp_replace(coalesce(mobile,''),'[^0-9]','','g')=v_digits
  limit 1;

  if v_id is not null then return v_id; end if;

  v_key := 'live|' || v_digits || '|' || lower(v_name) || '|' || lower(coalesce(p_relation,'guardian'));

  insert into public.guardians (
    school_id,migration_key,full_name,mobile,occupation,address,city,country,
    nationality,whatsapp_number,status,legacy_payload
  ) values (
    p_school_id,v_key,v_name,nullif(v_digits,''),nullif(trim(coalesce(p_occupation,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_city,'')),''),
    'Ghana','Ghanaian',nullif(v_digits,''),'active',
    jsonb_build_object('source','hosted_onboarding')
  )
  on conflict (school_id,migration_key) where migration_key is not null
  do update set
    full_name=excluded.full_name,
    mobile=excluded.mobile,
    occupation=coalesce(excluded.occupation,public.guardians.occupation),
    address=coalesce(excluded.address,public.guardians.address),
    city=coalesce(excluded.city,public.guardians.city),
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.bulk_onboard_students(
  p_rows jsonb,
  p_file_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_row jsonb;
  v_student uuid;
  v_guardian uuid;
  v_imported integer := 0;
  v_duplicates integer := 0;
  v_class uuid;
  v_admission text;
  v_guardian_name text;
  v_guardian_mobile text;
  v_guardian_relation text;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be a JSON array';
  end if;

  if jsonb_array_length(p_rows) > 1500 then
    raise exception 'A single import is limited to 1500 students';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_admission := nullif(trim(v_row->>'admission_number'),'');
    v_class := nullif(v_row->>'class_id','')::uuid;

    if v_admission is null
       or nullif(trim(v_row->>'first_name'),'') is null
       or nullif(trim(v_row->>'last_name'),'') is null
       or v_class is null then
      raise exception 'Validated import contains a row with missing required values';
    end if;

    if not exists (
      select 1 from public.classes
      where id=v_class and school_id=v_school and is_active=true
    ) then
      raise exception 'Validated import references an invalid class';
    end if;

    if exists (
      select 1 from public.students
      where school_id=v_school and lower(admission_number::text)=lower(v_admission)
    ) then
      v_duplicates := v_duplicates + 1;
      continue;
    end if;

    insert into public.students (
      school_id,admission_number,first_name,middle_name,last_name,gender,date_of_birth,
      admission_date,class_id,address_line,city,region,nhis_no,ghana_card_no,
      medical_notes,status,legacy_payload
    ) values (
      v_school,v_admission,trim(v_row->>'first_name'),
      nullif(trim(v_row->>'middle_name'),''),
      trim(v_row->>'last_name'),
      nullif(trim(v_row->>'gender'),''),
      nullif(v_row->>'date_of_birth','')::date,
      coalesce(nullif(v_row->>'admission_date','')::date,current_date),
      v_class,
      nullif(trim(v_row->>'address_line'),''),
      nullif(trim(v_row->>'city'),''),
      nullif(trim(v_row->>'region'),''),
      nullif(trim(v_row->>'nhis_no'),''),
      nullif(trim(v_row->>'ghana_card_no'),''),
      nullif(trim(v_row->>'medical_notes'),''),
      'active',
      jsonb_build_object('source','hosted_bulk_onboarding','import_file',p_file_name)
    )
    returning id into v_student;

    v_guardian_name := nullif(trim(v_row->>'guardian_name'),'');
    v_guardian_mobile := nullif(trim(v_row->>'guardian_mobile'),'');
    v_guardian_relation := coalesce(nullif(trim(v_row->>'guardian_relation'),''),'Guardian');

    if v_guardian_name is not null or v_guardian_mobile is not null then
      v_guardian := public.atis_upsert_guardian(
        v_school,v_guardian_name,v_guardian_mobile,null,
        v_row->>'address_line',v_row->>'city',v_guardian_relation
      );

      if v_guardian is not null then
        insert into public.student_guardians (
          school_id,student_id,guardian_id,relation,is_primary_contact
        ) values (
          v_school,v_student,v_guardian,v_guardian_relation,true
        )
        on conflict (student_id,guardian_id) do update set
          relation=excluded.relation,
          is_primary_contact=true;
      end if;
    end if;

    v_imported := v_imported + 1;
  end loop;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,details
  ) values (
    v_school,auth.uid(),'Hosted Student Bulk Onboarding','student_import',
    jsonb_build_object(
      'file_name',p_file_name,
      'submitted_rows',jsonb_array_length(p_rows),
      'imported',v_imported,
      'database_duplicates',v_duplicates
    )
  );

  return jsonb_build_object('imported',v_imported,'duplicates',v_duplicates);
end;
$$;

revoke all on function public.bulk_onboard_students(jsonb,text) from public;
grant execute on function public.bulk_onboard_students(jsonb,text) to authenticated;

commit;
