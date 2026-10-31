begin;

create table if not exists public.school_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  setting_key text not null,
  setting_value text not null default '',
  is_secret boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (school_id, setting_key)
);

alter table public.school_settings enable row level security;
revoke all on table public.school_settings from anon, authenticated;

commit;
