-- ATIS Web v0.8.0 — Parent/Student Portal and private student photos
begin;

-- ------------------------------------------------------------
-- Private student-photo storage
-- Object key format: <school_id>/<student_id>/profile
-- ------------------------------------------------------------
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'student-photos',
  'student-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create or replace function public.student_photo_student_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_text text;
begin
  v_text:=split_part(coalesce(object_name,''),'/',2);
  if v_text='' then return null; end if;
  begin
    return v_text::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

revoke all on function public.student_photo_student_id(text) from public;
grant execute on function public.student_photo_student_id(text) to authenticated;

drop policy if exists atis_student_photos_read on storage.objects;
create policy atis_student_photos_read
on storage.objects for select to authenticated
using (
  bucket_id='student-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and exists (
    select 1
    from public.students s
    where s.id=public.student_photo_student_id(name)
      and s.school_id=(select public.current_school_id())
      and public.can_read_student(s.id,s.class_id)
  )
);

drop policy if exists atis_student_photos_insert on storage.objects;
create policy atis_student_photos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='student-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
  and exists (
    select 1
    from public.students s
    where s.id=public.student_photo_student_id(name)
      and s.school_id=(select public.current_school_id())
  )
);

drop policy if exists atis_student_photos_update on storage.objects;
create policy atis_student_photos_update
on storage.objects for update to authenticated
using (
  bucket_id='student-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
)
with check (
  bucket_id='student-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

drop policy if exists atis_student_photos_delete on storage.objects;
create policy atis_student_photos_delete
on storage.objects for delete to authenticated
using (
  bucket_id='student-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

-- ------------------------------------------------------------
-- Portal access helpers. These functions intentionally expose only
-- the signed-in student or children linked to the signed-in guardian.
-- ------------------------------------------------------------
create or replace function public.portal_can_access_student(p_student_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_class uuid;
  v_role public.app_role;
begin
  v_role:=public.current_app_role();
  if v_role not in ('student','parent') then return false; end if;

  select class_id into v_class
  from public.students
  where id=p_student_id
    and school_id=public.current_school_id();

  if not found then return false; end if;
  return public.can_read_student(p_student_id,v_class);
end;
$$;

revoke all on function public.portal_can_access_student(uuid) from public;
grant execute on function public.portal_can_access_student(uuid) to authenticated;

create or replace function public.portal_students()
returns table (
  id uuid,
  admission_number text,
  first_name text,
  middle_name text,
  last_name text,
  gender text,
  date_of_birth date,
  class_id uuid,
  class_name text,
  section text,
  photo_url text
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_student uuid;
  v_guardian uuid;
begin
  v_role:=public.current_app_role();

  if v_role='student' then
    v_student:=public.current_student_id();
    return query
    select
      s.id,s.admission_number::text,s.first_name,s.middle_name,s.last_name,
      s.gender,s.date_of_birth,s.class_id,c.class_name,c.section,s.photo_url
    from public.students s
    left join public.classes c on c.id=s.class_id
    where s.id=v_student
      and s.school_id=public.current_school_id()
      and s.status='active';
    return;
  end if;

  if v_role='parent' then
    v_guardian:=public.current_guardian_id();
    return query
    select
      s.id,s.admission_number::text,s.first_name,s.middle_name,s.last_name,
      s.gender,s.date_of_birth,s.class_id,c.class_name,c.section,s.photo_url
    from public.student_guardians sg
    join public.students s on s.id=sg.student_id
    left join public.classes c on c.id=s.class_id
    where sg.guardian_id=v_guardian
      and sg.school_id=public.current_school_id()
      and s.status='active'
    order by s.first_name,s.last_name;
    return;
  end if;

  raise exception 'This portal is available only to student and parent accounts';
end;
$$;

create or replace function public.portal_results(p_student_id uuid,p_term_id uuid)
returns table (
  setup_id uuid,
  subject_name text,
  subject_code text,
  ca_weighted_score numeric,
  exam_weighted_score numeric,
  total_score numeric,
  grade text,
  interpretation text,
  grade_remark text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.portal_can_access_student(p_student_id) then
    raise exception 'You do not have access to this student';
  end if;

  return query
  select
    r.setup_id,r.subject_name,r.subject_code,
    r.ca_weighted_score,r.exam_weighted_score,r.total_score,
    r.grade,r.interpretation,r.grade_remark
  from public.student_subject_results r
  join public.result_publications rp
    on rp.school_id=r.school_id
   and rp.term_id=r.term_id
   and rp.class_id=r.class_id
   and rp.status='published'
  where r.student_id=p_student_id
    and r.term_id=p_term_id
    and r.result_complete=true
  order by r.subject_name;
end;
$$;

create or replace function public.portal_report_meta(p_student_id uuid,p_term_id uuid)
returns table (
  teacher_remark text,
  headteacher_remark text,
  conduct text,
  next_term_begins date,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.portal_can_access_student(p_student_id) then
    raise exception 'You do not have access to this student';
  end if;

  return query
  select
    rr.teacher_remark,rr.headteacher_remark,rr.conduct,rr.next_term_begins,
    rp.published_at
  from public.students s
  join public.result_publications rp
    on rp.class_id=s.class_id
   and rp.term_id=p_term_id
   and rp.status='published'
  left join public.report_remarks rr
    on rr.student_id=s.id
   and rr.class_id=s.class_id
   and rr.term_id=p_term_id
  where s.id=p_student_id
    and s.school_id=public.current_school_id()
  limit 1;
end;
$$;

create or replace function public.portal_attendance(p_student_id uuid,p_term_id uuid)
returns table (
  attendance_date date,
  status text,
  remark text
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.portal_can_access_student(p_student_id) then
    raise exception 'You do not have access to this student';
  end if;

  return query
  select ses.attendance_date,rec.status::text,rec.remark
  from public.attendance_records rec
  join public.attendance_sessions ses on ses.id=rec.session_id
  where rec.student_id=p_student_id
    and ses.term_id=p_term_id
    and ses.school_id=public.current_school_id()
    and ses.mode='daily'
  order by ses.attendance_date desc;
end;
$$;

create or replace function public.portal_finance_summary(p_student_id uuid,p_term_id uuid)
returns table (
  gross_fees numeric,
  concession_percent numeric,
  concession_amount numeric,
  additional_adjustment numeric,
  net_fees numeric,
  amount_paid numeric,
  outstanding_balance numeric,
  credit_balance numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.portal_can_access_student(p_student_id) then
    raise exception 'You do not have access to this student';
  end if;

  return query
  select
    f.gross_fees,f.concession_percent,f.concession_amount,
    f.additional_adjustment,f.net_fees,f.amount_paid,
    f.outstanding_balance,f.credit_balance
  from public.student_fee_summary f
  where f.student_id=p_student_id
    and f.term_id=p_term_id
    and f.school_id=public.current_school_id()
  limit 1;
end;
$$;

create or replace function public.portal_payments(p_student_id uuid,p_term_id uuid)
returns table (
  id uuid,
  payment_date date,
  receipt_no text,
  fee_name text,
  amount numeric,
  payment_method text,
  is_reversed boolean
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not public.portal_can_access_student(p_student_id) then
    raise exception 'You do not have access to this student';
  end if;

  return query
  select
    fp.id,fp.payment_date,fp.receipt_no::text,fi.fee_name,fp.amount,
    fp.payment_method,(r.id is not null)
  from public.fee_payments fp
  left join public.fee_items fi on fi.id=fp.fee_item_id
  left join public.fee_payment_reversals r on r.payment_id=fp.id
  where fp.student_id=p_student_id
    and fp.term_id=p_term_id
    and fp.school_id=public.current_school_id()
  order by fp.payment_date desc,fp.created_at desc;
end;
$$;

revoke all on function public.portal_students() from public;
revoke all on function public.portal_results(uuid,uuid) from public;
revoke all on function public.portal_report_meta(uuid,uuid) from public;
revoke all on function public.portal_attendance(uuid,uuid) from public;
revoke all on function public.portal_finance_summary(uuid,uuid) from public;
revoke all on function public.portal_payments(uuid,uuid) from public;

grant execute on function public.portal_students() to authenticated;
grant execute on function public.portal_results(uuid,uuid) to authenticated;
grant execute on function public.portal_report_meta(uuid,uuid) to authenticated;
grant execute on function public.portal_attendance(uuid,uuid) to authenticated;
grant execute on function public.portal_finance_summary(uuid,uuid) to authenticated;
grant execute on function public.portal_payments(uuid,uuid) to authenticated;

commit;
