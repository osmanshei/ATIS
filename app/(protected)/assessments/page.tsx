import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  initializeTermAssessmentsAction,
  saveAssessmentSetupAction,
} from "./actions";

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; term?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;
  const canConfigure = profile.role === "admin" || profile.role === "supervisor";

  const { data: terms } = await supabase
    .from("terms")
    .select("id,name,is_current,starts_on,ends_on")
    .order("starts_on");

  const selectedTerm =
    params.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  const setupQuery = supabase
    .from("assessment_setup_summary")
    .select("*")
    .eq("term_id", selectedTerm)
    .order("class_name")
    .order("subject_name");

  const [setupsResult, classSubjectsResult, schemesResult] = canConfigure
    ? await Promise.all([
        setupQuery,
        supabase
          .from("class_subject_summary")
          .select("id,class_name,section,subject_name,subject_code,is_active,include_on_report")
          .eq("is_active", true)
          .eq("include_on_report", true)
          .order("class_name")
          .order("subject_name"),
        supabase
          .from("grade_schemes")
          .select("id,scheme_name,level")
          .eq("is_active", true)
          .order("level"),
      ])
    : [await setupQuery, { data: [] }, { data: [] }];

  const setups = (setupsResult.data || []) as any[];
  const classSubjects = (classSubjectsResult.data || []) as any[];
  const schemes = (schemesResult.data || []) as any[];
  const classCount = new Set(setups.map((s) => s.class_id)).size;
  const subjectCount = new Set(setups.map((s) => s.subject_id)).size;

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">{canConfigure ? "Assessment management" : "Teacher assessment workspace"}</div>
          <h1>{canConfigure ? "Assessments & Scores" : "My Assessments"}</h1>
          <p>
            {canConfigure
              ? "Configure CA and examination weighting, review subject setups and prepare results."
              : "Enter scores only for the classes and subjects assigned to you."}
          </p>
        </div>
        <Link className="button hero-button" href="/results">Results & Report Cards</Link>
      </section>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form className="term-switcher" method="get">
        <label>Term</label>
        <select name="term" defaultValue={selectedTerm}>
          {(terms || []).map((term: any) => (
            <option key={term.id} value={term.id}>{term.name}{term.is_current ? " · Current" : ""}</option>
          ))}
        </select>
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="teacher-summary-grid">
        <div className="metric-card"><span className="metric-kicker">Subject setups</span><strong>{setups.length}</strong><small>Available in selected term</small></div>
        <div className="metric-card"><span className="metric-kicker">Classes</span><strong>{classCount}</strong><small>Classes represented</small></div>
        <div className="metric-card"><span className="metric-kicker">Subjects</span><strong>{subjectCount}</strong><small>Distinct subjects represented</small></div>
      </div>

      {canConfigure && selectedTerm ? (
        <div className="grid-2">
          <form className="form-card" action={initializeTermAssessmentsAction}>
            <h2 className="section-title">Initialize the term</h2>
            <p className="muted">
              Create missing assessment setups for every active class-subject at once.
            </p>
            <input type="hidden" name="term_id" value={selectedTerm} />
            <div className="form-grid">
              <div className="field"><label>CA weight (%)</label><input name="ca_weight" type="number" min="0" max="100" defaultValue="40" /></div>
              <div className="field"><label>Exam weight (%)</label><input name="exam_weight" type="number" min="0" max="100" defaultValue="60" /></div>
            </div>
            <button className="button" type="submit">Initialize Current Term</button>
          </form>

          <form className="form-card" action={saveAssessmentSetupAction}>
            <h2 className="section-title">Configure one subject</h2>
            <input type="hidden" name="term_id" value={selectedTerm} />
            <div className="field">
              <label>Class / Subject</label>
              <select name="class_subject_id" required>
                <option value="">Choose...</option>
                {classSubjects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.class_name}{x.section ? " / " + x.section : ""} — {x.subject_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field"><label>CA weight</label><input name="ca_weight" type="number" defaultValue="40" min="0" max="100" /></div>
              <div className="field"><label>Exam weight</label><input name="exam_weight" type="number" defaultValue="60" min="0" max="100" /></div>
            </div>
            <div className="field">
              <label>Grade scheme</label>
              <select name="grade_scheme_id" required>
                <option value="">Choose...</option>
                {schemes.map((g) => <option key={g.id} value={g.id}>{g.scheme_name} · {g.level}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select name="status" defaultValue="active">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="locked">Locked</option>
              </select>
            </div>
            <button className="button" type="submit">Save setup</button>
          </form>
        </div>
      ) : null}

      <div className="assessment-grid">
        {setups.map((s) => (
          <article className="assessment-card" key={s.id}>
            <div className="assessment-card-head">
              <span className="tag">{s.term_name}</span>
              <span className={s.status === "locked" ? "tag gray" : "tag"}>{s.status}</span>
            </div>
            <div className="metric-kicker">{s.class_name}{s.section ? " / " + s.section : ""}</div>
            <h3>{s.subject_name}</h3>
            <p>{s.subject_code}</p>
            <div className="assessment-weights">
              <span>CA <strong>{s.ca_weight}%</strong></span>
              <span>Exam <strong>{s.exam_weight}%</strong></span>
            </div>
            <small>{s.scheme_name}</small>
            <Link className="button compact" href={"/assessments/" + s.id}>Open subject</Link>
          </article>
        ))}
        {!setups.length ? (
          <div className="empty-state">
            <strong>No assessment setups found</strong>
            <p>{canConfigure ? "Initialize the selected term to create them." : "Management has not configured your assigned subjects for this term yet."}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
