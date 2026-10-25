import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { setResultPublicationAction } from "../../actions";

export default async function ClassResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ term?: string; ok?: string; error?: string }>;
}) {
  const { classId } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const { data: terms } = await supabase
    .from("terms")
    .select("id,name,is_current,starts_on,ends_on")
    .order("starts_on");

  const termId =
    query.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  const [{ data: cls }, { data: setups }, { data: students }, { data: rows }, { data: publication }] =
    await Promise.all([
      supabase.from("class_summary").select("*").eq("id", classId).single(),
      supabase
        .from("assessment_setup_summary")
        .select("id,subject_id,subject_name,subject_code")
        .eq("class_id", classId)
        .eq("term_id", termId)
        .order("subject_name"),
      supabase
        .from("students")
        .select("id,admission_number,first_name,middle_name,last_name")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("first_name")
        .order("last_name"),
      supabase
        .from("student_subject_results")
        .select("student_id,subject_id,subject_name,total_score,grade,result_complete")
        .eq("class_id", classId)
        .eq("term_id", termId),
      supabase
        .from("result_publications")
        .select("id,status,reviewed_at,published_at,notes")
        .eq("class_id", classId)
        .eq("term_id", termId)
        .maybeSingle(),
    ]);

  if (!cls) notFound();

  const resultsByStudent = new Map<string, any[]>();
  for (const row of rows || []) {
    const list = resultsByStudent.get(row.student_id) || [];
    list.push(row);
    resultsByStudent.set(row.student_id, list);
  }

  const ranked = (students || []).map((student: any) => {
    const subjectRows = resultsByStudent.get(student.id) || [];
    const complete = subjectRows.filter((r) => r.result_complete).length;
    const average = subjectRows.length
      ? subjectRows.reduce((sum, r) => sum + Number(r.total_score || 0), 0) / subjectRows.length
      : 0;
    return {
      ...student,
      subjectRows,
      complete,
      average,
    };
  }).sort((a, b) => b.average - a.average || a.first_name.localeCompare(b.first_name));

  let lastAverage: number | null = null;
  let lastPosition = 0;
  const withPositions = ranked.map((row, index) => {
    const rounded = Math.round(row.average * 100) / 100;
    if (lastAverage === null || rounded !== lastAverage) {
      lastPosition = index + 1;
      lastAverage = rounded;
    }
    return { ...row, position: lastPosition };
  });

  const classLabel = cls.class_name + (cls.section ? " / " + cls.section : "");
  const term = terms?.find((t: any) => t.id === termId);
  const status = publication?.status || "draft";
  const fullyComplete = withPositions.filter(
    (s) => setups?.length && s.complete === setups.length,
  ).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Results review · {term?.name || "Term"}</div>
          <h1>{classLabel}</h1>
          <p>
            {students?.length || 0} students · {setups?.length || 0} subjects configured ·{" "}
            {fullyComplete} students fully complete
          </p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/results?term=" + termId}>Back to results</Link>
          <Link className="button secondary" href={"/assessments?term=" + termId}>Assessment setup</Link>
        </div>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <div className="grid-2">
        <section className="card">
          <div className="eyebrow">Publication</div>
          <h2 className="section-title">Current status: {status}</h2>
          <p className="muted">
            Review the class before publishing. Published status records the management approval time.
          </p>
          {publication?.published_at ? <p><strong>Published:</strong> {new Date(publication.published_at).toLocaleString("en-GB")}</p> : null}
        </section>

        <form className="form-card" action={setResultPublicationAction}>
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="term_id" value={termId} />
          <div className="field">
            <label>Publication status</label>
            <select name="status" defaultValue={status}>
              <option value="draft">Draft</option>
              <option value="reviewed">Reviewed</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <input name="notes" defaultValue={publication?.notes || ""} placeholder="Optional management note" />
          </div>
          <button className="button" type="submit">Update status</button>
        </form>
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Position</th><th>Student</th><th>Subjects Complete</th>
              <th>Average</th><th>Status</th><th>Report Card</th>
            </tr>
          </thead>
          <tbody>
            {withPositions.map((student) => {
              const complete = setups?.length
                ? student.complete === setups.length
                : false;
              const name = [student.first_name, student.middle_name, student.last_name]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={student.id}>
                  <td><strong>{student.position}</strong></td>
                  <td><strong>{name}</strong><br /><span className="muted">{student.admission_number || ""}</span></td>
                  <td>{student.complete} / {setups?.length || 0}</td>
                  <td><strong>{student.average.toFixed(1)}%</strong></td>
                  <td><span className={complete ? "tag" : "tag gray"}>{complete ? "Complete" : "Incomplete"}</span></td>
                  <td>
                    <Link
                      className="button secondary compact"
                      href={"/results/report-card/" + student.id + "?term=" + termId}
                    >
                      Open Report Card
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!withPositions.length ? (
              <tr><td colSpan={6} className="muted">No active students in this class.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
