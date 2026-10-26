import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { recordFeedingPaymentAction } from "../actions";

function fullName(row: any) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function FeedingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; q?: string; student?: string; ok?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant", "clerk"]);
  const params = await searchParams;

  const { data: terms } = await supabase.from("terms").select("id,name,is_current,starts_on").order("starts_on");
  const termId = params.term || terms?.find((r: any) => r.is_current)?.id || terms?.[0]?.id || "";
  const q = String(params.q || "").trim();

  let studentQuery = supabase
    .from("students")
    .select("id,admission_number,first_name,middle_name,last_name,class_id")
    .eq("status", "active")
    .order("first_name")
    .limit(50);

  if (q) {
    const safe = q.replace(/,/g, " ");
    const filter =
      "admission_number.ilike.%" + safe + "%," +
      "first_name.ilike.%" + safe + "%," +
      "middle_name.ilike.%" + safe + "%," +
      "last_name.ilike.%" + safe + "%";
    studentQuery = studentQuery.or(filter);
  }

  const { data: matches } = await studentQuery;
  const studentId = params.student || "";

  const [{ data: student }, { data: plan }, { data: balance }, { data: recent }] = await Promise.all([
    studentId
      ? supabase
          .from("students")
          .select("id,admission_number,first_name,middle_name,last_name,class_id,classes(class_name,section)")
          .eq("id", studentId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    studentId
      ? supabase
          .from("student_feeding_plans")
          .select("frequency,exemption_type,related_staff_id,status")
          .eq("student_id", studentId)
          .eq("term_id", termId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    studentId
      ? supabase
          .from("feeding_student_balance")
          .select("total_paid,total_charged,credit_balance")
          .eq("student_id", studentId)
          .eq("term_id", termId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("feeding_payment_summary")
      .select("id,payment_date,receipt_no,student_id,admission_number,first_name,middle_name,last_name,frequency,coverage_label,amount,payment_method")
      .eq("term_id", termId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  let rate: any = null;
  if (student?.class_id) {
    const { data } = await supabase
      .from("feeding_rates")
      .select("daily_rate,weekly_rate,monthly_rate,termly_rate")
      .eq("term_id", termId)
      .eq("class_id", student.class_id)
      .eq("status", "active")
      .maybeSingle();
    rate = data;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Feeding finance</div>
          <h1>Feeding Payments</h1>
          <p>Payments become prepaid feeding credit. Attendance consumes one daily charge only when the child is in school.</p>
        </div>
        <Link className="button secondary" href="/feeding/settings">Rates & Plans</Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form className="roster-search-card" method="get">
        <div className="field">
          <label>Term</label>
          <select name="term" defaultValue={termId}>
            {(terms || []).map((term: any) => <option key={term.id} value={term.id}>{term.name}{term.is_current ? " · Current" : ""}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Student search</label>
          <input name="q" defaultValue={q} placeholder="Name or admission number" />
        </div>
        <button className="button secondary compact" type="submit">Search</button>
      </form>

      {q && !studentId ? (
        <div className="card feeding-search-results">
          {(matches || []).map((row: any) => (
            <Link
              key={row.id}
              className="feeding-student-result"
              href={"/feeding/payments?term=" + termId + "&q=" + encodeURIComponent(q) + "&student=" + row.id}
            >
              <strong>{fullName(row)}</strong>
              <small>{row.admission_number || "—"}</small>
            </Link>
          ))}
          {!matches?.length ? <p className="muted">No matching students found.</p> : null}
        </div>
      ) : null}

      {student ? (
        <>
          <div className="cards cards-five">
            <div className="metric-card"><span className="metric-kicker">Student</span><strong>{fullName(student)}</strong><small>{student.admission_number}</small></div>
            <div className="metric-card"><span className="metric-kicker">Plan</span><strong>{plan?.frequency || "Not set"}</strong><small>{plan?.exemption_type || "Fee-paying"}</small></div>
            <div className="metric-card"><span className="metric-kicker">Paid</span><strong>{money(balance?.total_paid)}</strong><small>Total feeding credit purchased</small></div>
            <div className="metric-card"><span className="metric-kicker">Consumed</span><strong>{money(balance?.total_charged)}</strong><small>Present/late feeding days only</small></div>
            <div className="metric-card"><span className="metric-kicker">Credit balance</span><strong>{money(balance?.credit_balance)}</strong><small>Automatically carries forward</small></div>
          </div>

          {plan?.frequency === "exempt" ? (
            <div className="notice success">This student is exempt from feeding fees ({plan.exemption_type || "exemption"}).</div>
          ) : (
            <form className="card feeding-payment-form" action={recordFeedingPaymentAction}>
              <input type="hidden" name="term_id" value={termId} />
              <input type="hidden" name="student_id" value={student.id} />
              <div className="field">
                <label>Frequency</label>
                <select name="frequency" defaultValue={plan?.frequency || "daily"}>
                  <option value="daily">Daily · {money(rate?.daily_rate)}</option>
                  <option value="weekly">Weekly · {money(rate?.weekly_rate)}</option>
                  <option value="monthly">Monthly · {money(rate?.monthly_rate)}</option>
                  <option value="termly">Termly · {money(rate?.termly_rate)}</option>
                </select>
              </div>
              <div className="field">
                <label>Payment date</label>
                <input name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
              </div>
              <div className="field">
                <label>Coverage starts</label>
                <input name="coverage_start" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
              </div>
              <div className="field">
                <label>Amount override (optional)</label>
                <input name="amount" type="number" min="0.01" step="0.01" placeholder="Use configured rate" />
              </div>
              <div className="field">
                <label>Method</label>
                <select name="payment_method" defaultValue="Cash">
                  <option>Cash</option><option>Mobile Money</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </div>
              <div className="field">
                <label>Reference</label>
                <input name="reference" />
              </div>
              <div className="field">
                <label>Remarks</label>
                <input name="remarks" />
              </div>
              <button className="button" type="submit">Record Feeding Payment</button>
            </form>
          )}
        </>
      ) : null}

      <section className="panel-section">
        <div className="section-heading"><div><div className="eyebrow">Recent</div><h2>Feeding payments</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Receipt</th><th>Student</th><th>Frequency</th><th>Coverage</th><th>Amount</th><th>Method</th></tr></thead>
            <tbody>
              {(recent || []).map((row: any) => (
                <tr key={row.id}>
                  <td>{row.payment_date}</td><td><strong>{row.receipt_no}</strong></td><td>{fullName(row)}<small className="block-muted">{row.admission_number || "—"}</small></td>
                  <td>{row.frequency}</td><td>{row.coverage_label || "—"}</td><td>{money(row.amount)}</td><td>{row.payment_method || "—"}</td>
                </tr>
              ))}
              {!recent?.length ? <tr><td colSpan={7} className="muted">No feeding payments recorded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
