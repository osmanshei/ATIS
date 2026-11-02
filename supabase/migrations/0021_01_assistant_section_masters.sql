begin;

alter table public.school_sections
  add column if not exists assistant_section_master_id uuid
  references public.staff(id) on delete set null;

comment on column public.school_sections.assistant_section_master_id is
  'Optional assistant teacher supporting the section master.';

commit;
