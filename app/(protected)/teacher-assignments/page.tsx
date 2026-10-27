import { requireProfile } from "@/lib/auth";
import { TeacherAssignmentForm } from "@/components/teacher-assignment-form";

export default async function TeacherAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;
  const canEdit = ["admin", "supervisor"].includes(profile.role);

  const assignmentsPromise = supabase
    .from("teacher_assignment_summary")
    .select("id,teacher_name,employee_code,class_name,section,subject_name,subject_code,is_class_teacher,periods_per_week")
    .order("teacher_name")
    .order("class_name")
    .order("subject_name");

  const [assignmentsResult, teachersResult, classesResult, classSubjectsResult] = canEdit
    ? await Promise.all([
        assignmentsPromise,
        supabase.from("staff").select("id,full_name,employee_code").eq("role", "teacher").eq("status", "active").order("full_name"),
        supabase.from("classes").select("id,class_name,section").eq("is_active", true).order("grade_level", { nullsFirst: true }).order("class_name"),
        supabase.from("class_subject_summary").select("id,class_id,subject_id,subject_name,subject_code").eq("is_active", true).order("subject_name"),
      ])
    : [await assignmentsPromise, { data: [] }, { data: [] }, { data: [] }];

  const teachers = (teachersResult.data || []) as any[];
  const classes = (classesResult.data || []) as any[];
  const classSubjects = (classSubjectsResult.data || []) as any[];
  const rows = (assignmentsResult.data || []) as any[];

  const uniqueClasses = new Set(rows.map((r) => `${r.class_name}|${r.section || ""}`)).size;
  const uniqueSubjects = new Set(rows.map((r) => r.subject_code || r.subject_name)).size;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{canEdit ? "Academic setup" : "Teacher workspace"}</div>
          <h1>{canEdit ? "Teacher Assignments" : "My Teaching"}</h1>
          <p>
            {canEdit
              ? "Select a teacher, choose a class, then tick all subjects the teacher handles. Class-teacher responsibility is assigned separately for the class."
              : "Your assigned classes and subjects are shown below."}
          </p>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      {!canEdit ? (
        <div className="teacher-summary-grid">
          <div className="metric-card"><span className="metric-kicker">Assigned classes</span><strong>{uniqueClasses}</strong><small>Classes currently linked to your teaching load</small></div>
          <div className="metric-card"><span className="metric-kicker">Assigned subjects</span><strong>{uniqueSubjects}</strong><small>Subjects currently assigned to you</small></div>
          <div className="metric-card"><span className="metric-kicker">Teaching links</span><strong>{rows.length}</strong><small>Class-subject assignments</small></div>
        </div>
      ) : null}

      {canEdit ? (
        <TeacherAssignmentForm
          teachers={teachers}
          classes={classes}
          classSubjects={classSubjects}
        />
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {canEdit ? <th>Teacher</th> : null}
              <th>Class</th>
              <th>Subject</th>
              <th>Class Teacher</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canEdit ? <td><strong>{r.teacher_name}</strong><br /><span className="muted">{r.employee_code || ""}</span></td> : null}
                <td><strong>{r.class_name}{r.section ? ` / ${r.section}` : ""}</strong></td>
                <td>{r.subject_name} <span className="subject-code">{r.subject_code}</span></td>
                <td>{r.is_class_teacher ? <span className="tag">Yes</span> : <span className="muted">No</span>}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={canEdit ? 4 : 3} className="muted">
                {canEdit ? "No assignments yet." : "No teaching assignments have been allocated to your account yet."}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
