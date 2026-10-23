-- ATIS Web v0.3.0 — Staff onboarding helpers
begin;

create or replace function public.next_staff_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school uuid;
  v_no bigint;
begin
  if public.current_app_role() <> 'admin' then raise exception 'Not authorized'; end if;
  v_school := public.current_school_id();
  v_no := public.atis_take_counter(v_school,'staff_employee_code');
  return 'ATIS-STF-' || lpad(v_no::text,4,'0');
end;
$$;

revoke all on function public.next_staff_employee_code() from public;
grant execute on function public.next_staff_employee_code() to authenticated;

commit;
