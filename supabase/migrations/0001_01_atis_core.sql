-- ATIS Web v0.1.0 core schema
-- Source reference: ATIS Apps Script v1.0.10
-- PostgreSQL / Supabase

begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------
-- Types
-- -----------------------------
do $$ begin
  create type public.app_role as enum (
    'admin', 'supervisor', 'accountant', 'teacher', 'clerk',
    'staff', 'student', 'parent'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.account_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.student_status as enum (
    'active', 'inactive', 'transferred', 'withdrawn', 'graduated', 'alumni'
  );
exception when duplicate_object then null;
end $$;

-- -----------------------------
-- Utility functions
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------
-- School and identity
-- -----------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  name text not null,
  short_name text not null default 'ATIS',
  address text,
  city text,
  region text,
  country text not null default 'Ghana',
  phone text,
  email citext,
  website text,
  logo_url text,
  timezone text not null default 'Africa/Accra',
  currency_code text not null default 'GHS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  username citext not null,
  full_name text not null,
  email citext not null,
  mobile text,
  role public.app_role not null,
  status public.account_status not null default 'active',
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, username),
  unique (school_id, email)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  legacy_id bigint,
  employee_code citext,
  full_name text not null,
  email citext,
  mobile text,
  role public.app_role not null default 'staff',
  position_title text,
  gender text,
  date_of_birth date,
  qualification text,
  specialization_duty text,
  joining_date date,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  profile_photo_url text,
  status public.account_status not null default 'active',
  legacy_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_role_check check (role not in ('student','parent')),
  unique (school_id, employee_code)
);

create unique index if not exists staff_email_unique_idx
  on public.staff (school_id, lower(email::text)) where email is not null and email::text <> '';

create unique index if not exists staff_mobile_unique_idx
  on public.staff (school_id, regexp_replace(coalesce(mobile,''), '[^0-9]', '', 'g'))
  where regexp_replace(coalesce(mobile,''), '[^0-9]', '', 'g') <> '';

-- -----------------------------
-- Academic calendar
-- -----------------------------
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create unique index if not exists one_current_academic_year_per_school_idx
  on public.academic_years (school_id) where is_current;

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  name text not null check (name in ('Term 1','Term 2','Term 3')),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, name)
);

create unique index if not exists one_current_term_per_school_idx
  on public.terms (school_id) where is_current;

-- -----------------------------
-- Classes and subjects
-- -----------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  legacy_id bigint,
  class_name text not null,
  section text,
  grade_level integer,
  class_code citext,
  curriculum_stage text,
  medium_of_instruction text,
  subject_stream text,
  max_capacity integer check (max_capacity is null or max_capacity > 0),
  room_number text,
  building text,
  class_teacher_id uuid references public.staff(id) on delete set null,
  assistant_teacher_id uuid references public.staff(id) on delete set null,
  shift text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists classes_name_section_year_unique_idx
  on public.classes (
    school_id,
    academic_year_id,
    lower(class_name),
    lower(coalesce(nullif(trim(section), ''), ''))
  );

create unique index if not exists classes_code_unique_idx
  on public.classes (school_id, class_code) where class_code is not null;

create table if not exists public.subject_catalogue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_code text,
  subject_name text not null,
  subject_code citext not null,
  subject_group text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, subject_code)
);

create table if not exists public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_id bigint,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null references public.subject_catalogue(id) on delete restrict,
  max_marks numeric(7,2) not null default 100,
  pass_marks numeric(7,2) not null default 50,
  subject_type text,
  theory_max_marks numeric(7,2),
  practical_max_marks numeric(7,2),
  theory_pass_marks numeric(7,2),
  practical_pass_marks numeric(7,2),
  is_optional boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, subject_id)
);

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  legacy_id bigint,
  teacher_id uuid not null references public.staff(id) on delete cascade,
  class_subject_id uuid not null references public.class_subjects(id) on delete cascade,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  is_class_teacher boolean not null default false,
  periods_per_week integer check (periods_per_week is null or periods_per_week between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, class_subject_id, academic_year_id)
);

commit;
