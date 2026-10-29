-- ATIS Web — Colour sections (Red, Yellow, Green, Blue)
-- Student houses are school-wide and are independent of class groups and class teachers.
begin;

alter table public.students
  add column if not exists student_section text;

alter table public.students
  drop constraint if exists students_student_section_check;

alter table public.students
  add constraint students_student_section_check
  check (
    student_section is null
    or student_section in ('Red','Yellow','Green','Blue')
  );

create table if not exists public.school_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  section_name text not null check (section_name in ('Red','Yellow','Green','Blue')),
  section_master_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, section_name)
);

create index if not exists students_school_section_status_idx
  on public.students (school_id, student_section, status);

drop trigger if exists set_school_sections_updated_at on public.school_sections;
create trigger set_school_sections_updated_at
before update on public.school_sections
for each row execute function public.set_updated_at();

alter table public.school_sections enable row level security;
revoke all on table public.school_sections from anon, authenticated;
grant select, update on table public.school_sections to authenticated;

drop policy if exists school_sections_read on public.school_sections;
create policy school_sections_read on public.school_sections
for select to authenticated
using (school_id = public.current_school_id());

drop policy if exists school_sections_admin_update on public.school_sections;
create policy school_sections_admin_update on public.school_sections
for update to authenticated
using (
  school_id = public.current_school_id()
  and public.current_app_role() = 'admin'
)
with check (
  school_id = public.current_school_id()
  and public.current_app_role() = 'admin'
);

-- Seed the four fixed colour sections for every existing school.
insert into public.school_sections (school_id, section_name)
select s.id, c.section_name
from public.schools s
cross join (values ('Red'),('Yellow'),('Green'),('Blue')) as c(section_name)
on conflict (school_id, section_name) do nothing;

-- Retain previously entered colour-house values if they were stored in house_name.
update public.students
set student_section = case lower(trim(house_name))
  when 'red' then 'Red'
  when 'yellow' then 'Yellow'
  when 'green' then 'Green'
  when 'blue' then 'Blue'
  else student_section
end
where student_section is null
  and lower(trim(coalesce(house_name,''))) in ('red','yellow','green','blue');

-- Distribute all remaining existing students in a balanced round-robin order per school.
with ranked as (
  select
    id,
    row_number() over (
      partition by school_id
      order by
        coalesce(class_id::text,''),
        lower(coalesce(last_name,'')),
        lower(coalesce(first_name,'')),
        lower(coalesce(admission_number::text,'')),
        created_at,
        id
    ) as rn
  from public.students
  where student_section is null
)
update public.students s
set student_section = case ((ranked.rn - 1) % 4)
  when 0 then 'Red'
  when 1 then 'Yellow'
  when 2 then 'Green'
  else 'Blue'
end
from ranked
where s.id = ranked.id;

-- Assign each newly enrolled student to the currently smallest colour section.
-- The school-level transaction lock prevents simultaneous admissions from
-- choosing the same section based on a stale count.
create or replace function public.assign_student_colour_section()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section text;
begin
  if new.student_section is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.school_id::text), 73421);

  select ss.section_name
    into v_section
  from public.school_sections ss
  left join (
    select student_section, count(*) as total
    from public.students
    where school_id = new.school_id
    group by student_section
  ) totals on totals.student_section = ss.section_name
  where ss.school_id = new.school_id
  order by coalesce(totals.total, 0), 
    case ss.section_name
      when 'Red' then 1
      when 'Yellow' then 2
      when 'Green' then 3
      else 4
    end
  limit 1;

  if v_section is null then
    insert into public.school_sections (school_id, section_name)
    values
      (new.school_id, 'Red'),
      (new.school_id, 'Yellow'),
      (new.school_id, 'Green'),
      (new.school_id, 'Blue')
    on conflict (school_id, section_name) do nothing;

    v_section := 'Red';
  end if;

  new.student_section := v_section;
  return new;
end;
$$;

drop trigger if exists assign_student_colour_section_before_insert on public.students;
create trigger assign_student_colour_section_before_insert
before insert on public.students
for each row execute function public.assign_student_colour_section();

-- If a new school is added later, create its four colour sections automatically.
create or replace function public.seed_school_colour_sections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.school_sections (school_id, section_name)
  values
    (new.id, 'Red'),
    (new.id, 'Yellow'),
    (new.id, 'Green'),
    (new.id, 'Blue')
  on conflict (school_id, section_name) do nothing;
  return new;
end;
$$;

drop trigger if exists seed_school_colour_sections_after_insert on public.schools;
create trigger seed_school_colour_sections_after_insert
after insert on public.schools
for each row execute function public.seed_school_colour_sections();

commit;
