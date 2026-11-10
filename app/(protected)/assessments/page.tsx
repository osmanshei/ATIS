import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { initializeTermAssessmentsAction } from "./actions";

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

  const { data: setupRows } = await supabase
    .from("assessment_setup_summary")
    .select("*")
    .eq("term_id", selectedTerm)
    .order("class_name")
    .order("subject_name");

  const setups = (setupRows || []) as any[];
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
              ? "Prepare the term once. ATIS creates the standard scorebooks for all active reportable subjects."
              : "Open an assigned subject to enter continuous assessment and examination marks."}
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

      {canConfigure && selectedTerm ? (
        <form className="form-card" action={initializeTermAssessmentsAction}>
          <input type="hidden" name="term_id" value={selectedTerm} />
          <h2 className="section-title">Prepare selected term</h2>
          <p className="muted">
            One action prepares every active class and reportable subject using the ATIS standard:
            5 class exercises, 5 homework assignments and 3 class tests (130 raw CA marks converted
            to 40), plus a written and oral examination converted to 60. The correct primary or JHS
            grading scheme is selected automatically. Repeating this action fills missing slots and
            preserves marks already entered.
          </p>
          <button className="button" type="submit">Prepare term assessments</button>
        </form>
      ) : null}

      <div className="teacher-summary-grid">
        <div className="metric-card"><span className="metric-kicker">Subject scorebooks</span><strong>{setups.length}</strong><small>Available in selected term</small></div>
        <div className="metric-card"><span className="metric-kicker">Classes</span><strong>{classCount}</strong><small>Classes represented</small></div>
        <div className="metric-card"><span className="metric-kicker">Subjects</span><strong>{subjectCount}</strong><small>Reportable subjects represented</small></div>
      </div>

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
            <small>Raw CA maximum: {s.ca_max_mark ?? 130} · {s.scheme_name}</small>
            <Link className="button compact" href={"/assessments/" + s.id}>Open subject</Link>
          </article>
        ))}
        {!setups.length ? (
          <div className="empty-state">
            <strong>No subject scorebooks found</strong>
            <p>
              {canConfigure
                ? "Prepare the selected term to create all standard subject scorebooks."
                : "Management has not prepared your assigned subjects for this term yet."}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
