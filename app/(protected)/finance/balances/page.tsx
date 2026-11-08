import Link from "next/link";
import { requireProfile } from "@/lib/auth";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; class?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const params = await searchParams;

  const [{ data: terms }, { data: classes }] = await Promise.all([
    supabase.from("terms").select("id,name,is_current,starts_on").order("starts_on"),
    supabase
      .from("classes")
      .select("id,class_name,section,grade_level")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
  ]);

  const termId =
    params.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";
  const classId = params.class || "";

  let query = supabase
    .from("finance_student_summary")
    .select(
      "student_id,admission_number,first_name,middle_name,last_name,class_id,class_name,section,gross_fees,concession_amount,additional_adjustment,net_fees,amount_paid,outstanding_balance,credit_balance",
    )
    .eq("term_id", termId)
    .order("class_name")
    .order("first_name");

  if (classId) query = query.eq("class_id", classId);

  const { data: rows } = await query;

  let arrearsQuery = supabase
    .from("student_fee_arrears")
    .select("student_id,class_id,arrears_amount,updated_at")
    .gt("arrears_amount", 0)
    .order("updated_at", { ascending: false });

  if (classId) arrearsQuery = arrearsQuery.eq("class_id", classId);

  const { data: arrearsRows } = await arrearsQuery;
  const arrearsStudentIds = Array.from(
    new Set((arrearsRows || []).map((r: any) => r.student_id)),
  );
  const { data: arrearsStudents } = arrearsStudentIds.length
    ? await supabase
        .from("students")
        .select("id,admission_number,first_name,middle_name,last_name")
        .in("id", arrearsStudentIds)
    : { data: [] as any[] };

  const arrearsStudentMap = new Map((arrearsStudents || []).map((s: any) => [s.id, s]));
  const arrearsByStudentId = new Map((arrearsRows || []).map((r: any) => [r.student_id, Number(r.arrears_amount || 0)]));
  const classMap = new Map((classes || []).map((c: any) => [c.id, c]));

  const outstanding = (rows || []).reduce(
    (sum: number, r: any) => sum + Number(r.outstanding_balance || 0),
    0,
  );
  const paid = (rows || []).reduce((sum: number, r: any) => sum + Number(r.amount_paid || 0), 0);
  const netFees = (rows || []).reduce((sum: number, r: any) => sum + Number(r.net_fees || 0), 0);
  const debtors = (rows || []).filter((r: any) => Number(r.outstanding_balance || 0) > 0).length;
  const arrearsTotal = (arrearsRows || []).reduce(
    (sum: number, r: any) => sum + Number(r.arrears_amount || 0),
    0,
  );
  const combinedOutstanding = outstanding + arrearsTotal;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · receivables</div>
          <h1>Student Balances</h1>
          <p>Review fees billed, payments received, concessions and outstanding balances.</p>
        </div>
        <Link className="button secondary" href={"/finance?term=" + termId}>Back to finance</Link>
      </div>

      <form className="form-card form-grid" method="get">
        <div className="field">
          <label>Term</label>
          <select name="term" defaultValue={termId}>
            {(terms || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? " · Current" : ""}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Class</label>
          <select name="class" defaultValue={classId}>
            <option value="">All classes</option>
            {(classes || []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.class_name}{c.section ? " / " + c.section : ""}</option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">Apply filters</button>
      </form>

      <div className="teacher-summary-grid">
        <div className="metric-card">
          <span className="metric-kicker">Net fees</span>
          <strong>{money(netFees)}</strong>
          <small>After concessions and adjustments</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Collected</span>
          <strong>{money(paid)}</strong>
          <small>Total valid payments posted</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Current-term outstanding</span>
          <strong>{money(outstanding)}</strong>
          <small>{debtors} students with balances</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Previous arrears</span>
          <strong>{money(arrearsTotal)}</strong>
          <small>{arrearsRows?.length || 0} imported opening balances</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Combined outstanding</span>
          <strong>{money(combinedOutstanding)}</strong>
          <small>Current term plus previous arrears</small>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th><th>Class</th><th>Gross</th><th>Concession</th>
              <th>Other Adj.</th><th>Net Fees</th><th>Paid</th><th>Current-term balance</th>
              <th>Previous arrears</th><th>Combined due</th><th>Credit</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: any) => {
              const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ");
              const previousArrears = arrearsByStudentId.get(r.student_id) || 0;
              const currentTermBalance = Number(r.outstanding_balance || 0);
              const combinedDue = currentTermBalance + previousArrears;
              return (
                <tr key={r.student_id}>
                  <td><strong>{name}</strong><br /><span className="muted">{r.admission_number || ""}</span></td>
                  <td>{r.class_name}{r.section ? " / " + r.section : ""}</td>
                  <td>{money(r.gross_fees)}</td>
                  <td>{money(r.concession_amount)}</td>
                  <td>{money(r.additional_adjustment)}</td>
                  <td><strong>{money(r.net_fees)}</strong></td>
                  <td>{money(r.amount_paid)}</td>
                  <td><strong className={currentTermBalance > 0 ? "finance-due" : ""}>{money(currentTermBalance)}</strong></td>
                  <td>{previousArrears > 0 ? <strong className="finance-due">{money(previousArrears)}</strong> : "—"}</td>
                  <td><strong className={combinedDue > 0 ? "finance-due" : ""}>{money(combinedDue)}</strong></td>
                  <td>{Number(r.credit_balance || 0) > 0 ? money(r.credit_balance) : "—"}</td>
                  <td>
                    <Link className="button secondary compact" href={"/finance/student/" + r.student_id + "?term=" + termId}>
                      Statement
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows?.length ? (
              <tr><td colSpan={12} className="muted">No student fee balances are available. Configure fee items first.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Opening balances</div>
            <h2>Previous fee arrears</h2>
            <p className="muted">
              Imported balances from earlier terms. They remain separate from current-term charges; payments posted against current-term fees do not automatically reduce these arrears.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Class at import</th><th>Arrears</th><th>Last updated</th><th></th></tr>
            </thead>
            <tbody>
              {(arrearsRows || []).map((r: any) => {
                const student = arrearsStudentMap.get(r.student_id) as any;
                const cls = classMap.get(r.class_id) as any;
                const name = student
                  ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")
                  : "Student record unavailable";
                return (
                  <tr key={r.student_id}>
                    <td>
                      <strong>{name}</strong><br />
                      <span className="muted">{student?.admission_number || ""}</span>
                    </td>
                    <td>{cls?.class_name || "—"}{cls?.section ? " / " + cls.section : ""}</td>
                    <td><strong className="finance-due">{money(r.arrears_amount)}</strong></td>
                    <td>{r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GH") : "—"}</td>
                    <td><Link className="button secondary compact" href={"/finance/student/" + r.student_id + "?term=" + termId}>Statement</Link></td>
                  </tr>
                );
              })}
              {!arrearsRows?.length ? (
                <tr><td colSpan={5} className="muted">No historical arrears have been imported yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
