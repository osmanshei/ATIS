import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;
  const canPublish = profile.role === "admin" || profile.role === "supervisor";

  const { data: terms } = await supabase
    .from("terms")
    .select("id,name,is_current,starts_on,ends_on")
    .order("starts_on");

  const selectedTerm =
    params.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  if (!canPublish) {
    const [{ data: setups }, { data: rows }] = await Promise.all([
      supabase
        .from("assessment_setup_summary")
        .select("id,class_id,class_name,section,subject_id,subject_name,subject_code,term_name")
        .eq("term_id", selectedTerm)
        .order("class_name")
        .order("subject_name"),
      supabase
        .from("student_subject_results")
        .select("setup_id,total_score,result_complete")
        .eq("term_id", selectedTerm),
    ]);

    const rowsBySetup = new Map<string, any[]>();
    for (const row of rows || []) {
      const list = rowsBySetup.get(row.setup_id) || [];
      list.push(row);
      rowsBySetup.set(row.setup_id, list);
    }

    return (
      <>
        <section className="welcome-hero">
          <div>
            <div className="eyebrow">Teacher results workspace</div>
            <h1>My Subject Results</h1>
            <p>Review result completion and averages only for subjects assigned to you.</p>
          </div>
          <Link className="button hero-button" href="/assessments">Enter Scores</Link>
        </section>

        <form className="term-switcher" method="get">
          <label>Term</label>
          <select name="term" defaultValue={selectedTerm}>
            {(terms || []).map((term: any) => (
              <option key={term.id} value={term.id}>{term.name}{term.is_current ? " · Current" : ""}</option>
            ))}
          </select>
          <button className="button secondary compact" type="submit">View</button>
        </form>

        <div className="assessment-grid">
          {(setups || []).map((setup: any) => {
            const resultRows = rowsBySetup.get(setup.id) || [];
            const completed = resultRows.filter((r) => r.result_complete).length;
            const completedRows = resultRows.filter((r) => r.result_complete);
            const average = completedRows.length
              ? Math.round(
                  (completedRows.reduce((sum, r) => sum + Number(r.total_score || 0), 0) /
                    completedRows.length) *
                    10,
                ) / 10
              : 0;

            return (
              <article className="assessment-card" key={setup.id}>
                <div className="metric-kicker">
                  {setup.class_name}{setup.section ? " / " + setup.section : ""}
                </div>
                <h3>{setup.subject_name}</h3>
                <p>{setup.subject_code}</p>
                <div className="assessment-weights">
                  <span>Average <strong>{average}%</strong></span>
                  <span>Complete <strong>{completed}/{resultRows.length}</strong></span>
                </div>
                <Link className="button compact" href={"/assessments/" + setup.id}>
                  Open subject
                </Link>
              </article>
            );
          })}
          {!setups?.length ? (
            <div className="empty-state">
              <strong>No subject results yet</strong>
              <p>Your assigned subjects have not been configured for this term.</p>
            </div>
          ) : null}
        </div>
      </>
    );
  }

  const [{ data: classes }, { data: setups }, { data: publications }] = await Promise.all([
    supabase
      .from("class_summary")
      .select("id,class_name,section,total_strength,grade_level,is_active")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
    supabase
      .from("assessment_setup_summary")
      .select("id,class_id,term_id")
      .eq("term_id", selectedTerm),
    supabase
      .from("result_publications")
      .select("id,class_id,status,published_at,reviewed_at")
      .eq("term_id", selectedTerm),
  ]);

  const setupCounts = new Map<string, number>();
  for (const row of setups || []) {
    setupCounts.set(row.class_id, (setupCounts.get(row.class_id) || 0) + 1);
  }
  const publicationMap = new Map((publications || []).map((p: any) => [p.class_id, p]));

  return (
    <>
      <section className="welcome-hero admin-hero">
        <div>
          <div className="eyebrow">Management results workspace</div>
          <h1>Results & Report Cards</h1>
          <p>Review class readiness, publish results and print individual report cards.</p>
        </div>
        <Link className="button hero-button" href="/assessments">Assessment Setup</Link>
      </section>

      <form className="term-switcher" method="get">
        <label>Term</label>
        <select name="term" defaultValue={selectedTerm}>
          {(terms || []).map((term: any) => (
            <option key={term.id} value={term.id}>{term.name}{term.is_current ? " · Current" : ""}</option>
          ))}
        </select>
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="attendance-class-grid">
        {(classes || []).map((c: any) => {
          const pub = publicationMap.get(c.id) as any;
          const status = pub?.status || "draft";
          return (
            <article className="attendance-class-card" key={c.id}>
              <div>
                <span className="metric-kicker">Class</span>
                <h3>{c.class_name}{c.section ? " / " + c.section : ""}</h3>
                <p>{c.total_strength || 0} active students · {setupCounts.get(c.id) || 0} subject setups</p>
              </div>
              <div className="attendance-class-status">
                <span className={status === "published" ? "tag" : "tag gray"}>{status}</span>
                <strong>{setupCounts.get(c.id) || 0}</strong>
                <small>Subjects configured for selected term</small>
              </div>
              <Link
                className="button compact"
                href={"/results/class/" + c.id + "?term=" + selectedTerm}
              >
                Review class
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}
