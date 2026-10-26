import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import {
  approveVoucherAction,
  markVoucherPaidAction,
} from "@/app/(protected)/payroll/actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function PaymentVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant"]);
  const { id } = await params;
  const query = await searchParams;

  const [{ data: voucher }, { data: school }] = await Promise.all([
    supabase.from("payment_voucher_summary").select("*").eq("id", id).maybeSingle(),
    supabase.from("schools").select("name,short_name,address,city,region,phone,email").limit(1).maybeSingle(),
  ]);

  if (!voucher) notFound();

  const canApprove = profile.role === "admin" || profile.role === "supervisor";

  return (
    <>
      <div className="no-print">
        <div className="page-head">
          <div>
            <div className="eyebrow">Payment voucher</div>
            <h1>{voucher.voucher_no}</h1>
            <p>{voucher.status} · {voucher.category}</p>
          </div>
          <div className="action-row">
            <Link className="button secondary" href="/finance/vouchers">Back to PVs</Link>
            <PrintButton label="Print PV" />
          </div>
        </div>
        {query.ok ? <div className="notice success">{query.ok}</div> : null}
        {query.error ? <div className="notice error">{query.error}</div> : null}

        <div className="action-row voucher-status-actions">
          {voucher.status === "draft" && canApprove ? (
            <form action={approveVoucherAction}>
              <input type="hidden" name="voucher_id" value={voucher.id} />
              <button className="button" type="submit">Approve PV</button>
            </form>
          ) : null}

          {voucher.status === "approved" ? (
            <form action={markVoucherPaidAction} className="voucher-pay-form">
              <input type="hidden" name="voucher_id" value={voucher.id} />
              <div className="field">
                <label>Payment method</label>
                <select name="payment_method" defaultValue={voucher.payment_method || "Bank Transfer"}>
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div className="field">
                <label>Reference</label>
                <input name="reference" defaultValue={voucher.reference || ""} />
              </div>
              <button className="button" type="submit">Mark Paid</button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="print-document voucher-sheet">
        <header className="document-header">
          <h1>{school?.name || "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL"}</h1>
          <p>{[school?.address, school?.city, school?.region].filter(Boolean).join(", ")}</p>
          <h2>PAYMENT VOUCHER</h2>
        </header>

        <div className="voucher-number-row">
          <div><span>PV No.</span><strong>{voucher.voucher_no}</strong></div>
          <div><span>Date</span><strong>{voucher.voucher_date}</strong></div>
          <div><span>Status</span><strong>{voucher.status.toUpperCase()}</strong></div>
        </div>

        <table className="document-table voucher-table">
          <tbody>
            <tr><th>Payee</th><td>{voucher.payee}</td></tr>
            <tr><th>Category</th><td>{voucher.category}</td></tr>
            <tr><th>Purpose</th><td>{voucher.description}</td></tr>
            <tr><th>Amount</th><td><strong>{money(voucher.amount)}</strong></td></tr>
            <tr><th>Payment Method</th><td>{voucher.payment_method || "—"}</td></tr>
            <tr><th>Reference</th><td>{voucher.reference || "—"}</td></tr>
            {voucher.payroll_run_no ? <tr><th>Payroll Run</th><td>{voucher.payroll_run_no}</td></tr> : null}
            {voucher.notes ? <tr><th>Notes</th><td>{voucher.notes}</td></tr> : null}
          </tbody>
        </table>

        <div className="signature-grid">
          <div><span>Prepared by</span><div className="signature-line"></div></div>
          <div><span>Checked / Approved by</span><div className="signature-line"></div></div>
          <div><span>Received by</span><div className="signature-line"></div></div>
        </div>
      </div>
    </>
  );
}
