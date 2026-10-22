begin;

-- -----------------------------
-- Students and guardians
-- -----------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  legacy_id bigint,
  admission_number citext,
  first_name text not null,
  middle_name text,
  last_name text not null,
  preferred_name text,
  gender text,
  date_of_birth date,
  admission_date date,
  class_id uuid references public.classes(id) on delete set null,
  roll_number text,
  category text,
  nhis_no text,
  ghana_card_no text,
  previous_school text,
  address_line text,
  city text,
  region text,
  postal_code text,
  nationality text not null default 'Ghanaian',
  second_nationality text,
  country_of_birth text,
  photo_url text,
  medical_notes text,
  dietary_requirements text,
  allergies text,
  special_needs text,
  house_name text,
  admission_type text,
  concession_percent numeric(5,2) not null default 0 check (concession_percent between 0 and 100),
  media_consent boolean,
  transport_required boolean not null default false,
  transport_route text,
  status public.student_status not null default 'active',
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists students_admission_number_unique_idx
  on public.students (school_id, admission_number)
  where admission_number is not null and admission_number::text <> '';

create index if not exists students_class_id_idx on public.students (class_id);
create index if not exists students_school_status_idx on public.students (school_id, status);

create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  legacy_id bigint,
  full_name text not null,
  email citext,
  mobile text,
  occupation text,
  address text,
  city text,
  country text,
  nationality text,
  preferred_language text,
  preferred_contact_method text,
  whatsapp_number text,
  employer text,
  job_title text,
  work_email citext,
  work_phone text,
  photo_url text,
  status public.account_status not null default 'active',
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists guardians_email_unique_idx
  on public.guardians (school_id, lower(email::text)) where email is not null and email::text <> '';

create table if not exists public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relation text,
  is_primary_contact boolean not null default false,
  authorized_pickup boolean not null default false,
  custody_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, guardian_id)
);

-- -----------------------------
-- Audit and migration support
-- -----------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.legacy_id_map (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  source_table text not null,
  legacy_id text not null,
  new_id uuid not null,
  imported_at timestamptz not null default now(),
  unique (school_id, source_table, legacy_id)
);

-- -----------------------------
-- Updated-at triggers
-- -----------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'schools','profiles','staff','academic_years','terms','classes',
    'subject_catalogue','class_subjects','teacher_assignments','students',
    'guardians','student_guardians'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_' || t || '_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || t || '_updated_at', t
    );
  end loop;
end $$;

commit;
