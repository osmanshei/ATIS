import Link from "next/link";
import { requireProfile } from "@/lib/auth";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant"]);
  const params = await searchParams;

  const { data: terms } = await supabase
    .from("terms")
    .select("id,name,is_current,academic_year_id,starts_on")
    .order("starts_on");

  const termId =
    params.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  const [{ data: balances }, { data: recentPayments }, { count: feeItemCount }] =
    await Promise.all([
      supabase
        .from("finance_student_summary")
        .select("student_id,net_fees,amount_paid,outstanding_balance,credit_balance")
        .eq("term_id", termId),
      supabase
        .from("fee_payment_summary")
        .select(
          "id,student_id,first_name,middle_name,last_name,class_name,section,amount,payment_date,receipt_no,payment_method,is_reversed",
        )
        .eq("term_id", termId)
        .order("payment_date", { ascending: false })
        .limit(8),
      supabase
        .from("fee_items")
        .select("id", { count: "exact", head: true })
        .eq("term_id", termId)
        .eq("is_active", true),
    ]);

  const billed = (balances || []).reduce((sum: number, r: any) => sum + Number(r.net_fees || 0), 0);
  const paid = (balances || []).reduce((sum: number, r: any) => sum + Number(r.amount_paid || 0), 0);
  const outstanding = (balances || []).reduce(
    (sum: number, r: any) => sum + Number(r.outstanding_balance || 0),
    0,
  );
  const credits = (balances || []).reduce(
    (sum: number, r: any) => sum + Number(r.credit_balance || 0),
    0,
  );
  const collectionRate = billed ? Math.round((paid / billed) * 1000) / 10 : 0;

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">Finance workspace · {profile.role}</div>
          <h1>Fees & Payments</h1>
          <p>Configure school fees, post payments, issue receipts and monitor balances from one ledger.</p>
        </div>
        <div className="hero-actions">
          <Link className="button hero-button" href={"/finance/payments?term=" + termId}>
            Record Payment
          </Link>
          <Link className="button secondary hero-secondary" href={"/finance/fees?term=" + termId}>
            Fee Setup
          </Link>
        </div>
      </section>

      <form className="term-switcher" method="get">
        <label>Term</label>
        <select name="term" defaultValue={termId}>
          {(terms || []).map((term: any) => (
            <option key={term.id} value={term.id}>
              {term.name}{term.is_current ? " · Current" : ""}
            </option>
          ))}
        </select>
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="cards cards-five">
        <div className="metric-card">
          <span className="metric-kicker">Net fees billed</span>
          <strong>{money(billed)}</strong>
          <small>{feeItemCount || 0} active fee items</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Amount collected</span>
          <strong>{money(paid)}</strong>
          <small>{collectionRate}% collection rate</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Outstanding</span>
          <strong>{money(outstanding)}</strong>
          <small>Unpaid student balances</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Credits</span>
          <strong>{money(credits)}</strong>
          <small>Student overpayments / credit</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Students billed</span>
          <strong>{balances?.length || 0}</strong>
          <small>Students with configured fee structure</small>
        </div>
      </div>

      <div className="finance-shortcuts">
        <Link className="finance-shortcut" href={"/finance/fees?term=" + termId}>
          <span>FS</span><strong>Fee Setup</strong><small>Create class fee items and due dates</small>
        </Link>
        <Link className="finance-shortcut" href={"/finance/payments?term=" + termId}>
          <span>PY</span><strong>Payments</strong><small>Post fees and print receipts</small>
        </Link>
        <Link className="finance-shortcut" href={"/finance/balances?term=" + termId}>
          <span>BL</span><strong>Balances</strong><small>Review student debt and credits</small>
        </Link>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Latest activity</div>
            <h2>Recent payments</h2>
          </div>
          <Link className="text-link" href={"/finance/payments?term=" + termId}>Open payment desk →</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Receipt</th><th>Student</th><th>Class</th><th>Method</th><th>Amount</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {(recentPayments || []).map((p: any) => {
                const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
                return (
                  <tr key={p.id}>
                    <td>{p.payment_date}</td>
                    <td><strong>{p.receipt_no}</strong></td>
                    <td>{name}</td>
                    <td>{p.class_name}{p.section ? " / " + p.section : ""}</td>
                    <td>{p.payment_method || "—"}</td>
                    <td><strong>{money(p.amount)}</strong></td>
                    <td><span className={p.is_reversed ? "tag gray" : "tag"}>{p.is_reversed ? "Reversed" : "Posted"}</span></td>
                    <td><Link className="button secondary compact" href={"/finance/receipt/" + p.id}>Receipt</Link></td>
                  </tr>
                );
              })}
              {!recentPayments?.length ? (
                <tr><td colSpan={8} className="muted">No payments recorded for this term yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
