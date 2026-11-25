-- Role-scoped, read-only directory views.
-- These views are SECURITY DEFINER views with explicit role and school filters.
-- The underlying tables remain the source of truth; the views expose only the
-- fields each operational role needs.

CREATE OR REPLACE VIEW public.student_role_directory
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  s.id,
  s.school_id,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.user_id END AS user_id,
  s.admission_number,
  s.first_name,
  s.middle_name,
  s.last_name,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk','teacher') THEN s.preferred_name END AS preferred_name,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk','teacher') THEN s.gender END AS gender,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk','teacher') THEN s.date_of_birth END AS date_of_birth,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.admission_date END AS admission_date,
  s.class_id,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk','teacher') THEN s.roll_number END AS roll_number,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.category END AS category,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.nhis_no END AS nhis_no,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.ghana_card_no END AS ghana_card_no,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.previous_school END AS previous_school,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.address_line END AS address_line,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.city END AS city,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.region END AS region,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.postal_code END AS postal_code,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.nationality END AS nationality,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.second_nationality END AS second_nationality,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.country_of_birth END AS country_of_birth,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk','teacher') THEN s.photo_url END AS photo_url,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','teacher') THEN s.medical_notes END AS medical_notes,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk','teacher') THEN s.dietary_requirements END AS dietary_requirements,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','teacher') THEN s.allergies END AS allergies,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','teacher') THEN s.special_needs END AS special_needs,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','accountant','clerk') THEN s.concession_percent END AS concession_percent,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.house_name END AS house_name,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.admission_type END AS admission_type,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.media_consent END AS media_consent,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.transport_required END AS transport_required,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.transport_route END AS transport_route,
  s.status,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.student_section END AS student_section,
  s.created_at,
  s.updated_at,
  c.class_name,
  c.section AS class_section,
  c.section AS section
FROM public.students s
LEFT JOIN public.classes c
  ON c.id = s.class_id
 AND c.school_id = s.school_id
WHERE s.school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor','clerk','accountant','teacher')
  AND (
    public.current_app_role() <> 'teacher'
    OR public.can_read_student(s.id, s.class_id)
  );

CREATE OR REPLACE VIEW public.staff_role_directory
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  s.id,
  s.school_id,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.user_id END AS user_id,
  (s.user_id IS NOT NULL) AS has_login,
  s.employee_code,
  s.full_name,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.email END AS email,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.mobile END AS mobile,
  s.role,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.position_title END AS position_title,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.specialization_duty END AS specialization_duty,
  CASE WHEN public.current_app_role() IN ('admin','supervisor','clerk') THEN s.profile_photo_url END AS profile_photo_url,
  s.status,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.gender END AS gender,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.date_of_birth END AS date_of_birth,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.qualification END AS qualification,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.joining_date END AS joining_date,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.address END AS address,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.emergency_contact_name END AS emergency_contact_name,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN s.emergency_contact_phone END AS emergency_contact_phone
FROM public.staff s
WHERE s.school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor','clerk','accountant');

CREATE OR REPLACE VIEW public.guardian_role_directory
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  g.id,
  g.school_id,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN g.user_id END AS user_id,
  g.full_name,
  g.email,
  g.mobile,
  g.occupation,
  g.address,
  g.city,
  g.country,
  g.nationality,
  g.preferred_language,
  g.preferred_contact_method,
  g.whatsapp_number,
  g.photo_url,
  g.status,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN g.employer END AS employer,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN g.job_title END AS job_title,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN g.work_email END AS work_email,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN g.work_phone END AS work_phone
FROM public.guardians g
WHERE g.school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor','clerk');

CREATE OR REPLACE VIEW public.student_guardian_role_directory
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  sg.id,
  sg.school_id,
  sg.student_id,
  sg.guardian_id,
  sg.relation,
  sg.is_primary_contact,
  sg.authorized_pickup,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN sg.custody_notes END AS custody_notes,
  sg.created_at,
  sg.updated_at
FROM public.student_guardians sg
WHERE sg.school_id = public.current_school_id()
  AND (
    public.current_app_role() IN ('admin','supervisor','clerk')
    OR (public.current_app_role() = 'parent' AND sg.guardian_id = public.current_guardian_id())
    OR (public.current_app_role() = 'student' AND sg.student_id = public.current_student_id())
  );

CREATE OR REPLACE VIEW public.admission_role_directory
WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  a.id,
  a.school_id,
  a.academic_year_id,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.legacy_id END AS legacy_id,
  a.registration_number,
  a.first_name,
  a.middle_name,
  a.last_name,
  a.gender,
  a.date_of_birth,
  a.applied_for_class_id,
  a.admission_type,
  a.previous_school,
  a.transfer_certificate_number,
  a.last_class_attended,
  a.address_line,
  a.city,
  a.region,
  a.postal_code,
  a.father_name,
  a.father_mobile,
  a.father_occupation,
  a.mother_name,
  a.mother_mobile,
  a.mother_occupation,
  a.guardian_name,
  a.guardian_relation,
  a.guardian_mobile,
  a.student_email,
  a.student_mobile,
  a.registration_date,
  a.registration_fee,
  a.registration_fee_mode,
  a.registration_fee_receipt_no,
  a.status,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.blood_group END AS blood_group,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.nhis_no END AS nhis_no,
  a.category,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.medical_notes END AS medical_notes,
  a.admission_fee,
  a.admission_fee_mode,
  a.admission_fee_receipt_no,
  a.admission_confirmed_date,
  a.allotted_class_id,
  a.roll_number,
  a.admission_number,
  a.admission_date,
  a.entry_point,
  a.transport_required,
  a.transport_route,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.linked_student_id END AS linked_student_id,
  a.rejection_reason,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.remarks END AS remarks,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.processed_by END AS processed_by,
  CASE WHEN public.current_app_role() IN ('admin','supervisor') THEN a.ghana_card_no END AS ghana_card_no,
  a.photo_url,
  a.created_at,
  a.updated_at
FROM public.admissions a
WHERE a.school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor','clerk');

REVOKE ALL PRIVILEGES ON TABLE public.student_role_directory FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.staff_role_directory FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.guardian_role_directory FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.student_guardian_role_directory FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.admission_role_directory FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.student_role_directory TO authenticated;
GRANT SELECT ON TABLE public.staff_role_directory TO authenticated;
GRANT SELECT ON TABLE public.guardian_role_directory TO authenticated;
GRANT SELECT ON TABLE public.student_guardian_role_directory TO authenticated;
GRANT SELECT ON TABLE public.admission_role_directory TO authenticated;

-- Keep the existing invoker-security policies on these summary views, but route
-- their student/staff joins through the role-scoped directory views. This means
-- their other underlying-table RLS checks continue to apply.
DO $$
DECLARE
  v_name text;
  v_definition text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'class_summary',
    'fee_payment_summary',
    'feeding_daily_register',
    'feeding_payment_summary',
    'feeding_record_summary',
    'feeding_student_balance',
    'finance_student_summary',
    'student_fee_summary',
    'student_subject_results'
  ]
  LOOP
    v_definition := pg_get_viewdef(format('public.%I', v_name)::regclass, true);
    IF v_definition !~ E'\\mstudents\\M' THEN
      RAISE EXCEPTION 'Expected a students table reference in view %', v_name;
    END IF;
    v_definition := regexp_replace(v_definition, E'\\mstudents\\M', 'public.student_role_directory', 'g');
    IF v_name = 'feeding_student_balance' THEN
      v_definition := replace(
        v_definition,
        'GROUP BY st.school_id, t.id, st.id, c.id, p.id',
        'GROUP BY st.school_id, t.id, st.id, st.admission_number, st.first_name, st.middle_name, st.last_name, st.class_id, c.id, p.id'
      );
    END IF;
    EXECUTE format(
      'CREATE OR REPLACE VIEW public.%I WITH (security_invoker = true) AS %s',
      v_name,
      v_definition
    );
  END LOOP;

  v_definition := pg_get_viewdef('public.staff_early_attendance_summary'::regclass, true);
  IF v_definition !~ E'\\mstaff\\M' THEN
    RAISE EXCEPTION 'Expected a staff table reference in staff_early_attendance_summary';
  END IF;
  v_definition := regexp_replace(v_definition, E'\\mstaff\\M', 'public.staff_role_directory', 'g');
  v_definition := replace(
    v_definition,
    'sa.staff_id, st.id',
    'sa.staff_id, st.id, st.full_name, st.employee_code'
  );
  EXECUTE format(
    'CREATE OR REPLACE VIEW public.staff_early_attendance_summary WITH (security_invoker = true) AS %s',
    v_definition
  );
END;
$$;
