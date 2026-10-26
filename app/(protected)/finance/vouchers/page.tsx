import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createVoucherAction } from "@/app/(protected)/payroll/actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function PaymentVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant"]);
  const params = await searchParams;

  const { data: vouchers, error } = await supabase
    .from("payment_voucher_summary")
    .select("id,voucher_no,voucher_date,payee,category,description,amount,status,payroll_run_no")
    .order("voucher_date", { ascending: false })
    .limit(200);

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">Finance workspace · {profile.role}</div>
          <h1>Payment Vouchers (PV)</h1>
          <p>Prepare, approve, pay and print official payment vouchers for school expenditure.</p>
        </div>
        <div className="hero-actions">
          <Link className="button secondary hero-secondary" href="/finance">Finance</Link>
          <Link className="button secondary hero-secondary" href="/payroll">Payroll</Link>
        </div>
      </section>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}

      <section className="card voucher-create-card">
        <h2 className="section-title">New payment voucher</h2>
        <form action={createVoucherAction} className="voucher-create-grid">
          <div className="field">
            <label>Date</label>
            <input name="voucher_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required />
          </div>
          <div className="field">
            <label>Payee</label>
            <input name="payee" required placeholder="Person, supplier or organization" />
          </div>
          <div className="field">
            <label>Category</label>
            <select name="category" defaultValue="other">
              <option value="salary">Salary</option>
              <option value="feeding">Feeding</option>
              <option value="supplies">Supplies</option>
              <option value="utilities">Utilities</option>
              <option value="maintenance">Maintenance</option>
              <option value="transport">Transport</option>
              <option value="refund">Refund</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field">
            <label>Amount</label>
            <input name="amount" type="number" min="0" step="0.01" required />
          </div>
          <div className="field span-2">
            <label>Description / Purpose</label>
            <input name="description" required placeholder="Purpose of payment" />
          </div>
          <div className="field">
            <label>Payment method</label>
            <select name="payment_method" defaultValue="">
              <option value="">Not yet paid</option>
              <option>Bank Transfer</option>
              <option>Cash</option>
              <option>Mobile Money</option>
              <option>Cheque</option>
            </select>
          </div>
          <div className="field">
            <label>Reference</label>
            <input name="reference" placeholder="Optional reference" />
          </div>
          <div className="field span-2">
            <label>Notes</label>
            <input name="notes" placeholder="Optional notes" />
          </div>
          <button className="button" type="submit">Create PV</button>
        </form>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>PV No.</th><th>Payee</th><th>Category</th><th>Description</th><th>Amount</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(vouchers || []).map((row: any) => (
              <tr key={row.id}>
                <td>{row.voucher_date}</td>
                <td><strong>{row.voucher_no}</strong></td>
                <td>{row.payee}</td>
                <td><span className="tag">{row.category}</span></td>
                <td>{row.description}{row.payroll_run_no ? <small className="block-muted"> · {row.payroll_run_no}</small> : null}</td>
                <td><strong>{money(row.amount)}</strong></td>
                <td><span className="tag">{row.status}</span></td>
                <td><Link className="button secondary compact" href={"/finance/vouchers/" + row.id}>Open</Link></td>
              </tr>
            ))}
            {!vouchers?.length ? (
              <tr><td colSpan={8} className="muted">No payment vouchers have been created yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
