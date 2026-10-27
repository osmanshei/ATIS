import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { initializeStandardCaAssessmentsAction, saveCaAssessmentAction } from "../actions";

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
  const activeAssessments = (assessments || []).filter((a: any) => a.status !== "draft");
  const configuredRawMax = activeAssessments.reduce((sum: number, a: any) => sum + Number(a.max_mark || 0), 0);
  const caSetupReady =
    activeAssessments.filter((a: any) => a.component === "class_exercise").length === 5 &&
    activeAssessments.filter((a: any) => a.component === "homework").length === 5 &&
    activeAssessments.filter((a: any) => a.component === "class_test").length === 3 &&
    Math.round(configuredRawMax * 100) === Math.round(Number(setup.ca_max_mark || 130) * 100);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{setup.class_name}{setup.section ? " / " + setup.section : ""} · {setup.term_name}</div>
          <h1>{setup.subject_name}</h1>
          <p>{setup.subject_code} · CA {setup.ca_weight}% (raw maximum {setup.ca_max_mark}) · Exam {setup.exam_weight}% (written × 80% + oral /20) · {setup.scheme_name}</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/assessments">Back</Link>
          <Link className="button" href={"/assessments/" + id + "/ca-entry"}>CA Scorebook</Link>
          <Link className="button" href={"/assessments/" + id + "/exam"}>Exam Scores</Link>
        </div>
      </div>

      {paramsQuery.ok ? <div className="notice success">{paramsQuery.ok}</div> : null}
      {paramsQuery.error ? <div className="notice error">{paramsQuery.error}</div> : null}

      <div className="teacher-summary-grid">
        <div className="metric-card"><span className="metric-kicker">Standard CA slots</span><strong>{activeAssessments.length} / 13</strong><small>5 exercises · 5 homework · 3 tests</small></div>
        <div className="metric-card"><span className="metric-kicker">Configured CA maximum</span><strong>{configuredRawMax} / {setup.ca_max_mark}</strong><small>{caSetupReady ? "Ready for score entry" : "Assessment maxima must match the raw CA maximum"}</small></div>
        <div className="metric-card"><span className="metric-kicker">CA weight</span><strong>{setup.ca_weight}%</strong><small>Continuous assessment contribution</small></div>
        <div className="metric-card"><span className="metric-kicker">Students with totals</span><strong>{scored}</strong><small>Have a non-zero computed total</small></div>
      </div>

      {setup.status !== "locked" ? (
        <>
        <form className="form-card" action={initializeStandardCaAssessmentsAction}>
          <h2 className="section-title">Standard CA setup</h2>
          <p className="muted">
            Create the 13 standard slots: 5 class exercises, 5 homework assignments and 3 class tests.
            Default maxima are 10 each for a raw CA maximum of 130; when the configured raw maximum is 160,
            class tests default to 20 each. Existing slots and their marks are preserved.
          </p>
          <input type="hidden" name="setup_id" value={id} />
          <button className="button" type="submit">Create missing CA slots</button>
        </form>
        {!caSetupReady ? (
          <div className="notice">
            Before entering CA scores, configure all 13 slots and ensure their maximum marks total {setup.ca_max_mark}.
          </div>
        ) : null}
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
              </select>
            </div>
            <div className="field"><label>Assessment No. (1–5; tests 1–3)</label><input name="assessment_no" type="number" min="1" max="5" required /></div>
            <div className="field"><label>Name</label><input name="assessment_name" placeholder="e.g. Class Test 1" required /></div>
            <div className="field"><label>Maximum mark</label><input name="max_mark" type="number" min="1" step="0.01" defaultValue="10" required /></div>
            <div className="field"><label>Date</label><input name="assessment_date" type="date" /></div>
            <div className="field"><label>Status</label><select name="status" defaultValue="open"><option value="open">Open</option><option value="draft">Draft</option><option value="closed">Closed</option></select></div>
          </div>
          <p className="muted">Choose the same component and number to update an existing slot. The sum of all 13 maximum marks must equal the raw CA maximum above.</p>
          <button className="button" type="submit">Save CA assessment</button>
        </form>
        </>
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
