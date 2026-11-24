
-- Clerk cashier access for fee payments only.
-- The Clerk can read the fee data needed to verify balances and receipts,
-- and can post payments through the audited RPC. Fee setup, adjustments,
-- and payment reversals remain management/finance-only.

BEGIN;

DROP POLICY IF EXISTS fee_items_read ON public.fee_items;
CREATE POLICY fee_items_read ON public.fee_items
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (SELECT public.current_app_role()) IN ('admin','supervisor','accountant','clerk')
);

DROP POLICY IF EXISTS fee_payments_read ON public.fee_payments;
CREATE POLICY fee_payments_read ON public.fee_payments
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (
    (SELECT public.current_app_role()) IN ('admin','supervisor','accountant','clerk')
    OR student_id = (SELECT public.current_student_id())
    OR EXISTS (
      SELECT 1
      FROM public.student_guardians sg
      WHERE sg.student_id = fee_payments.student_id
        AND sg.guardian_id = (SELECT public.current_guardian_id())
    )
  )
);

DROP POLICY IF EXISTS fee_adjustments_read ON public.fee_adjustments;
CREATE POLICY fee_adjustments_read ON public.fee_adjustments
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (
    (SELECT public.current_app_role()) IN ('admin','supervisor','accountant','clerk')
    OR student_id = (SELECT public.current_student_id())
    OR EXISTS (
      SELECT 1
      FROM public.student_guardians sg
      WHERE sg.student_id = fee_adjustments.student_id
        AND sg.guardian_id = (SELECT public.current_guardian_id())
    )
  )
);

DROP POLICY IF EXISTS fee_payment_reversals_read ON public.fee_payment_reversals;
CREATE POLICY fee_payment_reversals_read ON public.fee_payment_reversals
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (SELECT public.current_app_role()) IN ('admin','supervisor','accountant','clerk')
);

DROP POLICY IF EXISTS fee_payment_arrears_allocations_read ON public.fee_payment_arrears_allocations;
CREATE POLICY fee_payment_arrears_allocations_read ON public.fee_payment_arrears_allocations
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (
    (SELECT public.current_app_role()) IN ('admin','supervisor','accountant','clerk')
    OR student_id = (SELECT public.current_student_id())
    OR EXISTS (
      SELECT 1
      FROM public.student_guardians sg
      WHERE sg.student_id = fee_payment_arrears_allocations.student_id
        AND sg.guardian_id = (SELECT public.current_guardian_id())
    )
  )
);

DROP POLICY IF EXISTS student_fee_arrears_finance_read ON public.student_fee_arrears;
CREATE POLICY student_fee_arrears_finance_read ON public.student_fee_arrears
FOR SELECT TO authenticated
USING (
  school_id = (SELECT public.current_school_id())
  AND (SELECT public.current_app_role()) IN ('admin','supervisor','accountant','clerk')
);

CREATE OR REPLACE FUNCTION public.record_fee_payment(
  p_student_id uuid,
  p_term_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_remarks text DEFAULT NULL,
  p_fee_item_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_school uuid;
  v_year uuid;
  v_class uuid;
  v_payment uuid;
  v_receipt text;
  v_amount numeric(12,2);
  v_opening_arrears numeric(12,2) := 0;
  v_arrears_paid numeric(12,2) := 0;
  v_arrears_due numeric(12,2) := 0;
  v_arrears_applied numeric(12,2) := 0;
  v_term_applied numeric(12,2) := 0;
BEGIN
  IF NOT COALESCE(
    public.current_app_role() IN ('admin','supervisor','accountant','clerk'),
    false
  ) THEN
    RAISE EXCEPTION 'Fee payment recording access is required';
  END IF;

  v_school := public.current_school_id();
  v_amount := round(p_amount,2);

  -- Serialize payments for a student so two cashiers cannot allocate the
  -- same remaining opening arrears at the same time.
  SELECT class_id INTO v_class
  FROM public.students
  WHERE id = p_student_id
    AND school_id = v_school
    AND status = 'active'
  FOR UPDATE;

  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Choose a valid active student';
  END IF;

  SELECT academic_year_id INTO v_year
  FROM public.terms
  WHERE id = p_term_id AND school_id = v_school;

  IF v_year IS NULL THEN
    RAISE EXCEPTION 'Choose a valid term';
  END IF;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  IF p_fee_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.fee_items fi
    WHERE fi.id = p_fee_item_id
      AND fi.school_id = v_school
      AND fi.term_id = p_term_id
      AND fi.is_active = true
      AND (
        fi.applies_to_all_students = true
        OR fi.class_id = v_class
      )
  ) THEN
    RAISE EXCEPTION 'The selected fee item does not apply to this student';
  END IF;

  -- General payments are allocated to historical arrears first.
  -- Selecting a fee item explicitly bypasses arrears and posts the full
  -- amount against that current-term item.
  IF p_fee_item_id IS NULL THEN
    SELECT arrears_amount
    INTO v_opening_arrears
    FROM public.student_fee_arrears
    WHERE school_id = v_school
      AND student_id = p_student_id
    FOR UPDATE;

    IF v_opening_arrears IS NOT NULL AND v_opening_arrears > 0 THEN
      SELECT COALESCE(sum(a.arrears_amount),0)::numeric(12,2)
      INTO v_arrears_paid
      FROM public.fee_payment_arrears_allocations a
      LEFT JOIN public.fee_payment_reversals r ON r.payment_id = a.payment_id
      WHERE a.school_id = v_school
        AND a.student_id = p_student_id
        AND r.id IS NULL;

      v_arrears_due := greatest(v_opening_arrears - v_arrears_paid,0);
    END IF;
  END IF;

  v_arrears_applied := least(v_amount,v_arrears_due);
  v_term_applied := v_amount - v_arrears_applied;

  IF v_term_applied > 0 AND NOT EXISTS (
    SELECT 1
    FROM public.fee_items fi
    WHERE fi.school_id = v_school
      AND fi.term_id = p_term_id
      AND fi.is_active = true
      AND (
        fi.applies_to_all_students = true
        OR fi.class_id = v_class
      )
  ) THEN
    RAISE EXCEPTION 'This payment exceeds the remaining previous arrears, but no current-term fees are configured for this student';
  END IF;

  v_receipt :=
    'ATIS-' || to_char(current_date,'YYYYMMDD') || '-' ||
    lpad(nextval('public.fee_receipt_seq')::text,6,'0');

  INSERT INTO public.fee_payments (
    school_id,academic_year_id,term_id,student_id,fee_item_id,amount,
    payment_date,payment_method,receipt_no,reference,remarks,recorded_by
  ) VALUES (
    v_school,v_year,p_term_id,p_student_id,p_fee_item_id,v_amount,
    current_date,nullif(trim(coalesce(p_payment_method,'')),''),
    v_receipt,nullif(trim(coalesce(p_reference,'')),''),
    nullif(trim(coalesce(p_remarks,'')),''),auth.uid()
  )
  RETURNING id INTO v_payment;

  IF v_arrears_applied > 0 THEN
    INSERT INTO public.fee_payment_arrears_allocations (
      school_id,payment_id,student_id,arrears_amount
    ) VALUES (
      v_school,v_payment,p_student_id,v_arrears_applied
    );
  END IF;

  INSERT INTO public.audit_logs (
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) VALUES (
    v_school,auth.uid(),'Fee Payment Recorded','fee_payment',v_payment,
    jsonb_build_object(
      'student_id',p_student_id,
      'term_id',p_term_id,
      'amount',v_amount,
      'arrears_amount_applied',v_arrears_applied,
      'term_amount_applied',v_term_applied,
      'receipt_no',v_receipt
    )
  );

  RETURN v_payment;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_fee_payment(uuid,uuid,numeric,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_fee_payment(uuid,uuid,numeric,text,text,text,uuid) TO authenticated;

COMMIT;
