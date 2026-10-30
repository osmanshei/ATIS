begin;

create or replace function public.delete_draft_payroll_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_school uuid;
  v_run_no text;
  v_month date;
  v_status text;
begin
  if not public.is_payroll_finance_user() then
    raise exception 'Payroll access is required';
  end if;

  v_school:=public.current_school_id();

  select run_no,payroll_month,status
  into v_run_no,v_month,v_status
  from public.payroll_runs
  where id=p_run_id
    and school_id=v_school
  for update;

  if v_run_no is null then
    raise exception 'Payroll run not found';
  end if;

  if v_status<>'draft' then
    raise exception 'Only Draft payroll can be deleted. Approved or paid payroll is protected.';
  end if;

  if exists(
    select 1
    from public.payment_vouchers
    where payroll_run_id=p_run_id
      and status<>'cancelled'
  ) then
    raise exception 'This payroll has a linked payment voucher and cannot be deleted.';
  end if;

  insert into public.audit_logs(
    school_id,actor_user_id,action,entity_type,entity_id,details
  ) values(
    v_school,auth.uid(),'Draft Payroll Deleted','payroll_run',p_run_id,
    jsonb_build_object('run_no',v_run_no,'payroll_month',v_month)
  );

  -- payroll_items are removed automatically through the payroll_run foreign key.
  delete from public.payroll_runs
  where id=p_run_id
    and school_id=v_school
    and status='draft';

  if not found then
    raise exception 'Draft payroll could not be deleted';
  end if;
end;
$$;

revoke all on function public.delete_draft_payroll_run(uuid) from public;
grant execute on function public.delete_draft_payroll_run(uuid) to authenticated;

commit;
