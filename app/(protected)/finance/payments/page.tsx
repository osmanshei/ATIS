import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { recordFeePaymentAction } from "../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; student?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const params = await searchParams;

  const [{ data: terms }, { data: students }] = await Promise.all([
    supabase.from("terms").select("id,name,is_current,starts_on").order("starts_on"),
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name,class_id")
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
  ]);

  const termId =
    params.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";
  const selectedStudentId = params.student || "";

  const [{ data: balances }, { data: feeItems }, { data: recentPayments }] = await Promise.all([
    supabase
      .from("finance_student_summary")
      .select("student_id,class_id,class_name,section,net_fees,amount_paid,outstanding_balance,credit_balance")
      .eq("term_id", termId),
    supabase
      .from("fee_items")
      .select("id,class_id,fee_name,amount")
      .eq("term_id", termId)
      .eq("is_active", true)
      .order("fee_name"),
    supabase
      .from("fee_payment_summary")
      .select("id,student_id,first_name,middle_name,last_name,amount,payment_date,receipt_no,is_reversed")
      .eq("term_id", termId)
      .order("payment_date", { ascending: false })
      .limit(12),
  ]);

  const balanceMap = new Map((balances || []).map((b: any) => [b.student_id, b]));
  const selectedStudent = (students || []).find((s: any) => s.id === selectedStudentId);
  const applicableItems = selectedStudent
    ? (feeItems || []).filter((f: any) => f.class_id === selectedStudent.class_id)
    : [];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · cashier</div>
          <h1>Record Payment</h1>
          <p>Post a student payment and generate an ATIS receipt automatically.</p>
        </div>
        <Link className="button secondary" href={"/finance?term=" + termId}>Back to finance</Link>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}

      <div className="grid-2">
        <form className="form-card" method="get">
          <h2 className="section-title">Choose student</h2>
          <div className="field">
            <label>Term</label>
            <select name="term" defaultValue={termId}>
              {(terms || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? " · Current" : ""}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Student</label>
            <select name="student" defaultValue={selectedStudentId} required>
              <option value="">Choose student...</option>
              {(students || []).map((s: any) => {
                const name = [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
                return <option key={s.id} value={s.id}>{name} · {s.admission_number || "No admission no."}</option>;
              })}
            </select>
          </div>
          <button className="button secondary" type="submit">Load account</button>
        </form>

        {selectedStudent ? (
          <form className="form-card" action={recordFeePaymentAction}>
            <h2 className="section-title">Post payment</h2>
            <input type="hidden" name="student_id" value={selectedStudent.id} />
            <input type="hidden" name="term_id" value={termId} />
            {(() => {
              const b = balanceMap.get(selectedStudent.id) as any;
              return (
                <div className="payment-balance-card">
                  <span>Current outstanding</span>
                  <strong>{b ? money(b.outstanding_balance) : "Fees not configured"}</strong>
                  {b ? <small>Paid {money(b.amount_paid)} of {money(b.net_fees)}</small> : null}
                </div>
              );
            })()}
            <div className="field">
              <label>Fee item (optional)</label>
              <select name="fee_item_id">
                <option value="">General fee payment</option>
                {applicableItems.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.fee_name} · {money(f.amount)}</option>
                ))}
              </select>
            </div>
            <div className="form-grid">
              <div className="field"><label>Amount (GHS)</label><input name="amount" type="number" min="0.01" step="0.01" required /></div>
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
            <div className="field"><label>Reference</label><input name="reference" placeholder="MoMo / bank / cheque reference" /></div>
            <div className="field"><label>Remarks</label><textarea name="remarks" rows={2} /></div>
            <button className="button" type="submit">Post Payment & Generate Receipt</button>
          </form>
        ) : (
          <section className="card">
            <div className="eyebrow">Payment account</div>
            <h2 className="section-title">Select a student to continue</h2>
            <p className="muted">The current balance and applicable class fee items will appear here.</p>
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
              {(recentPayments || []).map((p: any) => {
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
              {!recentPayments?.length ? <tr><td colSpan={6} className="muted">No payments yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
