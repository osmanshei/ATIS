-- Enforce role-scoped access on sensitive base tables.
-- Clerk/Accountant/Teacher reads are served by the role-scoped views created
-- in 0028_01_role_scoped_data_views.sql. Parent/student self-service remains
-- available through their own row policies and SECURITY DEFINER portal RPCs.

DROP POLICY IF EXISTS students_read ON public.students;
CREATE POLICY students_read
ON public.students
FOR SELECT
TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.current_app_role() IN ('admin','supervisor')
    OR (
      public.current_app_role() IN ('parent','student')
      AND public.can_read_student(id, class_id)
    )
  )
);

DROP POLICY IF EXISTS students_insert ON public.students;
CREATE POLICY students_insert
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS students_update ON public.students;
CREATE POLICY students_update
ON public.students
FOR UPDATE
TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
)
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS staff_read ON public.staff;
CREATE POLICY staff_read
ON public.staff
FOR SELECT
TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.current_app_role() IN ('admin','supervisor')
    OR user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS guardians_read ON public.guardians;
CREATE POLICY guardians_read
ON public.guardians
FOR SELECT
TO authenticated
USING (
  school_id = public.current_school_id()
  AND (
    public.current_app_role() IN ('admin','supervisor')
    OR user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS guardians_insert ON public.guardians;
CREATE POLICY guardians_insert
ON public.guardians
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS guardians_update ON public.guardians;
CREATE POLICY guardians_update
ON public.guardians
FOR UPDATE
TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
)
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS student_guardians_read ON public.student_guardians;
CREATE POLICY student_guardians_read
ON public.student_guardians
FOR SELECT
TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS student_guardians_insert ON public.student_guardians;
CREATE POLICY student_guardians_insert
ON public.student_guardians
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS student_guardians_update ON public.student_guardians;
CREATE POLICY student_guardians_update
ON public.student_guardians
FOR UPDATE
TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
)
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS admissions_read ON public.admissions;
CREATE POLICY admissions_read
ON public.admissions
FOR SELECT
TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS admissions_insert ON public.admissions;
CREATE POLICY admissions_insert
ON public.admissions
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

DROP POLICY IF EXISTS admissions_update ON public.admissions;
CREATE POLICY admissions_update
ON public.admissions
FOR UPDATE
TO authenticated
USING (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
)
WITH CHECK (
  school_id = public.current_school_id()
  AND public.current_app_role() IN ('admin','supervisor')
);

CREATE OR REPLACE FUNCTION public.update_student_record(p_student_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_class uuid;
  v_first text;
  v_last text;
BEGIN
  IF public.current_app_role() NOT IN ('admin','supervisor','clerk') THEN
    RAISE EXCEPTION 'Student editing is not available to this account';
  END IF;

  v_school := public.current_school_id();
  v_class := NULLIF(p_payload->>'class_id','')::uuid;
  v_first := NULLIF(TRIM(p_payload->>'first_name'),'');
  v_last := NULLIF(TRIM(p_payload->>'last_name'),'');

  IF v_first IS NULL OR v_last IS NULL THEN
    RAISE EXCEPTION 'First name and last name are required';
  END IF;

  IF v_class IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.classes
    WHERE id = v_class
      AND school_id = v_school
  ) THEN
    RAISE EXCEPTION 'Choose a valid class';
  END IF;

  UPDATE public.students
  SET
    admission_number = NULLIF(TRIM(p_payload->>'admission_number'),''),
    first_name = v_first,
    middle_name = NULLIF(TRIM(p_payload->>'middle_name'),''),
    last_name = v_last,
    preferred_name = NULLIF(TRIM(p_payload->>'preferred_name'),''),
    gender = NULLIF(TRIM(p_payload->>'gender'),''),
    date_of_birth = NULLIF(p_payload->>'date_of_birth','')::date,
    admission_date = NULLIF(p_payload->>'admission_date','')::date,
    class_id = v_class,
    roll_number = NULLIF(TRIM(p_payload->>'roll_number'),''),
    category = NULLIF(TRIM(p_payload->>'category'),''),
    address_line = NULLIF(TRIM(p_payload->>'address_line'),''),
    city = NULLIF(TRIM(p_payload->>'city'),''),
    region = NULLIF(TRIM(p_payload->>'region'),''),
    nationality = COALESCE(NULLIF(TRIM(p_payload->>'nationality'),''),'Ghanaian'),
    medical_notes = CASE
      WHEN public.current_app_role() IN ('admin','supervisor')
        THEN NULLIF(TRIM(p_payload->>'medical_notes'),'')
      ELSE students.medical_notes
    END,
    dietary_requirements = CASE
      WHEN public.current_app_role() IN ('admin','supervisor','clerk')
        THEN NULLIF(TRIM(p_payload->>'dietary_requirements'),'')
      ELSE students.dietary_requirements
    END,
    allergies = CASE
      WHEN public.current_app_role() IN ('admin','supervisor')
        THEN NULLIF(TRIM(p_payload->>'allergies'),'')
      ELSE students.allergies
    END,
    special_needs = CASE
      WHEN public.current_app_role() IN ('admin','supervisor')
        THEN NULLIF(TRIM(p_payload->>'special_needs'),'')
      ELSE students.special_needs
    END,
    house_name = NULLIF(TRIM(p_payload->>'house_name'),''),
    admission_type = NULLIF(TRIM(p_payload->>'admission_type'),''),
    concession_percent = CASE
      WHEN public.current_app_role() IN ('admin','supervisor')
        THEN COALESCE(NULLIF(p_payload->>'concession_percent','')::numeric,0)
      ELSE students.concession_percent
    END,
    transport_required = COALESCE((p_payload->>'transport_required')::boolean,false),
    transport_route = NULLIF(TRIM(p_payload->>'transport_route'),''),
    status = COALESCE(NULLIF(p_payload->>'status','')::public.student_status,status),
    updated_at = NOW()
  WHERE id = p_student_id
    AND school_id = v_school;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  INSERT INTO public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) VALUES (
    v_school,
    auth.uid(),
    'Student Updated',
    'student',
    p_student_id,
    CASE
      WHEN public.current_app_role() IN ('admin','supervisor') THEN p_payload
      ELSE p_payload
        - 'concession_percent'
        - 'medical_notes'
        - 'allergies'
        - 'special_needs'
        - 'nhis_no'
        - 'ghana_card_no'
    END
  );

  RETURN p_student_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_student_photo(
  p_student_id uuid,
  p_photo_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_school uuid;
  v_expected_path text;
BEGIN
  IF public.current_app_role() NOT IN ('admin','supervisor','clerk') THEN
    RAISE EXCEPTION 'Student photo editing is not available to this account';
  END IF;

  v_school := public.current_school_id();

  IF p_photo_path IS NOT NULL THEN
    v_expected_path := v_school::text || '/' || p_student_id::text || '/profile';
    IF p_photo_path <> v_expected_path THEN
      RAISE EXCEPTION 'Invalid student photo path';
    END IF;
  END IF;

  UPDATE public.students
  SET photo_url = p_photo_path,
      updated_at = now()
  WHERE id = p_student_id
    AND school_id = v_school;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  INSERT INTO public.audit_logs (
    school_id, actor_user_id, action, entity_type, entity_id, details
  ) VALUES (
    v_school,
    auth.uid(),
    'Student Photo Updated',
    'student',
    p_student_id,
    jsonb_build_object('photo_uploaded', p_photo_path IS NOT NULL)
  );

  RETURN p_student_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_student_photo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_student_photo(uuid, text) TO authenticated;
