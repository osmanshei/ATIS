-- ATIS Web v0.1 student/guardian migration refinements
begin;

create unique index if not exists students_school_legacy_unique_idx
  on public.students (school_id, legacy_id) where legacy_id is not null;

alter table public.guardians
  add column if not exists migration_key text;

create unique index if not exists guardians_school_migration_key_unique_idx
  on public.guardians (school_id, migration_key) where migration_key is not null;

commit;
