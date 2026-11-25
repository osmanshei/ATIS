-- ATIS public view privilege hardening.
-- Application screens consume public views as read-only projections. Do not
-- allow authenticated or service roles to write through an automatically
-- updatable view and bypass the underlying table's RLS policies.

BEGIN;

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind='v'
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM PUBLIC, anon, authenticated, service_role',
      'public',
      v.relname
    );
  END LOOP;
END;
$$;

-- These views intentionally provide role- and school-scoped directories or
-- payroll data while underlying staff RLS is narrower. Keep their explicit
-- filters, but make them security-barrier views so caller predicates cannot
-- be pushed ahead of those filters.
ALTER VIEW public.feeding_staff_directory SET (security_barrier = true);
ALTER VIEW public.payroll_item_summary SET (security_barrier = true);
ALTER VIEW public.payroll_profile_summary SET (security_barrier = true);
ALTER VIEW public.payroll_staff_directory SET (security_barrier = true);

-- This helper only parses a UUID from an object path; it needs no elevated
-- database privileges. Storage RLS policies can call it as the invoker.
CREATE OR REPLACE FUNCTION public.student_photo_student_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_text text;
BEGIN
  v_text := split_part(coalesce(object_name,''),'/',2);
  IF v_text = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$function$;

-- Remove the remaining mutable-search-path lint warnings from simple helpers
-- that only use arguments, trigger records and built-in PostgreSQL functions.
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.staff_contract_effective_status(text,date,date,date,date)
  SET search_path = '';

NOTIFY pgrst, 'reload schema';

COMMIT;
