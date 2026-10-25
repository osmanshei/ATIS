import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { recordFeePaymentAction } from "../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

function cleanSearch(value: string) {
  return value.replace(/[,%_()]/g, " ").replace(/\s+/g, " ").trim();
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    term?: string;
    student?: string;
    q?: string;
    class?: string;
    error?: string;
  }>;
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
  const selectedStudentId = params.student || "";
  const searchText = cleanSearch(params.q || "");
  const searchClassId = params.class || "";

  let searchResults: any[] = [];

  if (!selectedStudentId && (searchText.length >= 2 || searchClassId)) {
    let studentQuery = supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name,class_id")
      .eq("status", "active")
      .limit(20);

    if (searchClassId) studentQuery = studentQuery.eq("class_id", searchClassId);

    const tokens = searchText.split(" ").filter(Boolean).slice(0, 3);
    for (const token of tokens) {
      studentQuery = studentQuery.or(
        "admission_number.ilike.%" +
          token +
          "%,first_name.ilike.%" +
          token +
          "%,middle_name.ilike.%" +
          token +
          "%,last_name.ilike.%" +
          token +
          "%",
      );
    }

    const { data } = await studentQuery.order("first_name").order("last_name");
    searchResults = data || [];
  }

  const selectedStudentResult = selectedStudentId
    ? await supabase
        .from("students")
        .select("id,admission_number,first_name,middle_name,last_name,class_id")
        .eq("id", selectedStudentId)
        .eq("status", "active")
        .maybeSingle()
    : { data: null as any };

  const selectedStudent = selectedStudentResult.data;

  const [balanceResult, feeItemsResult, recentPaymentsResult] = await Promise.all([
    selectedStudent
      ? supabase
          .from("finance_student_summary")
          .select("student_id,class_id,class_name,section,net_fees,amount_paid,outstanding_balance,credit_balance")
          .eq("term_id", termId)
          .eq("student_id", selectedStudent.id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
    selectedStudent
      ? supabase
          .from("fee_items")
          .select("id,class_id,applies_to_all_students,fee_name,amount")
          .eq("term_id", termId)
          .eq("is_active", true)
          .order("fee_name")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("fee_payment_summary")
      .select("id,student_id,first_name,middle_name,last_name,amount,payment_date,receipt_no,is_reversed")
      .eq("term_id", termId)
      .order("payment_date", { ascending: false })
      .limit(12),
  ]);

  const balance = balanceResult.data as any;
  const applicableItems = selectedStudent
    ? (feeItemsResult.data || []).filter(
        (f: any) => f.applies_to_all_students || f.class_id === selectedStudent.class_id,
      )
    : [];
  const recentPayments = recentPaymentsResult.data || [];
  const classMap = new Map((classes || []).map((c: any) => [c.id, c]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · cashier</div>
          <h1>Record Payment</h1>
          <p>Find a learner quickly, post a payment and generate an ATIS receipt automatically.</p>
        </div>
        <Link className="button secondary" href={"/finance?term=" + termId}>Back to finance</Link>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}

      <div className="grid-2">
        <section className="form-card">
          <h2 className="section-title">Find student</h2>
          <form method="get" className="student-search-form">
            <div className="field">
              <label>Term</label>
              <select name="term" defaultValue={termId}>
                {(terms || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.is_current ? " · Current" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Name or Admission Number</label>
              <input
                name="q"
                defaultValue={searchText}
                placeholder="e.g. Abdul Ganiu or 065/24B"
                autoFocus={!selectedStudent}
              />
            </div>

            <div className="field">
              <label>Class (optional)</label>
              <select name="class" defaultValue={searchClassId}>
                <option value="">All classes</option>
                {(classes || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}{c.section ? " / " + c.section : ""}
                  </option>
                ))}
              </select>
            </div>

            <button className="button" type="submit">Search Students</button>
          </form>

          {!selectedStudent && !searchResults.length && (searchText || searchClassId) ? (
            <div className="search-empty">No matching active students found.</div>
          ) : null}

          {!selectedStudent && searchResults.length ? (
            <div className="student-search-results">
              {searchResults.map((s: any) => {
                const name = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
                const cls = classMap.get(s.class_id) as any;
                const href =
                  "/finance/payments?term=" +
                  encodeURIComponent(termId) +
                  "&student=" +
                  encodeURIComponent(s.id) +
                  (searchText ? "&q=" + encodeURIComponent(searchText) : "") +
                  (searchClassId ? "&class=" + encodeURIComponent(searchClassId) : "");
                return (
                  <Link className="student-search-result" key={s.id} href={href}>
                    <div>
                      <strong>{name}</strong>
                      <small>{s.admission_number || "No admission number"}</small>
                    </div>
                    <span>{cls?.class_name || "—"}{cls?.section ? " / " + cls.section : ""}</span>
                  </Link>
                );
              })}
              {searchResults.length === 20 ? (
                <p className="muted search-hint">Showing the first 20 matches. Add more letters or choose a class to narrow the list.</p>
              ) : null}
            </div>
          ) : null}

          {selectedStudent ? (
            <div className="selected-student-card">
              <div>
                <span className="metric-kicker">Selected student</span>
                <strong>
                  {[selectedStudent.first_name, selectedStudent.middle_name, selectedStudent.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </strong>
                <small>
                  {selectedStudent.admission_number || "No admission number"} ·{" "}
                  {(classMap.get(selectedStudent.class_id) as any)?.class_name || "—"}
                  {(classMap.get(selectedStudent.class_id) as any)?.section
                    ? " / " + (classMap.get(selectedStudent.class_id) as any).section
                    : ""}
                </small>
              </div>
              <Link className="button secondary compact" href={"/finance/payments?term=" + termId}>
                Change Student
              </Link>
            </div>
          ) : null}
        </section>

        {selectedStudent ? (
          <form className="form-card" action={recordFeePaymentAction}>
            <h2 className="section-title">Post payment</h2>
            <input type="hidden" name="student_id" value={selectedStudent.id} />
            <input type="hidden" name="term_id" value={termId} />

            <div className="payment-balance-card">
              <span>Current outstanding</span>
              <strong>{balance ? money(balance.outstanding_balance) : "Fees not configured"}</strong>
              {balance ? <small>Paid {money(balance.amount_paid)} of {money(balance.net_fees)}</small> : null}
            </div>

            <div className="field">
              <label>Fee item (optional)</label>
              <select name="fee_item_id">
                <option value="">General fee payment</option>
                {applicableItems.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.fee_name} · {money(f.amount)}
                    {f.applies_to_all_students ? " · All Students" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Amount (GHS)</label>
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              <div className="field">
                <label>Payment method</label>
                <select name="payment_method" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Reference</label>
              <input name="reference" placeholder="MoMo / bank / cheque reference" />
            </div>
            <div className="field">
              <label>Remarks</label>
              <textarea name="remarks" rows={2} />
            </div>
            <button className="button" type="submit">Post Payment & Generate Receipt</button>
          </form>
        ) : (
          <section className="card">
            <div className="eyebrow">Payment account</div>
            <h2 className="section-title">Search and select a student</h2>
            <p className="muted">
              Search by admission number or any part of the learner's name. You can also narrow the search by class.
            </p>
          </section>
        )}
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Recent</div><h2>Payment activity</h2></div>
          <Link className="text-link" href={"/finance/balances?term=" + termId}>View balances →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Receipt</th><th>Student</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {recentPayments.map((p: any) => {
                const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
                return (
                  <tr key={p.id}>
                    <td>{p.payment_date}</td>
                    <td><strong>{p.receipt_no}</strong></td>
                    <td>{name}</td>
                    <td>{money(p.amount)}</td>
                    <td><span className={p.is_reversed ? "tag gray" : "tag"}>{p.is_reversed ? "Reversed" : "Posted"}</span></td>
                    <td><Link className="button secondary compact" href={"/finance/receipt/" + p.id}>Receipt</Link></td>
                  </tr>
                );
              })}
              {!recentPayments.length ? <tr><td colSpan={6} className="muted">No payments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
