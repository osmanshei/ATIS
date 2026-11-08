import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { reverseFeePaymentAction } from "../../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function FeeReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { paymentId } = await params;
  const query = await searchParams;
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant"]);

  const [{ data: payment }, { data: school }] = await Promise.all([
    supabase.from("fee_payment_summary").select("*").eq("id", paymentId).single(),
    supabase
      .from("schools")
      .select("name,short_name,address,phone,email,logo_url")
      .eq("id", profile.school_id)
      .single(),
  ]);

  if (!payment) notFound();

  const [{ data: balance }, { data: historicalArrears, error: historicalArrearsError }] = await Promise.all([
    supabase
      .from("finance_student_summary")
      .select("net_fees,amount_paid,outstanding_balance,credit_balance")
      .eq("student_id", payment.student_id)
      .eq("term_id", payment.term_id)
      .maybeSingle(),
    supabase
      .from("student_fee_arrears_summary")
      .select("original_arrears_amount,arrears_paid,remaining_arrears")
      .eq("student_id", payment.student_id)
      .maybeSingle(),
  ]);

  const studentName = [payment.first_name, payment.middle_name, payment.last_name]
    .filter(Boolean)
    .join(" ");
  const classLabel = payment.class_name + (payment.section ? " / " + payment.section : "");
  const previousArrears = Number(historicalArrears?.remaining_arrears || 0);
  const currentTermOutstanding = Number(balance?.outstanding_balance || 0);
  const combinedOutstanding = previousArrears + currentTermOutstanding;

  return (
    <>
      <div className="report-toolbar no-print">
        <Link className="button secondary" href={"/finance/student/" + payment.student_id + "?term=" + payment.term_id}>
          Back to statement
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      {query.ok ? <div className="notice success no-print">{query.ok}</div> : null}
      {query.error ? <div className="notice error no-print">{query.error}</div> : null}
      {historicalArrearsError ? <div className="notice error no-print">Historical arrears could not be loaded. The combined amount due may be incomplete until database migration 0023 is applied in Supabase.</div> : null}

      <div className="fee-receipt">
        {payment.is_reversed ? <div className="receipt-watermark">REVERSED</div> : null}
        <header className="receipt-header">
          <Image src={school?.logo_url || "/atis-logo.svg"} alt={school?.short_name || "School logo"} width={62} height={62} unoptimized />
          <div>
            <h1>{school?.name || "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL"}</h1>
            <p>{school?.address || "Bimbilla, Northern Region - Ghana"}</p>
            <p>{[school?.phone, school?.email].filter(Boolean).join(" · ")}</p>
            <h2>OFFICIAL FEE RECEIPT</h2>
          </div>
        </header>

        <div className="receipt-number">
          <span>Receipt No.</span><strong>{payment.receipt_no}</strong>
          <span>Date</span><strong>{payment.payment_date}</strong>
        </div>

        <section className="receipt-party">
          <div><span>Received From</span><strong>{studentName}</strong></div>
          <div><span>Admission No.</span><strong>{payment.admission_number || "—"}</strong></div>
          <div><span>Class</span><strong>{classLabel}</strong></div>
          <div><span>Term</span><strong>{payment.term_name}</strong></div>
        </section>

        <section className="receipt-payment">
          <div><span>Payment For</span><strong>{payment.fee_name || "School Fees"}</strong></div>
          <div><span>Payment Method</span><strong>{payment.payment_method ? String(payment.payment_method).replaceAll("_", " ") : "—"}</strong></div>
          <div><span>Reference</span><strong>{payment.reference || "—"}</strong></div>
          <div className="receipt-amount"><span>Amount Received</span><strong>{money(payment.amount)}</strong></div>
        </section>

        <section className="receipt-balance">
          <div><span>Applied to previous arrears</span><strong>{money(payment.arrears_amount_applied)}</strong></div>
          <div><span>Applied to current-term fees</span><strong>{money(payment.term_amount_applied)}</strong></div>
        </section>

        <section className="receipt-balance">
          <div><span>Previous arrears remaining</span><strong>{money(previousArrears)}</strong></div>
          <div><span>Current-term outstanding</span><strong>{money(currentTermOutstanding)}</strong></div>
          <div><span>Combined amount due</span><strong>{money(combinedOutstanding)}</strong></div>
          <div><span>Current-term credit</span><strong>{balance && Number(balance.credit_balance || 0) > 0 ? money(balance.credit_balance) : "—"}</strong></div>
        </section>

        {payment.remarks ? <p className="receipt-note"><strong>Remarks:</strong> {payment.remarks}</p> : null}
        {payment.is_reversed ? <p className="receipt-reversal"><strong>Reversal reason:</strong> {payment.reversal_reason}. The original allocation shown above has been reversed and the amounts restored to the student's balance.</p> : null}

        <footer className="receipt-footer">
          <div><span></span><strong>Cashier / Accountant</strong></div>
          <p>Thank you. This receipt was generated by ATIS School Management.</p>
        </footer>
      </div>

      {!payment.is_reversed ? (
        <form className="form-card no-print receipt-reversal-form" action={reverseFeePaymentAction}>
          <h2 className="section-title">Reverse this payment</h2>
          <p className="muted">Use reversal only for an incorrect payment. The original receipt remains in the audit trail.</p>
          <input type="hidden" name="payment_id" value={paymentId} />
          <div className="field"><label>Reason</label><textarea name="reason" rows={2} required /></div>
          <button className="button danger-button" type="submit">Reverse Payment</button>
        </form>
      ) : null}
    </>
  );
}
