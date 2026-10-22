import { requireProfile } from "@/lib/auth";
import { createTeacherAssignmentAction } from "./actions";

export default async function TeacherAssignmentsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;
  const canEdit = ["admin", "supervisor"].includes(profile.role);
  const [teachersResult, classSubjectsResult, assignmentsResult] = await Promise.all([
    supabase.from("staff").select("id,full_name,employee_code").eq("role", "teacher").eq("status", "active").order("full_name"),
    supabase.from("class_subject_summary").select("id,class_name,section,subject_name,subject_code").eq("is_active", true).order("class_name"),
    supabase.from("teacher_assignment_summary").select("id,teacher_name,employee_code,class_name,section,subject_name,subject_code,is_class_teacher,periods_per_week").order("teacher_name"),
  ]);
  const teachers=(teachersResult.data||[]) as any[];
  const classSubjects=(classSubjectsResult.data||[]) as any[];
  const rows=(assignmentsResult.data||[]) as any[];

  return <>
    <div className="page-head"><div><h1>Teacher Assignments</h1><p>Assign teachers to a specific class-subject relationship.</p></div></div>
    {params.ok ? <div className="notice success">{params.ok}</div> : null}
    {params.error ? <div className="notice error">{params.error}</div> : null}
    {canEdit ? <form className="form-card form-grid" action={createTeacherAssignmentAction}>
      <div className="field"><label>Teacher</label><select name="teacher_id" required><option value="">Choose...</option>{teachers.map((t)=><option key={t.id} value={t.id}>{t.full_name}{t.employee_code?` (${t.employee_code})`:""}</option>)}</select></div>
      <div className="field"><label>Class / subject</label><select name="class_subject_id" required><option value="">Choose...</option>{classSubjects.map((x)=><option key={x.id} value={x.id}>{x.class_name}{x.section?` / ${x.section}`:""} — {x.subject_name}</option>)}</select></div>
      <div className="field"><label>Periods / week</label><input name="periods_per_week" type="number" min="0" max="30" /></div>
      <div className="field"><label><input name="is_class_teacher" type="checkbox" /> Class teacher responsibility</label></div>
      <button className="button" type="submit">Assign teacher</button>
    </form> : null}
    <div className="table-wrap"><table>
      <thead><tr><th>Teacher</th><th>Class</th><th>Subject</th><th>Periods / week</th><th>Class teacher</th></tr></thead>
      <tbody>{rows.map((r)=><tr key={r.id}><td><strong>{r.teacher_name}</strong><br/><span className="muted">{r.employee_code||""}</span></td><td>{r.class_name}{r.section?` / ${r.section}`:""}</td><td>{r.subject_name} ({r.subject_code})</td><td>{r.periods_per_week??"—"}</td><td>{r.is_class_teacher?"Yes":"No"}</td></tr>)}{!rows.length?<tr><td colSpan={5} className="muted">No assignments yet.</td></tr>:null}</tbody>
    </table></div>
  </>;
}
