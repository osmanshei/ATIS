-- Consolidate Accountant's class read access into the existing SELECT policy.
-- This keeps the same school-scoped read behavior while avoiding a second
-- permissive SELECT policy on public.classes.

ALTER POLICY classes_read
ON public.classes
USING (
  school_id = (SELECT public.current_school_id())
  AND (
    public.can_read_class(id)
    OR (SELECT public.current_app_role()) = 'accountant'::public.app_role
  )
);

DROP POLICY IF EXISTS classes_accountant_feeding_read ON public.classes;
