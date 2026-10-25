import { requireProfile } from "@/lib/auth";
import { createTeacherAssignmentAction } from "./actions";

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
    .order("teacher_name");

  const [assignmentsResult, teachersResult, classSubjectsResult] = canEdit
    ? await Promise.all([
        assignmentsPromise,
        supabase.from("staff").select("id,full_name,employee_code").eq("role", "teacher").eq("status", "active").order("full_name"),
        supabase.from("class_subject_summary").select("id,class_name,section,subject_name,subject_code").eq("is_active", true).order("class_name"),
      ])
    : [await assignmentsPromise, { data: [] }, { data: [] }];

  const teachers = (teachersResult.data || []) as any[];
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
              ? "Assign teachers to the main subjects they teach. Teaching aspects are selected later when lessons are placed on the timetable."
              : "Only the main subjects assigned to you are shown here; aspect-specific lessons appear on My Timetable."}
          </p>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      {!canEdit ? (
        <div className="teacher-summary-grid">
          <div className="metric-card">
            <span className="metric-kicker">Assigned classes</span>
            <strong>{uniqueClasses}</strong>
            <small>Classes currently linked to your teaching load</small>
          </div>
          <div className="metric-card">
            <span className="metric-kicker">Assigned subjects</span>
            <strong>{uniqueSubjects}</strong>
            <small>Subjects currently assigned to you</small>
          </div>
          <div className="metric-card">
            <span className="metric-kicker">Teaching links</span>
            <strong>{rows.length}</strong>
            <small>Class-subject assignments</small>
          </div>
        </div>
      ) : null}

      {canEdit ? (
        <form className="form-card form-grid" action={createTeacherAssignmentAction}>
          <div className="field">
            <label>Teacher</label>
            <select name="teacher_id" required>
              <option value="">Choose...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.employee_code ? ` (${t.employee_code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Class / subject</label>
            <select name="class_subject_id" required>
              <option value="">Choose...</option>
              {classSubjects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.class_name}{x.section ? ` / ${x.section}` : ""} — {x.subject_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Periods / week</label>
            <input name="periods_per_week" type="number" min="0" max="30" />
          </div>
          <div className="field checkbox-field">
            <label><input name="is_class_teacher" type="checkbox" /> Class teacher responsibility</label>
          </div>
          <button className="button" type="submit">Assign teacher</button>
        </form>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {canEdit ? <th>Teacher</th> : null}
              <th>Class</th>
              <th>Subject</th>
              <th>Periods / week</th>
              <th>Class teacher</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canEdit ? (
                  <td><strong>{r.teacher_name}</strong><br /><span className="muted">{r.employee_code || ""}</span></td>
                ) : null}
                <td><strong>{r.class_name}{r.section ? ` / ${r.section}` : ""}</strong></td>
                <td>{r.subject_name} <span className="subject-code">{r.subject_code}</span></td>
                <td>{r.periods_per_week ?? "—"}</td>
                <td>{r.is_class_teacher ? <span className="tag">Yes</span> : <span className="muted">No</span>}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={canEdit ? 5 : 4} className="muted">
                {canEdit ? "No assignments yet." : "No teaching assignments have been allocated to your account yet."}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
