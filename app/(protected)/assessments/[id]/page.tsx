import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";

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

  const assessmentRows = (assessments || []) as any[];
  const activeAssessments = assessmentRows.filter((a) => a.status !== "draft");
  const exerciseCount = activeAssessments.filter((a) => a.component === "class_exercise").length;
  const homeworkCount = activeAssessments.filter((a) => a.component === "homework").length;
  const testCount = activeAssessments.filter((a) => a.component === "class_test").length;
  const configuredRawMax = activeAssessments.reduce((sum, a) => sum + Number(a.max_mark || 0), 0);
  const caSetupReady =
    exerciseCount === 5 &&
    homeworkCount === 5 &&
    testCount === 3 &&
    Math.round(configuredRawMax * 100) === Math.round(Number(setup.ca_max_mark || 130) * 100);
  const scored = (resultRows || []).filter((r: any) => Number(r.total_score || 0) > 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{setup.class_name}{setup.section ? " / " + setup.section : ""} · {setup.term_name}</div>
          <h1>{setup.subject_name}</h1>
          <p>
            {setup.subject_code} · CA {setup.ca_weight}% · Examination {setup.exam_weight}% · {setup.scheme_name}
          </p>
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
        <div className="metric-card">
          <span className="metric-kicker">Standard CA slots</span>
          <strong>{activeAssessments.length} / 13</strong>
          <small>{exerciseCount} exercises · {homeworkCount} homework · {testCount} tests</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Raw CA maximum</span>
          <strong>{configuredRawMax} / {setup.ca_max_mark || 130}</strong>
          <small>{caSetupReady ? "Standard scorebook ready" : "Waiting for standard term preparation"}</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">CA contribution</span>
          <strong>{setup.ca_weight}%</strong>
          <small>Automatically converted from raw CA marks</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Students with totals</span>
          <strong>{scored}</strong>
          <small>Computed subject results</small>
        </div>
      </div>

      {!caSetupReady ? (
        <div className="notice">
          The standard CA scorebook is not fully prepared for this subject. Management can prepare
          all subjects together from the Assessments page; individual assessment slots do not need
          to be created here.
        </div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Component</th><th>Assessment</th><th>Maximum mark</th><th>Scores entered</th><th>Status</th></tr>
          </thead>
          <tbody>
            {assessmentRows.map((a) => (
              <tr key={a.id}>
                <td>{String(a.component).replaceAll("_", " ")}</td>
                <td><strong>{a.assessment_name}</strong><br /><span className="muted">No. {a.assessment_no}</span></td>
                <td>{a.max_mark}</td>
                <td>{a.score_count}</td>
                <td><span className="tag">{a.status}</span></td>
              </tr>
            ))}
            {!assessmentRows.length ? <tr><td colSpan={5} className="muted">No standard CA slots have been prepared yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
