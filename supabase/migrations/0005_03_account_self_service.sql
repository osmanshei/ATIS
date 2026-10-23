-- ATIS Web v0.3.0 — self-service account helper
begin;

create or replace function public.mark_own_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  update public.profiles
  set must_change_password=false, updated_at=now()
  where user_id=auth.uid();
end;
$$;

revoke all on function public.mark_own_password_changed() from public;
grant execute on function public.mark_own_password_changed() to authenticated;

commit;
