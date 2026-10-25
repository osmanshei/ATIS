import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { saveFeeAdjustmentAction } from "../../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function StudentFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string; ok?: string; error?: string }>;
}) {
  const { studentId } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const [{ data: student }, { data: terms }] = await Promise.all([
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name,class_id,concession_percent")
      .eq("id", studentId)
      .single(),
    supabase.from("terms").select("id,name,is_current,starts_on").order("starts_on"),
  ]);

  if (!student) notFound();

  const termId =
    query.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  const [{ data: cls }, { data: balance }, { data: payments }, { data: feeItems }, { data: adjustments }] =
    await Promise.all([
      supabase
        .from("classes")
        .select("id,class_name,section")
        .eq("id", student.class_id)
        .maybeSingle(),
      supabase
        .from("finance_student_summary")
        .select("*")
        .eq("student_id", studentId)
        .eq("term_id", termId)
        .maybeSingle(),
      supabase
        .from("fee_payment_summary")
        .select("id,amount,payment_date,payment_method,receipt_no,fee_name,is_reversed,reversal_reason")
        .eq("student_id", studentId)
        .eq("term_id", termId)
        .order("payment_date", { ascending: false }),
      supabase
        .from("fee_items")
        .select("id,class_id,applies_to_all_students,fee_name,amount")
        .eq("term_id", termId)
        .eq("is_active", true)
        .order("fee_name"),
      supabase
        .from("fee_adjustments")
        .select("id,fee_item_id,adjustment_type,calculation_type,adjustment_value,reason,status,created_at")
        .eq("student_id", studentId)
        .eq("term_id", termId)
        .order("created_at", { ascending: false }),
    ]);

  const applicableFeeItems = (feeItems || []).filter(
    (f: any) => f.applies_to_all_students || f.class_id === student.class_id,
  );

  const name = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
  const classLabel = cls ? cls.class_name + (cls.section ? " / " + cls.section : "") : "—";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · student statement</div>
          <h1>{name}</h1>
          <p>{student.admission_number || "No admission number"} · {classLabel}</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/finance/balances?term=" + termId}>Back to balances</Link>
          <Link className="button" href={"/finance/payments?term=" + termId + "&student=" + studentId}>Record payment</Link>
        </div>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form className="term-switcher" method="get">
        <label>Term</label>
        <select name="term" defaultValue={termId}>
          {(terms || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? " · Current" : ""}</option>)}
        </select>
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="cards cards-five">
        <div className="metric-card"><span className="metric-kicker">Gross fees</span><strong>{balance ? money(balance.gross_fees) : "—"}</strong><small>Configured class charges</small></div>
        <div className="metric-card"><span className="metric-kicker">Concession</span><strong>{balance ? money(balance.concession_amount) : "—"}</strong><small>{Number(student.concession_percent || 0)}% student concession</small></div>
        <div className="metric-card"><span className="metric-kicker">Net fees</span><strong>{balance ? money(balance.net_fees) : "—"}</strong><small>After all adjustments</small></div>
        <div className="metric-card"><span className="metric-kicker">Paid</span><strong>{balance ? money(balance.amount_paid) : money(0)}</strong><small>Valid posted payments</small></div>
        <div className="metric-card"><span className="metric-kicker">Outstanding</span><strong>{balance ? money(balance.outstanding_balance) : "—"}</strong><small>{balance && Number(balance.credit_balance || 0) > 0 ? "Credit " + money(balance.credit_balance) : "Current balance"}</small></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="eyebrow">Payments</div>
          <h2 className="section-title">Payment history</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Receipt</th><th>Fee</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {(payments || []).map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.payment_date}</td>
                    <td><Link className="text-link" href={"/finance/receipt/" + p.id}>{p.receipt_no}</Link></td>
                    <td>{p.fee_name || "General"}</td>
                    <td>{money(p.amount)}</td>
                    <td><span className={p.is_reversed ? "tag gray" : "tag"}>{p.is_reversed ? "Reversed" : "Posted"}</span></td>
                  </tr>
                ))}
                {!payments?.length ? <tr><td colSpan={5} className="muted">No payments for this term.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <form className="form-card" action={saveFeeAdjustmentAction}>
          <h2 className="section-title">Add discount / exemption</h2>
          <input type="hidden" name="student_id" value={studentId} />
          <input type="hidden" name="term_id" value={termId} />
          <div className="field">
            <label>Adjustment type</label>
            <select name="adjustment_type" defaultValue="discount">
              <option value="discount">Discount</option>
              <option value="exemption">Full / Partial Exemption</option>
              <option value="scholarship">Scholarship</option>
              <option value="sibling">Sibling Benefit</option>
              <option value="merit">Merit Award</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label>Apply to fee item</label>
            <select name="fee_item_id">
              <option value="">Entire term bill</option>
              {applicableFeeItems.map((f: any) => <option key={f.id} value={f.id}>{f.fee_name} · {money(f.amount)}</option>)}
            </select>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Calculation</label>
              <select name="calculation_type" defaultValue="amount">
                <option value="amount">Fixed Amount</option>
                <option value="percent">Percentage</option>
              </select>
            </div>
            <div className="field"><label>Value</label><input name="adjustment_value" type="number" min="0" step="0.01" required /></div>
          </div>
          <div className="field"><label>Reason</label><textarea name="reason" rows={2} required /></div>
          <button className="button" type="submit">Save adjustment</button>
        </form>
      </div>

      <section className="panel-section">
        <div className="section-heading"><div><div className="eyebrow">Adjustments</div><h2>Discount & exemption history</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Scope</th><th>Calculation</th><th>Value</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {(adjustments || []).map((a: any) => {
                const fi = applicableFeeItems.find((f: any) => f.id === a.fee_item_id);
                return (
                  <tr key={a.id}>
                    <td>{String(a.adjustment_type).replaceAll("_", " ")}</td>
                    <td>{fi?.fee_name || "Entire term bill"}</td>
                    <td>{a.calculation_type}</td>
                    <td>{a.calculation_type === "percent" ? Number(a.adjustment_value).toFixed(2) + "%" : money(a.adjustment_value)}</td>
                    <td>{a.reason || "—"}</td>
                    <td><span className={a.status === "active" ? "tag" : "tag gray"}>{a.status}</span></td>
                  </tr>
                );
              })}
              {!adjustments?.length ? <tr><td colSpan={6} className="muted">No additional adjustments.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
