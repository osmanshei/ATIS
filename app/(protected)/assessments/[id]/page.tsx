import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { saveCaAssessmentAction } from "../actions";

export default async function AssessmentWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const paramsQuery = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);

  const [{ data: setup }, { data: assessments }, { data: resultRows }] = await Promise.all([
    supabase.from("assessment_setup_summary").select("*").eq("id", id).single(),
    supabase
      .from("ca_assessment_summary")
      .select("*")
      .eq("setup_id", id)
      .order("component")
      .order("assessment_no"),
    supabase
      .from("student_subject_results")
      .select("student_id,total_score,grade")
      .eq("setup_id", id),
  ]);

  if (!setup) notFound();

  const scored = (resultRows || []).filter((r: any) => Number(r.total_score || 0) > 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{setup.class_name}{setup.section ? " / " + setup.section : ""} · {setup.term_name}</div>
          <h1>{setup.subject_name}</h1>
          <p>{setup.subject_code} · CA {setup.ca_weight}% · Exam {setup.exam_weight}% · {setup.scheme_name}</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/assessments">Back</Link>
          <Link className="button" href={"/assessments/" + id + "/exam"}>Exam Scores</Link>
        </div>
      </div>

      {paramsQuery.ok ? <div className="notice success">{paramsQuery.ok}</div> : null}
      {paramsQuery.error ? <div className="notice error">{paramsQuery.error}</div> : null}

      <div className="teacher-summary-grid">
        <div className="metric-card"><span className="metric-kicker">CA assessments</span><strong>{assessments?.length || 0}</strong><small>Configured continuous assessments</small></div>
        <div className="metric-card"><span className="metric-kicker">CA weight</span><strong>{setup.ca_weight}%</strong><small>Continuous assessment contribution</small></div>
        <div className="metric-card"><span className="metric-kicker">Students with totals</span><strong>{scored}</strong><small>Have a non-zero computed total</small></div>
      </div>

      {setup.status !== "locked" ? (
        <form className="form-card" action={saveCaAssessmentAction}>
          <h2 className="section-title">Add / update CA assessment</h2>
          <input type="hidden" name="setup_id" value={id} />
          <div className="form-grid">
            <div className="field">
              <label>Component</label>
              <select name="component" defaultValue="class_test">
                <option value="class_exercise">Class Exercise</option>
                <option value="homework">Homework</option>
                <option value="class_test">Class Test</option>
                <option value="project">Project</option>
                <option value="practical">Practical</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field"><label>Assessment No.</label><input name="assessment_no" type="number" min="1" defaultValue="1" required /></div>
            <div className="field"><label>Name</label><input name="assessment_name" placeholder="e.g. Class Test 1" required /></div>
            <div className="field"><label>Maximum mark</label><input name="max_mark" type="number" min="1" step="0.01" required /></div>
            <div className="field"><label>Date</label><input name="assessment_date" type="date" /></div>
            <div className="field"><label>Status</label><select name="status" defaultValue="open"><option value="open">Open</option><option value="draft">Draft</option><option value="closed">Closed</option></select></div>
          </div>
          <button className="button" type="submit">Save CA assessment</button>
        </form>
      ) : <div className="notice">This subject setup is locked.</div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Component</th><th>Assessment</th><th>Date</th><th>Max Mark</th><th>Scores Entered</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {(assessments || []).map((a: any) => (
              <tr key={a.id}>
                <td>{String(a.component).replaceAll("_", " ")}</td>
                <td><strong>{a.assessment_name}</strong><br /><span className="muted">No. {a.assessment_no}</span></td>
                <td>{a.assessment_date || "—"}</td>
                <td>{a.max_mark}</td>
                <td>{a.score_count}</td>
                <td><span className="tag">{a.status}</span></td>
                <td><Link className="button secondary compact" href={"/assessments/" + id + "/ca/" + a.id + "/scores"}>Enter Scores</Link></td>
              </tr>
            ))}
            {!assessments?.length ? <tr><td colSpan={7} className="muted">No CA assessments yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
