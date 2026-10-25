-- ATIS Web v0.8.1 — private staff photos
begin;

-- Object key format: <school_id>/<staff_id>/profile
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'staff-photos',
  'staff-photos',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create or replace function public.staff_photo_staff_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_text text;
begin
  v_text:=split_part(coalesce(object_name,''),'/',2);
  if v_text='' then return null; end if;
  begin
    return v_text::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

revoke all on function public.staff_photo_staff_id(text) from public;
grant execute on function public.staff_photo_staff_id(text) to authenticated;

drop policy if exists atis_staff_photos_read on storage.objects;
create policy atis_staff_photos_read
on storage.objects for select to authenticated
using (
  bucket_id='staff-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and exists (
    select 1
    from public.staff s
    where s.id=public.staff_photo_staff_id(name)
      and s.school_id=(select public.current_school_id())
      and (
        (select public.current_app_role()) in ('admin','supervisor','clerk')
        or s.user_id=auth.uid()
      )
  )
);

drop policy if exists atis_staff_photos_insert on storage.objects;
create policy atis_staff_photos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='staff-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor')
  and exists (
    select 1
    from public.staff s
    where s.id=public.staff_photo_staff_id(name)
      and s.school_id=(select public.current_school_id())
  )
);

drop policy if exists atis_staff_photos_update on storage.objects;
create policy atis_staff_photos_update
on storage.objects for update to authenticated
using (
  bucket_id='staff-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor')
)
with check (
  bucket_id='staff-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor')
);

drop policy if exists atis_staff_photos_delete on storage.objects;
create policy atis_staff_photos_delete
on storage.objects for delete to authenticated
using (
  bucket_id='staff-photos'
  and split_part(name,'/',1)=(select public.current_school_id())::text
  and (select public.current_app_role()) in ('admin','supervisor')
);

commit;
