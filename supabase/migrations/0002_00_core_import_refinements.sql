-- ATIS Web v0.1 core migration refinements for legacy import
begin;

alter table public.subject_catalogue
  add column if not exists legacy_id bigint,
  add column if not exists include_on_report boolean not null default true,
  add column if not exists legacy_payload jsonb not null default '{}'::jsonb;

create unique index if not exists staff_school_legacy_unique_idx
  on public.staff (school_id, legacy_id) where legacy_id is not null;

create unique index if not exists classes_school_legacy_unique_idx
  on public.classes (school_id, legacy_id) where legacy_id is not null;

create unique index if not exists subject_catalogue_school_legacy_unique_idx
  on public.subject_catalogue (school_id, legacy_id) where legacy_id is not null;

create unique index if not exists class_subjects_school_legacy_unique_idx
  on public.class_subjects (school_id, legacy_id) where legacy_id is not null;

create unique index if not exists teacher_assignments_school_legacy_unique_idx
  on public.teacher_assignments (school_id, legacy_id) where legacy_id is not null;

commit;
