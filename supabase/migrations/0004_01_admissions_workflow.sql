-- ATIS Web v0.2.0 — Admissions workflow
-- Register applicant -> Confirm admission -> Print letter -> Enroll student.

begin;

create table if not exists public.school_counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  counter_name text not null,
  current_value bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (school_id, counter_name)
);

create table if not exists public.admissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  legacy_id bigint,
  registration_number citext not null,
  first_name text not null,
  middle_name text,
  last_name text not null,
  gender text,
  date_of_birth date,
  applied_for_class_id uuid references public.classes(id) on delete set null,
  admission_type text not null default 'fresh',
  previous_school text,
  transfer_certificate_number text,
  last_class_attended text,
  address_line text,
  city text,
  region text,
  postal_code text,
  father_name text,
  father_mobile text,
  father_occupation text,
  mother_name text,
  mother_mobile text,
  mother_occupation text,
  guardian_name text,
  guardian_relation text,
  guardian_mobile text,
  student_email citext,
  student_mobile text,
  registration_date date not null default current_date,
  registration_fee numeric(12,2) not null default 0,
  registration_fee_mode text,
  registration_fee_receipt_no text,
  status text not null default 'registered'
    check (status in ('registered','under_review','admitted','enrolled','rejected','cancelled')),
  blood_group text,
  nhis_no text,
  category text,
  medical_notes text,
  admission_fee numeric(12,2) not null default 0,
  admission_fee_mode text,
  admission_fee_receipt_no text,
  admission_confirmed_date date,
  allotted_class_id uuid references public.classes(id) on delete set null,
  roll_number text,
  admission_number citext,
  admission_date date,
  entry_point text,
  transport_required boolean not null default false,
  transport_route text,
  linked_student_id uuid references public.students(id) on delete set null,
  rejection_reason text,
  remarks text,
  processed_by uuid references auth.users(id) on delete set null,
  ghana_card_no text,
  photo_url text,
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, registration_number)
);

create unique index if not exists admissions_admission_number_unique_idx
  on public.admissions (school_id, admission_number)
  where admission_number is not null and admission_number::text <> '';

create index if not exists admissions_school_status_idx
  on public.admissions (school_id, status);

create index if not exists admissions_applied_class_idx
  on public.admissions (applied_for_class_id);

drop trigger if exists set_admissions_updated_at on public.admissions;
create trigger set_admissions_updated_at
before update on public.admissions
for each row execute function public.set_updated_at();

alter table public.school_counters enable row level security;
alter table public.admissions enable row level security;

revoke all on table public.school_counters from anon, authenticated;
revoke all on table public.admissions from anon, authenticated;

grant select, insert, update on table public.admissions to authenticated;

create policy admissions_read on public.admissions
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create policy admissions_insert on public.admissions
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create policy admissions_update on public.admissions
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create or replace function public.atis_take_counter(
  p_school_id uuid,
  p_counter_name text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value bigint;
begin
  insert into public.school_counters (school_id, counter_name, current_value)
  values (p_school_id, p_counter_name, 1)
  on conflict (school_id, counter_name)
  do update set
    current_value = public.school_counters.current_value + 1,
    updated_at = now()
  returning current_value into v_value;

  return v_value;
end;
$$;

revoke all on function public.atis_take_counter(uuid,text) from public;

create or replace function public.create_admission(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_year public.academic_years%rowtype;
  v_class uuid;
  v_id uuid;
  v_no bigint;
  v_registration text;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  select * into v_year
  from public.academic_years
  where school_id=v_school and is_current=true
  limit 1;

  if v_year.id is null then
    raise exception 'Current academic year is not configured';
  end if;

  v_class := nullif(p_payload->>'applied_for_class_id','')::uuid;
  if v_class is null or not exists (
    select 1 from public.classes
    where id=v_class and school_id=v_school and is_active=true
  ) then
    raise exception 'Choose a valid active class';
  end if;

  if nullif(trim(p_payload->>'first_name'),'') is null
     or nullif(trim(p_payload->>'last_name'),'') is null then
    raise exception 'First name and last name are required';
  end if;

  v_no := public.atis_take_counter(
    v_school,
    'registration_' || replace(v_year.name,'-','_')
  );
  v_registration := 'REG-' || left(v_year.name,4) || '-' || lpad(v_no::text,4,'0');

  insert into public.admissions (
    school_id, academic_year_id, registration_number,
    first_name, middle_name, last_name, gender, date_of_birth,
    applied_for_class_id, admission_type, previous_school,
    address_line, city, region, postal_code,
    father_name, father_mobile, father_occupation,
    mother_name, mother_mobile, mother_occupation,
    guardian_name, guardian_relation, guardian_mobile,
    student_email, student_mobile, registration_date,
    blood_group, nhis_no, category, medical_notes,
    transport_required, transport_route, ghana_card_no,
    remarks, processed_by
  ) values (
    v_school, v_year.id, v_registration,
    trim(p_payload->>'first_name'),
    nullif(trim(p_payload->>'middle_name'),''),
    trim(p_payload->>'last_name'),
    nullif(trim(p_payload->>'gender'),''),
    nullif(p_payload->>'date_of_birth','')::date,
    v_class,
    coalesce(nullif(trim(p_payload->>'admission_type'),''),'fresh'),
    nullif(trim(p_payload->>'previous_school'),''),
    nullif(trim(p_payload->>'address_line'),''),
    nullif(trim(p_payload->>'city'),''),
    nullif(trim(p_payload->>'region'),''),
    nullif(trim(p_payload->>'postal_code'),''),
    nullif(trim(p_payload->>'father_name'),''),
    nullif(trim(p_payload->>'father_mobile'),''),
    nullif(trim(p_payload->>'father_occupation'),''),
    nullif(trim(p_payload->>'mother_name'),''),
    nullif(trim(p_payload->>'mother_mobile'),''),
    nullif(trim(p_payload->>'mother_occupation'),''),
    nullif(trim(p_payload->>'guardian_name'),''),
    coalesce(nullif(trim(p_payload->>'guardian_relation'),''),'Guardian'),
    nullif(trim(p_payload->>'guardian_mobile'),''),
    nullif(trim(p_payload->>'student_email'),'')::citext,
    nullif(trim(p_payload->>'student_mobile'),''),
    coalesce(nullif(p_payload->>'registration_date','')::date,current_date),
    nullif(trim(p_payload->>'blood_group'),''),
    nullif(trim(p_payload->>'nhis_no'),''),
    nullif(trim(p_payload->>'category'),''),
    nullif(trim(p_payload->>'medical_notes'),''),
    coalesce(nullif(p_payload->>'transport_required','')::boolean,false),
    nullif(trim(p_payload->>'transport_route'),''),
    nullif(trim(p_payload->>'ghana_card_no'),''),
    nullif(trim(p_payload->>'remarks'),''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school, auth.uid(), 'Admission Registered', 'admission', v_id,
    jsonb_build_object('registration_number',v_registration)
  );

  return v_id;
end;
$$;

create or replace function public.confirm_admission(
  p_admission_id uuid,
  p_allotted_class_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_adm public.admissions%rowtype;
  v_year public.academic_years%rowtype;
  v_class uuid;
  v_no bigint;
  v_admission_number text;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  select * into v_adm
  from public.admissions
  where id=p_admission_id and school_id=v_school
  for update;

  if v_adm.id is null then raise exception 'Admission record not found'; end if;
  if v_adm.status in ('enrolled','rejected','cancelled') then
    raise exception 'Admission cannot be confirmed from status %', v_adm.status;
  end if;

  select * into v_year from public.academic_years where id=v_adm.academic_year_id;
  v_class := coalesce(p_allotted_class_id,v_adm.applied_for_class_id);

  if not exists (
    select 1 from public.classes
    where id=v_class and school_id=v_school and is_active=true
  ) then
    raise exception 'Choose a valid active class';
  end if;

  v_admission_number := v_adm.admission_number::text;
  if coalesce(v_admission_number,'')='' then
    v_no := public.atis_take_counter(
      v_school,
      'admission_' || replace(v_year.name,'-','_')
    );
    v_admission_number := 'ATIS-' || left(v_year.name,4) || '-' || lpad(v_no::text,4,'0');
  end if;

  update public.admissions set
    status='admitted',
    admission_number=v_admission_number,
    allotted_class_id=v_class,
    admission_confirmed_date=coalesce(admission_confirmed_date,current_date),
    admission_date=coalesce(admission_date,current_date),
    processed_by=auth.uid()
  where id=p_admission_id;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school, auth.uid(), 'Admission Confirmed', 'admission', p_admission_id,
    jsonb_build_object('admission_number',v_admission_number,'class_id',v_class)
  );

  return v_admission_number;
end;
$$;

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

  v_key := 'live|' || v_digits || '|' || lower(v_name) || '|' || lower(coalesce(p_relation,'guardian'));

  insert into public.guardians (
    school_id,migration_key,full_name,mobile,occupation,address,city,country,
    nationality,whatsapp_number,status,legacy_payload
  ) values (
    p_school_id,v_key,v_name,nullif(v_digits,''),nullif(trim(coalesce(p_occupation,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_city,'')),''),
    'Ghana','Ghanaian',nullif(v_digits,''),'active',
    jsonb_build_object('source','hosted_admissions')
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

revoke all on function public.atis_upsert_guardian(uuid,text,text,text,text,text,text) from public;

create or replace function public.enroll_admission(p_admission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_adm public.admissions%rowtype;
  v_student uuid;
  v_guardian uuid;
  v_father uuid;
  v_mother uuid;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Not authorized';
  end if;

  v_school := public.current_school_id();

  select * into v_adm
  from public.admissions
  where id=p_admission_id and school_id=v_school
  for update;

  if v_adm.id is null then raise exception 'Admission record not found'; end if;
  if v_adm.linked_student_id is not null then return v_adm.linked_student_id; end if;
  if v_adm.status <> 'admitted' then
    raise exception 'Admission must be confirmed before enrollment';
  end if;

  insert into public.students (
    school_id,admission_number,first_name,middle_name,last_name,gender,date_of_birth,
    admission_date,class_id,nhis_no,ghana_card_no,previous_school,address_line,city,
    region,photo_url,medical_notes,transport_required,transport_route,status,
    legacy_payload
  ) values (
    v_school,v_adm.admission_number,v_adm.first_name,v_adm.middle_name,v_adm.last_name,
    v_adm.gender,v_adm.date_of_birth,coalesce(v_adm.admission_date,current_date),
    v_adm.allotted_class_id,v_adm.nhis_no,v_adm.ghana_card_no,v_adm.previous_school,
    v_adm.address_line,v_adm.city,v_adm.region,v_adm.photo_url,v_adm.medical_notes,
    v_adm.transport_required,v_adm.transport_route,'active',
    jsonb_build_object('source','hosted_admissions','registration_number',v_adm.registration_number)
  )
  returning id into v_student;

  v_father := public.atis_upsert_guardian(
    v_school,v_adm.father_name,v_adm.father_mobile,v_adm.father_occupation,
    v_adm.address_line,v_adm.city,'Father'
  );
  v_mother := public.atis_upsert_guardian(
    v_school,v_adm.mother_name,v_adm.mother_mobile,v_adm.mother_occupation,
    v_adm.address_line,v_adm.city,'Mother'
  );
  v_guardian := public.atis_upsert_guardian(
    v_school,v_adm.guardian_name,v_adm.guardian_mobile,null,
    v_adm.address_line,v_adm.city,coalesce(v_adm.guardian_relation,'Guardian')
  );

  if v_father is not null then
    insert into public.student_guardians (
      school_id,student_id,guardian_id,relation,is_primary_contact
    ) values (
      v_school,v_student,v_father,'Father',
      (v_guardian is null and v_mother is null)
    )
    on conflict (student_id,guardian_id) do nothing;
  end if;

  if v_mother is not null then
    insert into public.student_guardians (
      school_id,student_id,guardian_id,relation,is_primary_contact
    ) values (
      v_school,v_student,v_mother,'Mother',
      (v_guardian is null and v_father is null)
    )
    on conflict (student_id,guardian_id) do nothing;
  end if;

  if v_guardian is not null then
    insert into public.student_guardians (
      school_id,student_id,guardian_id,relation,is_primary_contact
    ) values (
      v_school,v_student,v_guardian,coalesce(v_adm.guardian_relation,'Guardian'),true
    )
    on conflict (student_id,guardian_id) do update set is_primary_contact=true;
  end if;

  update public.admissions set
    status='enrolled',
    linked_student_id=v_student,
    processed_by=auth.uid()
  where id=p_admission_id;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school,auth.uid(),'Student Enrolled','admission',p_admission_id,
    jsonb_build_object('student_id',v_student,'admission_number',v_adm.admission_number)
  );

  return v_student;
end;
$$;

create or replace function public.reject_admission(
  p_admission_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
begin
  if public.current_app_role() not in ('admin','supervisor','clerk') then
    raise exception 'Not authorized';
  end if;
  v_school := public.current_school_id();

  update public.admissions set
    status='rejected',
    rejection_reason=nullif(trim(p_reason),''),
    processed_by=auth.uid()
  where id=p_admission_id
    and school_id=v_school
    and status not in ('enrolled','cancelled');

  if not found then raise exception 'Admission cannot be rejected'; end if;

  insert into public.audit_logs (school_id,actor_user_id,action,entity_type,entity_id,details)
  values (
    v_school,auth.uid(),'Admission Rejected','admission',p_admission_id,
    jsonb_build_object('reason',p_reason)
  );
end;
$$;

revoke all on function public.create_admission(jsonb) from public;
revoke all on function public.confirm_admission(uuid,uuid) from public;
revoke all on function public.enroll_admission(uuid) from public;
revoke all on function public.reject_admission(uuid,text) from public;

grant execute on function public.create_admission(jsonb) to authenticated;
grant execute on function public.confirm_admission(uuid,uuid) to authenticated;
grant execute on function public.enroll_admission(uuid) to authenticated;
grant execute on function public.reject_admission(uuid,text) to authenticated;

commit;
