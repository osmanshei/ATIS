-- Accountant feeding access is read-only.
-- Allow the Accountant to read school class metadata required by the
-- security-invoker feeding register and balance views. This does not grant
-- INSERT, UPDATE, or DELETE on classes.

DROP POLICY IF EXISTS classes_accountant_feeding_read ON public.classes;

CREATE POLICY classes_accountant_feeding_read
ON public.classes
FOR SELECT
TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (SELECT public.current_app_role()) = 'accountant'::public.app_role
);

-- Keep all feeding write RPCs unavailable to Accountant. These functions are
-- SECURITY DEFINER, so the role check must be enforced inside the function.

CREATE OR REPLACE FUNCTION public.save_feeding_rate(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_term uuid;
  v_year uuid;
  v_class uuid;
  v_id uuid;
BEGIN
  IF coalesce(public.current_app_role()::text, '') NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Feeding rate access is required';
  END IF;

  v_school := public.current_school_id();
  v_term := nullif(p_payload->>'term_id', '')::uuid;
  v_class := nullif(p_payload->>'class_id', '')::uuid;

  SELECT academic_year_id INTO v_year
  FROM public.terms
  WHERE id = v_term AND school_id = v_school;

  IF v_year IS NULL THEN
    RAISE EXCEPTION 'Choose a valid term';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = v_class AND school_id = v_school
  ) THEN
    RAISE EXCEPTION 'Choose a valid class';
  END IF;

  INSERT INTO public.feeding_rates (
    school_id, academic_year_id, term_id, class_id,
    daily_rate, weekly_rate, monthly_rate, termly_rate,
    status, notes, created_by
  )
  VALUES (
    v_school, v_year, v_term, v_class,
    greatest(coalesce(nullif(p_payload->>'daily_rate', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_payload->>'weekly_rate', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_payload->>'monthly_rate', '')::numeric, 0), 0),
    greatest(coalesce(nullif(p_payload->>'termly_rate', '')::numeric, 0), 0),
    coalesce(nullif(p_payload->>'status', ''), 'active'),
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    auth.uid()
  )
  ON CONFLICT (term_id, class_id) DO UPDATE SET
    daily_rate = excluded.daily_rate,
    weekly_rate = excluded.weekly_rate,
    monthly_rate = excluded.monthly_rate,
    termly_rate = excluded.termly_rate,
    status = excluded.status,
    notes = excluded.notes,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_student_feeding_plan(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_student public.students%rowtype;
  v_term uuid;
  v_year uuid;
  v_frequency text;
  v_staff uuid;
  v_exemption text;
  v_id uuid;
  v_role public.app_role;
BEGIN
  IF coalesce(public.current_app_role()::text, '') NOT IN ('admin', 'supervisor', 'clerk') THEN
    RAISE EXCEPTION 'Feeding plan access is required';
  END IF;

  v_school := public.current_school_id();
  v_term := nullif(p_payload->>'term_id', '')::uuid;
  v_frequency := coalesce(nullif(lower(trim(p_payload->>'frequency')), ''), 'daily');
  v_staff := nullif(p_payload->>'related_staff_id', '')::uuid;

  IF v_frequency NOT IN ('daily', 'weekly', 'monthly', 'termly', 'exempt') THEN
    RAISE EXCEPTION 'Invalid feeding frequency';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = nullif(p_payload->>'student_id', '')::uuid
    AND school_id = v_school
    AND status = 'active';

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Choose an active student';
  END IF;

  SELECT academic_year_id INTO v_year
  FROM public.terms
  WHERE id = v_term AND school_id = v_school;

  IF v_year IS NULL THEN
    RAISE EXCEPTION 'Choose a valid term';
  END IF;

  IF v_frequency = 'exempt' THEN
    IF v_staff IS NOT NULL THEN
      SELECT role INTO v_role
      FROM public.staff
      WHERE id = v_staff AND school_id = v_school AND status = 'active';

      IF v_role IS NULL THEN
        RAISE EXCEPTION 'Choose a valid staff member for the exemption';
      END IF;

      v_exemption := CASE
        WHEN v_role IN ('admin', 'supervisor') THEN 'management_child'
        ELSE 'staff_child'
      END;
    ELSE
      v_exemption := 'other';
    END IF;
  ELSE
    v_staff := NULL;
    v_exemption := NULL;
  END IF;

  INSERT INTO public.student_feeding_plans (
    school_id, academic_year_id, term_id, student_id,
    frequency, exemption_type, related_staff_id, status,
    notes, updated_by
  )
  VALUES (
    v_school, v_year, v_term, v_student.id,
    v_frequency, v_exemption, v_staff,
    coalesce(nullif(p_payload->>'status', ''), 'active'),
    nullif(trim(coalesce(p_payload->>'notes', '')), ''),
    auth.uid()
  )
  ON CONFLICT (term_id, student_id) DO UPDATE SET
    frequency = excluded.frequency,
    exemption_type = excluded.exemption_type,
    related_staff_id = excluded.related_staff_id,
    status = excluded.status,
    notes = excluded.notes,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING id INTO v_id;

  PERFORM public.resync_student_feeding(v_student.id, v_term);
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_feeding_payment(
  p_student_id uuid,
  p_term_id uuid,
  p_frequency text,
  p_payment_date date DEFAULT CURRENT_DATE,
  p_coverage_start date DEFAULT NULL::date,
  p_payment_method text DEFAULT NULL::text,
  p_reference text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text,
  p_amount numeric DEFAULT NULL::numeric
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid;
  v_year uuid;
  v_class uuid;
  v_amount numeric;
  v_id uuid;
  v_receipt text;
  v_counter bigint;
  v_start date;
  v_end date;
  v_label text;
BEGIN
  IF coalesce(public.current_app_role()::text, '') NOT IN ('admin', 'supervisor', 'clerk') THEN
    RAISE EXCEPTION 'Feeding payment access is required';
  END IF;

  v_school := public.current_school_id();

  SELECT st.class_id, t.academic_year_id
  INTO v_class, v_year
  FROM public.students st
  JOIN public.terms t ON t.id = p_term_id
  WHERE st.id = p_student_id
    AND st.school_id = v_school
    AND st.status = 'active'
    AND t.school_id = v_school;

  IF v_class IS NULL OR v_year IS NULL THEN
    RAISE EXCEPTION 'Choose a valid student and term';
  END IF;

  IF p_frequency NOT IN ('daily', 'weekly', 'monthly', 'termly') THEN
    RAISE EXCEPTION 'Invalid feeding frequency';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_feeding_plans
    WHERE term_id = p_term_id
      AND student_id = p_student_id
      AND frequency = 'exempt'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'This student is exempt from feeding fees';
  END IF;

  v_amount := coalesce(
    p_amount,
    public.feeding_frequency_rate(v_class, p_term_id, p_frequency)
  );

  IF coalesce(v_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Configure a feeding rate before recording payment';
  END IF;

  v_start := coalesce(p_coverage_start, p_payment_date, current_date);
  v_end := CASE p_frequency
    WHEN 'daily' THEN v_start
    WHEN 'weekly' THEN v_start + 6
    WHEN 'monthly' THEN (v_start + interval '1 month - 1 day')::date
    WHEN 'termly' THEN (SELECT ends_on FROM public.terms WHERE id = p_term_id)
  END;

  v_label := CASE p_frequency
    WHEN 'daily' THEN v_start::text
    WHEN 'weekly' THEN 'Week from ' || v_start::text
    WHEN 'monthly' THEN to_char(v_start, 'FMMonth YYYY')
    WHEN 'termly' THEN (SELECT name FROM public.terms WHERE id = p_term_id)
  END;

  INSERT INTO public.student_feeding_plans (
    school_id, academic_year_id, term_id, student_id,
    frequency, status, updated_by
  )
  VALUES (
    v_school, v_year, p_term_id, p_student_id,
    p_frequency, 'active', auth.uid()
  )
  ON CONFLICT (term_id, student_id) DO UPDATE SET
    frequency = excluded.frequency,
    exemption_type = NULL,
    related_staff_id = NULL,
    status = 'active',
    updated_by = auth.uid(),
    updated_at = now();

  v_counter := public.atis_take_counter(v_school, 'feeding_receipt');
  v_receipt := 'ATIS-FD-' || to_char(coalesce(p_payment_date, current_date), 'YYYYMMDD') ||
    '-' || lpad(v_counter::text, 4, '0');

  INSERT INTO public.feeding_payments (
    school_id, academic_year_id, term_id, student_id, frequency,
    coverage_label, coverage_start, coverage_end, amount, payment_date,
    payment_method, receipt_no, reference, recorded_by, remarks
  )
  VALUES (
    v_school, v_year, p_term_id, p_student_id, p_frequency, v_label,
    v_start, v_end, v_amount, coalesce(p_payment_date, current_date),
    nullif(trim(p_payment_method), ''), v_receipt,
    nullif(trim(p_reference), ''), auth.uid(), nullif(trim(p_remarks), '')
  )
  RETURNING id INTO v_id;

  INSERT INTO public.feeding_wallet_entries (
    school_id, academic_year_id, term_id, student_id, entry_date,
    entry_type, amount, payment_id, description, created_by
  )
  VALUES (
    v_school, v_year, p_term_id, p_student_id, v_start,
    'payment', v_amount, v_id, 'Feeding payment - ' || v_label, auth.uid()
  );

  PERFORM public.resync_student_feeding(p_student_id, p_term_id);

  INSERT INTO public.audit_logs (
    school_id, actor_user_id, action, entity_type, entity_id, details
  )
  VALUES (
    v_school, auth.uid(), 'Feeding Payment Recorded', 'feeding_payment', v_id,
    jsonb_build_object(
      'student_id', p_student_id,
      'frequency', p_frequency,
      'amount', v_amount,
      'receipt_no', v_receipt
    )
  );

  RETURN v_receipt;
END;
$function$;
