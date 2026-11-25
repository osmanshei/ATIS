-- ATIS role privilege hardening.
-- Internal helpers remain available to their SECURITY DEFINER callers,
-- but are no longer callable directly through the authenticated Data API.
-- Clerk retains ordinary student editing, but cannot change fee concessions
-- or read other staff members' contract salaries.

BEGIN;

-- These helpers accept school/student identifiers and are only intended to
-- be invoked from guarded SECURITY DEFINER business functions.
REVOKE EXECUTE ON FUNCTION public.atis_upsert_guardian(uuid,text,text,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atis_take_counter(uuid,text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resync_student_feeding(uuid,uuid)
  FROM PUBLIC, anon, authenticated;

-- Trigger functions are not application RPC endpoints. Their existing
-- triggers continue to execute them; clients do not need EXECUTE privileges.
REVOKE EXECUTE ON FUNCTION public.sync_feeding_after_attendance()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_school_colour_sections()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_student_colour_section()
  FROM PUBLIC, anon, authenticated;

-- Contract salary and other contract details are visible only to management
-- and to the staff member whose own contract it is.
DROP POLICY IF EXISTS staff_contracts_read ON public.staff_contracts;
CREATE POLICY staff_contracts_read ON public.staff_contracts
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (
    (SELECT public.current_app_role()) IN ('admin','supervisor')
    OR staff_id = (SELECT public.current_staff_id())
  )
);

-- Preserve Clerk's student-editing capability while keeping fee concessions
-- under Admin/Supervisor control, even if a Clerk calls this RPC directly.
CREATE OR REPLACE FUNCTION public.update_student_record(
  p_student_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    medical_notes = NULLIF(TRIM(p_payload->>'medical_notes'),''),
    dietary_requirements = NULLIF(TRIM(p_payload->>'dietary_requirements'),''),
    allergies = NULLIF(TRIM(p_payload->>'allergies'),''),
    special_needs = NULLIF(TRIM(p_payload->>'special_needs'),''),
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
      ELSE p_payload - 'concession_percent'
    END
  );

  RETURN p_student_id;
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
