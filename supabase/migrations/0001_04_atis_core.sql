begin;

-- -----------------------------
-- Row-level security and grants
-- -----------------------------
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.academic_years enable row level security;
alter table public.terms enable row level security;
alter table public.classes enable row level security;
alter table public.subject_catalogue enable row level security;
alter table public.class_subjects enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.students enable row level security;
alter table public.guardians enable row level security;
alter table public.student_guardians enable row level security;
alter table public.audit_logs enable row level security;
alter table public.legacy_id_map enable row level security;

revoke all on table public.schools, public.profiles, public.staff,
  public.academic_years, public.terms, public.classes, public.subject_catalogue,
  public.class_subjects, public.teacher_assignments, public.students,
  public.guardians, public.student_guardians, public.audit_logs,
  public.legacy_id_map from anon, authenticated;

-- Read grants. RLS still decides which rows.
grant select on table public.schools, public.profiles, public.staff,
  public.academic_years, public.terms, public.classes, public.subject_catalogue,
  public.class_subjects, public.teacher_assignments, public.students,
  public.guardians, public.student_guardians to authenticated;

grant select on public.class_summary, public.class_subject_summary,
  public.teacher_assignment_summary to authenticated;

-- Core writes for authenticated users; policies below restrict by role.
grant insert, update, delete on table public.classes, public.subject_catalogue,
  public.class_subjects, public.teacher_assignments to authenticated;

grant insert, update on table public.students, public.guardians,
  public.student_guardians to authenticated;

-- Schools
create policy schools_read_own on public.schools
for select to authenticated
using (id = (select public.current_school_id()));

-- Profiles
create policy profiles_read on public.profiles
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    user_id = auth.uid()
    or (select public.current_app_role()) in ('admin','supervisor')
  )
);

-- Staff
create policy staff_read on public.staff
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','clerk')
    or user_id = auth.uid()
  )
);

-- Academic years / terms: readable by all signed-in users in the school.
create policy academic_years_read on public.academic_years
for select to authenticated
using (school_id = (select public.current_school_id()));

create policy terms_read on public.terms
for select to authenticated
using (school_id = (select public.current_school_id()));

-- Classes
create policy classes_read on public.classes
for select to authenticated
using (school_id = (select public.current_school_id()));

create policy classes_insert on public.classes
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy classes_update on public.classes
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy classes_delete on public.classes
for delete to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) = 'admin'
);

-- Subjects and class-subject links
create policy subject_catalogue_read on public.subject_catalogue
for select to authenticated
using (school_id = (select public.current_school_id()));

create policy subject_catalogue_insert on public.subject_catalogue
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy subject_catalogue_update on public.subject_catalogue
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy subject_catalogue_delete on public.subject_catalogue
for delete to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) = 'admin'
);

create policy class_subjects_read on public.class_subjects
for select to authenticated
using (school_id = (select public.current_school_id()));

create policy class_subjects_insert on public.class_subjects
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy class_subjects_update on public.class_subjects
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy class_subjects_delete on public.class_subjects
for delete to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

-- Teacher assignments: management sees all; teachers see their own.
create policy teacher_assignments_read on public.teacher_assignments
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor')
    or teacher_id = (select public.current_staff_id())
  )
);

create policy teacher_assignments_insert on public.teacher_assignments
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy teacher_assignments_update on public.teacher_assignments
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

create policy teacher_assignments_delete on public.teacher_assignments
for delete to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

-- Students
create policy students_read on public.students
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.can_read_student(id, class_id))
);

create policy students_insert on public.students
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create policy students_update on public.students
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

-- Guardians and links
create policy guardians_read on public.guardians
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','clerk')
    or user_id = auth.uid()
  )
);

create policy guardians_insert on public.guardians
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create policy guardians_update on public.guardians
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create policy student_guardians_read on public.student_guardians
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (
    (select public.current_app_role()) in ('admin','supervisor','clerk')
    or guardian_id = (select public.current_guardian_id())
    or student_id = (select public.current_student_id())
  )
);

create policy student_guardians_insert on public.student_guardians
for insert to authenticated
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

create policy student_guardians_update on public.student_guardians
for update to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
)
with check (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor','clerk')
);

-- Audit and legacy maps are intentionally not writable from the browser/client role.
create policy audit_logs_read_management on public.audit_logs
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) in ('admin','supervisor')
);

grant select on table public.audit_logs to authenticated;

create policy legacy_map_read_admin on public.legacy_id_map
for select to authenticated
using (
  school_id = (select public.current_school_id())
  and (select public.current_app_role()) = 'admin'
);

grant select on table public.legacy_id_map to authenticated;

commit;
