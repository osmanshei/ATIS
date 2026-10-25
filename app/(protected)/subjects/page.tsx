import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { attachSubjectToClassAction, createSubjectAction, setSubjectReportFlagAction } from "./actions";

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const params = await searchParams;
  const canEdit = ["admin", "supervisor"].includes(profile.role);
  const [subjectsResult, classesResult, linksResult] = await Promise.all([
    supabase.from("subject_catalogue").select("id,subject_name,subject_code,is_active,include_on_report").order("subject_name"),
    supabase.from("classes").select("id,class_name,section").eq("is_active", true).order("class_name"),
    supabase.from("class_subject_summary").select("id,class_name,section,subject_name,subject_code,max_marks,pass_marks,is_optional,include_on_report").order("class_name"),
  ]);
  const subjects = (subjectsResult.data || []) as any[];
  const classes = (classesResult.data || []) as any[];
  const links = (linksResult.data || []) as any[];

  return (
    <>
      <div className="page-head"><div><h1>Subjects</h1><p>A master catalogue is linked to each class instead of duplicating subject definitions.</p></div></div>
      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {canEdit ? <div className="grid-2">
        <form className="form-card" action={createSubjectAction}>
          <h2 className="section-title">New subject</h2>
          <div className="field"><label>Subject name</label><input name="subject_name" required /></div>
          <div className="field"><label>Code</label><input name="subject_code" placeholder="MATH" required /></div>
          <label className="checkbox-field"><input name="include_on_report" type="checkbox" defaultChecked /> Include on report cards</label>
          <p className="muted">Untick this for timetable-only subjects.</p>
          <button className="button" type="submit">Create subject</button>
        </form>
        <form className="form-card" action={attachSubjectToClassAction}>
          <h2 className="section-title">Attach subject to class</h2>
          <div className="field"><label>Class</label><select name="class_id" required><option value="">Choose...</option>{classes.map((c)=><option key={c.id} value={c.id}>{c.class_name}{c.section ? ` / ${c.section}` : ""}</option>)}</select></div>
          <div className="field"><label>Subject</label><select name="subject_id" required><option value="">Choose...</option>{subjects.map((s)=><option key={s.id} value={s.id}>{s.subject_name} ({s.subject_code})</option>)}</select></div>
          <div className="form-grid"><div className="field"><label>Max marks</label><input name="max_marks" type="number" defaultValue="100" /></div><div className="field"><label>Pass marks</label><input name="pass_marks" type="number" defaultValue="50" /></div></div>
          <button className="button" type="submit">Attach</button>
        </form>
      </div> : null}
      <div className="table-wrap"><table>
        <thead><tr><th>Class</th><th>Section</th><th>Subject</th><th>Code</th><th>Usage</th><th>Max</th><th>Pass</th></tr></thead>
        <tbody>{links.map((r)=><tr key={r.id}><td>{r.class_name}</td><td>{r.section || "—"}</td><td><strong>{r.subject_name}</strong></td><td>{r.subject_code}</td><td><span className={r.include_on_report ? "tag" : "tag gray"}>{r.include_on_report ? "Report" : "Timetable only"}</span></td><td>{r.max_marks}</td><td>{r.pass_marks}</td></tr>)}{!links.length?<tr><td colSpan={7} className="muted">No class-subject links yet.</td></tr>:null}</tbody>
      </table></div>

      <section className="panel-section">
        <div className="section-heading"><div><div className="eyebrow">Report-card control</div><h2>Subject catalogue</h2></div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Subject</th><th>Code</th><th>Current Use</th><th>Actions</th></tr></thead>
          <tbody>
            {subjects.map((s)=><tr key={s.id}>
              <td><strong>{s.subject_name}</strong></td>
              <td>{s.subject_code}</td>
              <td><span className={s.include_on_report ? "tag" : "tag gray"}>{s.include_on_report ? "Report card" : "Timetable only"}</span></td>
              <td>
                <div className="action-row">
                <Link className="button secondary compact" href={"/subjects/" + s.id + "/edit"}>Edit</Link>
                <Link className="button secondary compact" href={"/subjects/" + s.id + "/aspects"}>Manage Aspects</Link>
                <form action={setSubjectReportFlagAction}>
                  <input type="hidden" name="subject_id" value={s.id} />
                  <input type="hidden" name="include_on_report" value={s.include_on_report ? "false" : "true"} />
                  <button className="button secondary compact" type="submit">
                    {s.include_on_report ? "Make timetable only" : "Include on report"}
                  </button>
                </form>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table></div>
      </section>
    </>
  );
}
