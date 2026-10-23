-- ATIS staging core snapshot import
-- Generated from ATIS_ERP_PRODUCTION on 2026-10-23.
-- READ-ONLY source snapshot: this file writes only to Supabase staging.
-- Old password hashes and embedded base64 profile photos are intentionally excluded.

begin;

do $$
declare
  v_school uuid;
  v_year uuid;
begin
  select id into v_school from public.schools where code='ATIS';
  select id into v_year from public.academic_years
    where school_id=v_school and name='2026-2027';

  if v_school is null then raise exception 'ATIS school seed not found'; end if;
  if v_year is null then raise exception '2026-2027 academic year seed not found'; end if;


  -- Existing staging administrator: enrich the manually-created Auth-linked staff row.
  update public.staff set
    legacy_id=1,
    employee_code='ATIS-ADMIN',
    full_name='SHEI OSMAN',
    mobile='0203511553',
    role='admin'::public.app_role,
    position_title='Administrator',
    gender='male',
    date_of_birth='1988-11-13',
    qualification='B.Ed IT',
    specialization_duty='Administration',
    joining_date='2023-01-01',
    address='P.O. Box LL71, Bimbilla, Northern Region - Ghana',
    emergency_contact_name=null,
    emergency_contact_phone=null,
    status='active'::public.account_status,
    legacy_payload=jsonb_build_object('source_username', 'admin', 'source_created_at', '2026-10-11T14:03:41.581Z', 'source_updated_at', '2026-10-11T21:20:25.816Z', 'source_last_login', '2026-10-22T17:40:23.485Z', 'profile_photo_migration_pending', true)
  where school_id=v_school and lower(email::text)=lower('alkhalidiyatechnical@gmail.com');

  if not found then
    insert into public.staff (
      school_id, legacy_id, employee_code, full_name, email, mobile, role,
      position_title, gender, date_of_birth, qualification, specialization_duty,
      joining_date, address, emergency_contact_name, emergency_contact_phone,
      status, legacy_payload
    ) values (
      v_school, 1, 'ATIS-ADMIN', 'SHEI OSMAN', 'alkhalidiyatechnical@gmail.com', '0203511553',
      'admin'::public.app_role, 'Administrator', 'male', '1988-11-13', 'B.Ed IT',
      'Administration', '2023-01-01', 'P.O. Box LL71, Bimbilla, Northern Region - Ghana', null,
      null, 'active'::public.account_status, jsonb_build_object('source_username', 'admin', 'source_created_at', '2026-10-11T14:03:41.581Z', 'source_updated_at', '2026-10-11T21:20:25.816Z', 'source_last_login', '2026-10-22T17:40:23.485Z', 'profile_photo_migration_pending', true)
    );
  end if;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 2, 'EMP001', 'AMIN SEY', 'aminroot25@gmail.cim', '0537630483',
    'teacher'::public.app_role, 'Teacher', 'male', '1990-05-08', 'HND',
    null, '2026-01-05', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'asey', 'source_created_at', '2026-10-21T11:45:10.217Z', 'source_updated_at', '2026-10-21T11:45:10.217Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 3, 'EMP002', 'IDDRISU LATIFA', 'latifaiddrisu79@gmail.com', '0241858127',
    'teacher'::public.app_role, 'Teacher', 'female', '1990-04-20', 'WASSCE',
    null, '2024-01-10', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ilatifa', 'source_created_at', '2026-10-21T11:45:12.196Z', 'source_updated_at', '2026-10-21T11:45:12.196Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 4, 'EMP003', 'IDDRISU ZEINAB', 'iddrisuzeinab97@gmail.com', '0593787703',
    'teacher'::public.app_role, 'Teacher', 'female', '2005-07-01', 'WASSCE',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'izeinab', 'source_created_at', '2026-10-21T11:45:14.504Z', 'source_updated_at', '2026-10-21T11:45:14.504Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 5, 'EMP004', 'ABDUL-RAHMAN ABUBAKAR SADICK', 'abdulrahmanabubakarsadicksapas@gmail.com', '0241575540',
    'teacher'::public.app_role, 'Teacher', 'male', '1997-08-20', 'DIPLOMA',
    null, '2023-01-01', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'asadick', 'source_created_at', '2026-10-21T11:45:16.946Z', 'source_updated_at', '2026-10-21T11:45:16.946Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 6, 'EMP005', 'MBANBA FADILA', 'mbambafadilax@gmail.com', '0548522182',
    'teacher'::public.app_role, 'Teacher', 'female', null, 'WASSCE',
    null, '2025-10-01', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'mfadila', 'source_created_at', '2026-10-21T11:45:19.166Z', 'source_updated_at', '2026-10-21T11:45:19.166Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 7, 'EMP006', 'AMIDU ISSAHAKU', 'amiduissahaku1234@gmail.com', '0539815311',
    'teacher'::public.app_role, 'Teacher', 'male', null, 'WASSCE',
    null, '2025-01-13', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'aissahaku', 'source_created_at', '2026-10-21T11:45:21.109Z', 'source_updated_at', '2026-10-21T11:45:21.109Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 8, 'EMP007', 'ALHASSAN SADIA', 'sadiaalhassan218@gmail.com', '0246538218',
    'teacher'::public.app_role, 'Teacher', 'female', '1989-12-03', 'DIPLOMA',
    null, '2023-05-15', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'asadia', 'source_created_at', '2026-10-21T11:45:23.138Z', 'source_updated_at', '2026-10-21T11:45:23.138Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 9, 'EMP010', 'MUNKAILA M. RIDAW', 'mail@mail.com', '0598108053',
    'teacher'::public.app_role, 'Teacher', 'male', '2007-08-10', 'WASSCE',
    null, '2026-09-01', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'mridaw', 'source_created_at', '2026-10-21T11:45:25.260Z', 'source_updated_at', '2026-10-21T11:45:25.260Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 10, 'EMP012', 'ZAKARIA HANIFA', 'hanifazakaria168@gmail.com', '0240489336',
    'teacher'::public.app_role, 'Teacher', 'female', null, 'DEGREE',
    null, '2025-10-01', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'zhanifa', 'source_created_at', '2026-10-21T11:45:32.972Z', 'source_updated_at', '2026-10-21T11:45:32.972Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 11, 'EMP013', 'IDDRISU HADIJA', 'iddrisuhadij053@gmail.com', '0596901757',
    'teacher'::public.app_role, 'Teacher', 'female', null, 'WASSCE',
    null, '2024-09-24', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ihadija', 'source_created_at', '2026-10-21T11:45:35.040Z', 'source_updated_at', '2026-10-21T11:45:35.040Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 12, 'EMP014', 'TANKO SADILAN', 'sadilaniceberg2nd@gmail.com', '0535421053',
    'teacher'::public.app_role, 'Teacher', 'male', null, 'DIPLOMA',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'tsadilan', 'source_created_at', '2026-10-21T11:45:37.421Z', 'source_updated_at', '2026-10-21T11:45:37.421Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 13, 'EMP015', 'ISSAHAKU SHAFAW', 'abdulraufshafaha@gmail.com', '0550169494',
    'teacher'::public.app_role, 'Teacher', 'female', '1998-07-14', 'WASSCE',
    null, '2024-10-10', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ishafaw', 'source_created_at', '2026-10-21T11:45:39.383Z', 'source_updated_at', '2026-10-21T11:45:39.383Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 14, 'EMP016', 'SAYIBU SAWBAN', 'sawbansayibu@gmail.com', '0540932844',
    'teacher'::public.app_role, 'Teacher', 'male', '2003-03-10', 'WASSCE',
    null, '2024-01-10', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ssawban', 'source_created_at', '2026-10-21T11:45:41.973Z', 'source_updated_at', '2026-10-21T11:45:41.973Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 15, 'EMP017', 'SHAHADU HUSSAIN', 'shahaduhussain@gmail.com', '0249249320',
    'teacher'::public.app_role, 'Teacher', 'male', null, 'WASSCE',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'shussain', 'source_created_at', '2026-10-21T11:45:44.389Z', 'source_updated_at', '2026-10-21T11:45:44.389Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 16, 'EMP018', 'MUMIN SAMRAA SUGLO', 'samraamumin@gmail.com', '0247596924',
    'teacher'::public.app_role, 'Teacher', 'female', '2008-11-17', 'WASSCE',
    null, '2026-09-01', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'msuglo', 'source_created_at', '2026-10-21T11:45:46.376Z', 'source_updated_at', '2026-10-21T11:45:46.376Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 17, 'EMP019', 'YAKUBU LATIFA', 'latifayakubu181@gmail.com', '0557511985',
    'teacher'::public.app_role, 'Teacher', 'female', null, 'DEGREE',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ylatifa', 'source_created_at', '2026-10-21T11:45:48.894Z', 'source_updated_at', '2026-10-21T11:45:48.894Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 18, 'EMP020', 'SHAHADU SURAIYA', 'shahadusuraiya31@gmail.com', '0535720437',
    'teacher'::public.app_role, 'Teacher', 'female', null, 'WASSCE',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ssuraiya', 'source_created_at', '2026-10-21T11:45:51.280Z', 'source_updated_at', '2026-10-21T11:45:51.280Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 19, 'EMP022', 'RASHAD NADLE', 'nadleastonish@gmail.com', '0538368422',
    'teacher'::public.app_role, 'Teacher', 'male', null, 'WASSCE',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'rnadle', 'source_created_at', '2026-10-21T11:45:58.854Z', 'source_updated_at', '2026-10-21T11:45:58.854Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 20, 'EMP023', 'IBRAHIM ABDUL- FATTAH', 'iabdulfataw3@gmail.com', '0552321277',
    'teacher'::public.app_role, 'Teacher', 'male', null, 'WASSCE',
    'Arabic', '2023-01-01', null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'ifattah', 'source_created_at', '2026-10-21T11:46:00.855Z', 'source_updated_at', '2026-10-21T11:51:11.503Z', 'source_last_login', null, 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.staff (
    school_id, legacy_id, employee_code, full_name, email, mobile, role,
    position_title, gender, date_of_birth, qualification, specialization_duty,
    joining_date, address, emergency_contact_name, emergency_contact_phone,
    status, legacy_payload
  ) values (
    v_school, 21, 'EMP025', 'ABUKARI MOHAMMED GADAFI', 'mohammedgadafi38@gmail.com', '0246699962',
    'clerk'::public.app_role, 'Clerk', 'male', '1986-08-22', 'DIPLOMA',
    null, null, null, null,
    null, 'active'::public.account_status, jsonb_build_object('source_username', 'agadafi', 'source_created_at', '2026-10-21T11:46:02.482Z', 'source_updated_at', '2026-10-22T13:00:43.378Z', 'source_last_login', '2026-10-22T13:01:49.192Z', 'profile_photo_migration_pending', true)
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    employee_code=excluded.employee_code,
    full_name=excluded.full_name,
    email=excluded.email,
    mobile=excluded.mobile,
    role=excluded.role,
    position_title=excluded.position_title,
    gender=excluded.gender,
    date_of_birth=excluded.date_of_birth,
    qualification=excluded.qualification,
    specialization_duty=excluded.specialization_duty,
    joining_date=excluded.joining_date,
    address=excluded.address,
    emergency_contact_name=excluded.emergency_contact_name,
    emergency_contact_phone=excluded.emergency_contact_phone,
    status=excluded.status,
    legacy_payload=excluded.legacy_payload;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 1, 'NURSERY ONE', null,
    0, 'NURSERY 1', 'nursery', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=10),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 2, 'NURSERY TWO', 'A',
    0, 'NURSERY 2A', 'nursery', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=4),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 3, 'NURSERY TWO', 'B',
    0, 'NURSERY 2B', 'nursery', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=11),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 4, 'KINDERGARTEN ONE', null,
    0, 'KG1', 'kg', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=8),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 5, 'KINDERGARTEN TWO', null,
    0, 'KG2', 'kg', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=17),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 6, 'BASIC ONE', null,
    1, 'B1', 'primary', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=2),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 7, 'BASIC TWO', null,
    2, 'B2', 'primary', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=5),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 8, 'BASIC THREE', null,
    3, 'B3', 'primary', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=19),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 9, 'BASIC FOUR', null,
    4, 'B4', 'primary', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=18),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.classes (
    school_id, academic_year_id, legacy_id, class_name, section, grade_level,
    class_code, curriculum_stage, medium_of_instruction, subject_stream,
    max_capacity, room_number, building, class_teacher_id, assistant_teacher_id,
    is_active, shift
  ) values (
    v_school, v_year, 10, 'BASIC FIVE', null,
    5, 'B5', 'primary', 'english',
    'general', 50, null, 'Main',
    (select id from public.staff where school_id=v_school and legacy_id=12),
    null,
    true, 'full_day'
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    academic_year_id=excluded.academic_year_id,
    class_name=excluded.class_name,
    section=excluded.section,
    grade_level=excluded.grade_level,
    class_code=excluded.class_code,
    curriculum_stage=excluded.curriculum_stage,
    medium_of_instruction=excluded.medium_of_instruction,
    subject_stream=excluded.subject_stream,
    max_capacity=excluded.max_capacity,
    room_number=excluded.room_number,
    building=excluded.building,
    class_teacher_id=excluded.class_teacher_id,
    assistant_teacher_id=excluded.assistant_teacher_id,
    is_active=excluded.is_active,
    shift=excluded.shift;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 1, 'LANG', 'LANGUAGE & LITERACY', 'LANG',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'admin')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 2, 'NUMERACY', 'NUMERACY', 'NUMERACY',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 3, 'COLOURING', 'EXPRESSIVE ARTS & DESIGN', 'COLOURING',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 4, 'ARABIC', 'ARABIC LANGUAGE', 'ARABIC',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 5, 'MATHS', 'MATHEMATICS', 'MATHS',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 6, 'C. ARTS', 'CREATIVE ARTS', 'C. ARTS',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 7, 'SCIENCE', 'NATURAL SCIENCE', 'SCIENCE',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 8, 'COMPUTING', 'COMPUTING', 'COMPUTING',
    true, true,
    jsonb_build_object('source_created_by', 'system-migration', 'source_updated_by', 'system-migration')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 9, 'P.E', 'PHYSICAL DEVELOPMENT', 'P.E',
    false, true,
    jsonb_build_object('source_created_by', 'admin', 'source_updated_by', 'admin')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 10, 'DAGBANLI', 'GHANAIAN LANGUAGE & CULTURE', 'DAGBANLI',
    false, true,
    jsonb_build_object('source_created_by', 'admin', 'source_updated_by', 'admin')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.subject_catalogue (
    school_id, legacy_id, legacy_code, subject_name, subject_code, include_on_report,
    is_active, legacy_payload
  ) values (
    v_school, 11, 'ENG', 'ENGLISH LANGUAGE', 'ENG',
    true, true,
    jsonb_build_object('source_created_by', 'admin', 'source_updated_by', 'admin')
  )
  on conflict (school_id, subject_code) do update set
    legacy_id=excluded.legacy_id,
    legacy_code=excluded.legacy_code,
    subject_name=excluded.subject_name,
    include_on_report=excluded.include_on_report,
    is_active=excluded.is_active,
    legacy_payload=excluded.legacy_payload;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 1,
    (select id from public.classes where school_id=v_school and legacy_id=1),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='LANG'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 2,
    (select id from public.classes where school_id=v_school and legacy_id=1),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='NUMERACY'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 3,
    (select id from public.classes where school_id=v_school and legacy_id=1),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COLOURING'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 4,
    (select id from public.classes where school_id=v_school and legacy_id=1),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 5,
    (select id from public.classes where school_id=v_school and legacy_id=6),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ENG'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 6,
    (select id from public.classes where school_id=v_school and legacy_id=6),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='MATHS'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 7,
    (select id from public.classes where school_id=v_school and legacy_id=6),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='C. ARTS'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 8,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='SCIENCE'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 9,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COMPUTING'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 10,
    (select id from public.classes where school_id=v_school and legacy_id=2),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='LANG'),
    100, 0, 'theory', 100,
    0, 0, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 11,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 12,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 13,
    (select id from public.classes where school_id=v_school and legacy_id=6),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 14,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 15,
    (select id from public.classes where school_id=v_school and legacy_id=7),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 16,
    (select id from public.classes where school_id=v_school and legacy_id=4),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 17,
    (select id from public.classes where school_id=v_school and legacy_id=5),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 18,
    (select id from public.classes where school_id=v_school and legacy_id=2),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 19,
    (select id from public.classes where school_id=v_school and legacy_id=3),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ARABIC'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 20,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COMPUTING'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 21,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='C. ARTS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 22,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='C. ARTS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 23,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='C. ARTS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 24,
    (select id from public.classes where school_id=v_school and legacy_id=7),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='C. ARTS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 25,
    (select id from public.classes where school_id=v_school and legacy_id=4),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COLOURING'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 26,
    (select id from public.classes where school_id=v_school and legacy_id=5),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COLOURING'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 27,
    (select id from public.classes where school_id=v_school and legacy_id=2),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COLOURING'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 28,
    (select id from public.classes where school_id=v_school and legacy_id=3),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='COLOURING'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 29,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 30,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 31,
    (select id from public.classes where school_id=v_school and legacy_id=6),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 32,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 33,
    (select id from public.classes where school_id=v_school and legacy_id=7),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 34,
    (select id from public.classes where school_id=v_school and legacy_id=4),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 35,
    (select id from public.classes where school_id=v_school and legacy_id=5),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 36,
    (select id from public.classes where school_id=v_school and legacy_id=1),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 37,
    (select id from public.classes where school_id=v_school and legacy_id=2),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 38,
    (select id from public.classes where school_id=v_school and legacy_id=3),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='DAGBANLI'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 39,
    (select id from public.classes where school_id=v_school and legacy_id=4),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='LANG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 40,
    (select id from public.classes where school_id=v_school and legacy_id=5),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='LANG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 41,
    (select id from public.classes where school_id=v_school and legacy_id=3),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='LANG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 42,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='MATHS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 43,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='MATHS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 44,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='MATHS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 45,
    (select id from public.classes where school_id=v_school and legacy_id=7),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='MATHS'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 46,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='SCIENCE'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 47,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='SCIENCE'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 48,
    (select id from public.classes where school_id=v_school and legacy_id=4),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='NUMERACY'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 49,
    (select id from public.classes where school_id=v_school and legacy_id=5),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='NUMERACY'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 50,
    (select id from public.classes where school_id=v_school and legacy_id=2),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='NUMERACY'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 51,
    (select id from public.classes where school_id=v_school and legacy_id=3),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='NUMERACY'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 52,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 53,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 54,
    (select id from public.classes where school_id=v_school and legacy_id=6),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 55,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 56,
    (select id from public.classes where school_id=v_school and legacy_id=7),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 57,
    (select id from public.classes where school_id=v_school and legacy_id=4),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 58,
    (select id from public.classes where school_id=v_school and legacy_id=5),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 59,
    (select id from public.classes where school_id=v_school and legacy_id=1),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 60,
    (select id from public.classes where school_id=v_school and legacy_id=2),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 61,
    (select id from public.classes where school_id=v_school and legacy_id=3),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='P.E'),
    100, 33, 'theory', 100,
    0, 33, 0,
    true, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 62,
    (select id from public.classes where school_id=v_school and legacy_id=10),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ENG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 63,
    (select id from public.classes where school_id=v_school and legacy_id=9),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ENG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 64,
    (select id from public.classes where school_id=v_school and legacy_id=8),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ENG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.class_subjects (
    school_id, legacy_id, class_id, subject_id, max_marks, pass_marks, subject_type,
    theory_max_marks, practical_max_marks, theory_pass_marks, practical_pass_marks,
    is_optional, is_active
  ) values (
    v_school, 65,
    (select id from public.classes where school_id=v_school and legacy_id=7),
    (select id from public.subject_catalogue where school_id=v_school and subject_code='ENG'),
    100, 33, 'theory', 100,
    0, 33, 0,
    false, true
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    class_id=excluded.class_id,
    subject_id=excluded.subject_id,
    max_marks=excluded.max_marks,
    pass_marks=excluded.pass_marks,
    subject_type=excluded.subject_type,
    theory_max_marks=excluded.theory_max_marks,
    practical_max_marks=excluded.practical_max_marks,
    theory_pass_marks=excluded.theory_pass_marks,
    practical_pass_marks=excluded.practical_pass_marks,
    is_optional=excluded.is_optional,
    is_active=excluded.is_active;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 1,
    (select id from public.staff where school_id=v_school and legacy_id=5),
    (select id from public.class_subjects where school_id=v_school and legacy_id=45),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 2,
    (select id from public.staff where school_id=v_school and legacy_id=5),
    (select id from public.class_subjects where school_id=v_school and legacy_id=56),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 3,
    (select id from public.staff where school_id=v_school and legacy_id=5),
    (select id from public.class_subjects where school_id=v_school and legacy_id=33),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 4,
    (select id from public.staff where school_id=v_school and legacy_id=5),
    (select id from public.class_subjects where school_id=v_school and legacy_id=15),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 5,
    (select id from public.staff where school_id=v_school and legacy_id=5),
    (select id from public.class_subjects where school_id=v_school and legacy_id=65),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 6,
    (select id from public.staff where school_id=v_school and legacy_id=8),
    (select id from public.class_subjects where school_id=v_school and legacy_id=39),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 7,
    (select id from public.staff where school_id=v_school and legacy_id=8),
    (select id from public.class_subjects where school_id=v_school and legacy_id=48),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

  insert into public.teacher_assignments (
    school_id, legacy_id, teacher_id, class_subject_id, academic_year_id,
    is_class_teacher, periods_per_week
  ) values (
    v_school, 8,
    (select id from public.staff where school_id=v_school and legacy_id=8),
    (select id from public.class_subjects where school_id=v_school and legacy_id=57),
    v_year, false, 0
  )
  on conflict (school_id, legacy_id) where legacy_id is not null do update set
    teacher_id=excluded.teacher_id,
    class_subject_id=excluded.class_subject_id,
    academic_year_id=excluded.academic_year_id,
    is_class_teacher=excluded.is_class_teacher,
    periods_per_week=excluded.periods_per_week;

end $$;

commit;
