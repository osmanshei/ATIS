-- ATIS Web v0.7.2 — core edit workflows and global-fee deduplication
begin;

-- ------------------------------------------------------------------
-- Repair duplicate charges created when a class-specific fee was later
-- promoted to a school-wide fee. Preserve the old row for history.
-- ------------------------------------------------------------------
update public.fee_items local_fee
set
  is_active=false,
  notes=concat_ws(
    E'\n',
    nullif(local_fee.notes,''),
    'Automatically deactivated because a school-wide fee with the same name applies for this term.'
  ),
  updated_at=now()
where local_fee.applies_to_all_students=false
  and local_fee.class_id is not null
  and local_fee.is_active=true
  and exists (
    select 1
    from public.fee_items global_fee
    where global_fee.school_id=local_fee.school_id
      and global_fee.term_id=local_fee.term_id
      and global_fee.applies_to_all_students=true
      and global_fee.is_active=true
      and lower(trim(global_fee.fee_name))=lower(trim(local_fee.fee_name))
  );

-- ------------------------------------------------------------------
-- Explicit fee editing by stable ID.
-- School-wide items supersede same-name class-specific items.
-- ------------------------------------------------------------------
create or replace function public.update_fee_item(
  p_fee_item_id uuid,
  p_payload jsonb
)
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
  v_name text;
  v_amount numeric;
  v_all boolean;
  v_active boolean;
begin
  if not public.is_finance_user() then
    raise exception 'Finance access is required';
  end if;

  v_school:=public.current_school_id();

  if not exists (
    select 1 from public.fee_items
    where id=p_fee_item_id and school_id=v_school
  ) then
    raise exception 'Fee item not found';
  end if;

  v_term:=nullif(p_payload->>'term_id','')::uuid;
  v_class:=nullif(p_payload->>'class_id','')::uuid;
  v_name:=nullif(trim(p_payload->>'fee_name'),'');
  v_amount:=nullif(p_payload->>'amount','')::numeric;
  v_all:=coalesce((p_payload->>'applies_to_all_students')::boolean,false);
  v_active:=coalesce((p_payload->>'is_active')::boolean,true);

  select academic_year_id into v_year
  from public.terms
  where id=v_term and school_id=v_school;

  if v_year is null then raise exception 'Choose a valid term'; end if;
  if v_name is null then raise exception 'Fee name is required'; end if;
  if v_amount is null or v_amount<0 then raise exception 'Enter a valid amount'; end if;

  if v_all then
    v_class:=null;

    if exists (
      select 1
      from public.fee_items fi
      where fi.id<>p_fee_item_id
        and fi.school_id=v_school
        and fi.term_id=v_term
        and fi.applies_to_all_students=true
        and lower(trim(fi.fee_name))=lower(v_name)
    ) then
      raise exception 'A school-wide fee with this name already exists for the term';
    end if;
  else
    if v_class is null or not exists (
      select 1 from public.classes c
      where c.id=v_class and c.school_id=v_school and c.is_active=true
    ) then
      raise exception 'Choose a valid class or mark the fee as applying to all students';
    end if;

    if exists (
      select 1
      from public.fee_items fi
      where fi.id<>p_fee_item_id
        and fi.school_id=v_school
        and fi.term_id=v_term
        and fi.applies_to_all_students=true
        and fi.is_active=true
        and lower(trim(fi.fee_name))=lower(v_name)
    ) then
      raise exception 'This fee is already school-wide for the selected term';
    end if;

    if exists (
      select 1
      from public.fee_items fi
      where fi.id<>p_fee_item_id
        and fi.school_id=v_school
        and fi.term_id=v_term
        and fi.class_id=v_class
        and fi.applies_to_all_students=false
        and lower(trim(fi.fee_name))=lower(v_name)
    ) then
      raise exception 'This class already has a fee with the same name for the selected term';
    end if;
  end if;

  update public.fee_items
  set
    academic_year_id=v_year,
    term_id=v_term,
    class_id=v_class,
    fee_name=v_name,
    fee_category=coalesce(nullif(trim(p_payload->>'fee_category'),''),'school_fee'),
    amount=v_amount,
    due_date=nullif(p_payload->>'due_date','')::date,
    is_concession_eligible=coalesce((p_payload->>'is_concession_eligible')::boolean,false),
    is_active=v_active,
    notes=nullif(trim(coalesce(p_payload->>'notes','')),''),
    applies_to_all_students=v_all,
    updated_at=now()
  where id=p_fee_item_id and school_id=v_school;

  if v_all and v_active then
    update public.fee_items local_fee
    set
      is_active=false,
      notes=concat_ws(
        E'\n',
        nullif(local_fee.notes,''),
        'Automatically deactivated because this fee is now school-wide.'
      ),
      updated_at=now()
    where local_fee.id<>p_fee_item_id
      and local_fee.school_id=v_school
      and local_fee.term_id=v_term
      and local_fee.applies_to_all_students=false
      and local_fee.class_id is not null
      and local_fee.is_active=true
      and lower(trim(local_fee.fee_name))=lower(v_name);
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Item Updated','fee_item',p_fee_item_id,p_payload
  );

  return p_fee_item_id;
end;
$$;

-- Prevent future duplicates when a new school-wide fee is created through
-- the existing save_fee_item function.
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

    if exists (
      select 1 from public.fee_items fi
      where fi.school_id=v_school
        and fi.term_id=v_term
        and fi.applies_to_all_students=true
        and fi.is_active=true
        and lower(trim(fi.fee_name))=lower(v_name)
    ) then
      raise exception 'This fee is already school-wide for the selected term';
    end if;
  end if;

  if v_all then
    select id into v_id
    from public.fee_items
    where school_id=v_school
      and term_id=v_term
      and applies_to_all_students=true
      and lower(trim(fee_name))=lower(v_name)
    limit 1;
  else
    select id into v_id
    from public.fee_items
    where school_id=v_school
      and term_id=v_term
      and class_id=v_class
      and applies_to_all_students=false
      and lower(trim(fee_name))=lower(v_name)
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

  if v_all and coalesce((p_payload->>'is_active')::boolean,true) then
    update public.fee_items local_fee
    set
      is_active=false,
      notes=concat_ws(
        E'\n',
        nullif(local_fee.notes,''),
        'Automatically deactivated because a school-wide fee with the same name applies for this term.'
      ),
      updated_at=now()
    where local_fee.id<>v_id
      and local_fee.school_id=v_school
      and local_fee.term_id=v_term
      and local_fee.applies_to_all_students=false
      and local_fee.class_id is not null
      and local_fee.is_active=true
      and lower(trim(local_fee.fee_name))=lower(v_name);
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Fee Item Saved','fee_item',v_id,
    jsonb_build_object(
      'term_id',v_term,'class_id',v_class,'applies_to_all_students',v_all,
      'fee_name',v_name,'amount',v_amount
    )
  );

  return v_id;
end;
$$;

-- ------------------------------------------------------------------
-- Core master-data edit functions.
-- ------------------------------------------------------------------
create or replace function public.update_student_record(
  p_student_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_class uuid;
  v_first text;
  v_last text;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Student editing is not available to this account';
  end if;

  v_school:=public.current_school_id();
  v_class:=nullif(p_payload->>'class_id','')::uuid;
  v_first:=nullif(trim(p_payload->>'first_name'),'');
  v_last:=nullif(trim(p_payload->>'last_name'),'');

  if v_first is null or v_last is null then
    raise exception 'First name and last name are required';
  end if;

  if v_class is not null and not exists (
    select 1 from public.classes
    where id=v_class and school_id=v_school
  ) then
    raise exception 'Choose a valid class';
  end if;

  update public.students
  set
    admission_number=nullif(trim(p_payload->>'admission_number'),''),
    first_name=v_first,
    middle_name=nullif(trim(p_payload->>'middle_name'),''),
    last_name=v_last,
    preferred_name=nullif(trim(p_payload->>'preferred_name'),''),
    gender=nullif(trim(p_payload->>'gender'),''),
    date_of_birth=nullif(p_payload->>'date_of_birth','')::date,
    admission_date=nullif(p_payload->>'admission_date','')::date,
    class_id=v_class,
    roll_number=nullif(trim(p_payload->>'roll_number'),''),
    category=nullif(trim(p_payload->>'category'),''),
    address_line=nullif(trim(p_payload->>'address_line'),''),
    city=nullif(trim(p_payload->>'city'),''),
    region=nullif(trim(p_payload->>'region'),''),
    nationality=coalesce(nullif(trim(p_payload->>'nationality'),''),'Ghanaian'),
    medical_notes=nullif(trim(p_payload->>'medical_notes'),''),
    dietary_requirements=nullif(trim(p_payload->>'dietary_requirements'),''),
    allergies=nullif(trim(p_payload->>'allergies'),''),
    special_needs=nullif(trim(p_payload->>'special_needs'),''),
    house_name=nullif(trim(p_payload->>'house_name'),''),
    admission_type=nullif(trim(p_payload->>'admission_type'),''),
    concession_percent=coalesce(nullif(p_payload->>'concession_percent','')::numeric,0),
    transport_required=coalesce((p_payload->>'transport_required')::boolean,false),
    transport_route=nullif(trim(p_payload->>'transport_route'),''),
    status=coalesce(nullif(p_payload->>'status','')::public.student_status,status),
    updated_at=now()
  where id=p_student_id and school_id=v_school;

  if not found then raise exception 'Student not found'; end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Student Updated','student',p_student_id,p_payload
  );

  return p_student_id;
end;
$$;

create or replace function public.update_staff_record(
  p_staff_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_name text;
  v_role public.app_role;
  v_status public.account_status;
  v_user uuid;
  v_email citext;
  v_mobile text;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can edit staff';
  end if;

  v_school:=public.current_school_id();
  v_name:=nullif(trim(p_payload->>'full_name'),'');
  v_role:=coalesce(nullif(p_payload->>'role','')::public.app_role,'staff'::public.app_role);
  v_status:=coalesce(nullif(p_payload->>'status','')::public.account_status,'active'::public.account_status);
  v_email:=nullif(trim(p_payload->>'email'),'')::citext;
  v_mobile:=nullif(trim(p_payload->>'mobile'),'');

  if v_name is null then raise exception 'Staff name is required'; end if;
  if v_role in ('student','parent') then raise exception 'Invalid staff role'; end if;

  update public.staff
  set
    employee_code=nullif(trim(p_payload->>'employee_code'),'')::citext,
    full_name=v_name,
    email=v_email,
    mobile=v_mobile,
    role=v_role,
    position_title=nullif(trim(p_payload->>'position_title'),''),
    gender=nullif(trim(p_payload->>'gender'),''),
    date_of_birth=nullif(p_payload->>'date_of_birth','')::date,
    qualification=nullif(trim(p_payload->>'qualification'),''),
    specialization_duty=nullif(trim(p_payload->>'specialization_duty'),''),
    joining_date=nullif(p_payload->>'joining_date','')::date,
    address=nullif(trim(p_payload->>'address'),''),
    emergency_contact_name=nullif(trim(p_payload->>'emergency_contact_name'),''),
    emergency_contact_phone=nullif(trim(p_payload->>'emergency_contact_phone'),''),
    status=v_status,
    updated_at=now()
  where id=p_staff_id and school_id=v_school
  returning user_id into v_user;

  if not found then raise exception 'Staff record not found'; end if;

  if v_user is not null then
    update public.profiles
    set
      full_name=v_name,
      email=coalesce(v_email,email),
      mobile=v_mobile,
      role=v_role,
      status=v_status,
      updated_at=now()
    where user_id=v_user and school_id=v_school;
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Staff Updated','staff',p_staff_id,p_payload
  );

  return p_staff_id;
end;
$$;

create or replace function public.update_subject_record(
  p_subject_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_name text;
  v_code citext;
  v_report boolean;
  v_active boolean;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can edit subjects';
  end if;

  v_school:=public.current_school_id();
  v_name:=nullif(trim(p_payload->>'subject_name'),'');
  v_code:=nullif(upper(trim(p_payload->>'subject_code')),'')::citext;
  v_report:=coalesce((p_payload->>'include_on_report')::boolean,true);
  v_active:=coalesce((p_payload->>'is_active')::boolean,true);

  if v_name is null or v_code is null then
    raise exception 'Subject name and code are required';
  end if;

  update public.subject_catalogue
  set
    subject_name=v_name,
    subject_code=v_code,
    subject_group=nullif(trim(p_payload->>'subject_group'),''),
    include_on_report=v_report,
    is_active=v_active,
    updated_at=now()
  where id=p_subject_id and school_id=v_school;

  if not found then raise exception 'Subject not found'; end if;

  if not v_report or not v_active then
    update public.assessment_setups a
    set status='draft',updated_at=now()
    from public.class_subjects cs
    where a.class_subject_id=cs.id
      and cs.subject_id=p_subject_id
      and a.school_id=v_school
      and a.status<>'draft';
  end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Subject Updated','subject',p_subject_id,p_payload
  );

  return p_subject_id;
end;
$$;

create or replace function public.update_class_record(
  p_class_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_name text;
begin
  if public.current_app_role() not in ('admin','supervisor') then
    raise exception 'Only Admin or Supervisor can edit classes';
  end if;

  v_school:=public.current_school_id();
  v_name:=nullif(trim(p_payload->>'class_name'),'');

  if v_name is null then raise exception 'Class name is required'; end if;

  update public.classes
  set
    class_name=v_name,
    section=nullif(trim(p_payload->>'section'),''),
    grade_level=nullif(p_payload->>'grade_level','')::integer,
    class_code=nullif(trim(p_payload->>'class_code'),'')::citext,
    max_capacity=nullif(p_payload->>'max_capacity','')::integer,
    room_number=nullif(trim(p_payload->>'room_number'),''),
    is_active=coalesce((p_payload->>'is_active')::boolean,true),
    updated_at=now()
  where id=p_class_id and school_id=v_school;

  if not found then raise exception 'Class not found'; end if;

  insert into public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values (
    v_school,auth.uid(),'Class Updated','class',p_class_id,p_payload
  );

  return p_class_id;
end;
$$;

revoke all on function public.update_fee_item(uuid,jsonb) from public;
revoke all on function public.update_student_record(uuid,jsonb) from public;
revoke all on function public.update_staff_record(uuid,jsonb) from public;
revoke all on function public.update_subject_record(uuid,jsonb) from public;
revoke all on function public.update_class_record(uuid,jsonb) from public;

grant execute on function public.update_fee_item(uuid,jsonb) to authenticated;
grant execute on function public.update_student_record(uuid,jsonb) to authenticated;
grant execute on function public.update_staff_record(uuid,jsonb) to authenticated;
grant execute on function public.update_subject_record(uuid,jsonb) to authenticated;
grant execute on function public.update_class_record(uuid,jsonb) to authenticated;

commit;
