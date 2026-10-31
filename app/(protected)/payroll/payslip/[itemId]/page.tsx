import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

function rows(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { supabase, profile } = await requireProfile([
    "admin",
    "supervisor",
    "accountant",
    "teacher",
    "clerk",
    "staff",
  ]);
  const { itemId } = await params;

  const [{ data: item }, { data: school }] = await Promise.all([
    supabase.from("payroll_item_summary").select("*").eq("id", itemId).maybeSingle(),
    supabase.from("schools").select("name,short_name,address,city,region,phone,email").limit(1).maybeSingle(),
  ]);

  if (!item) notFound();

  const management = ["admin", "supervisor", "accountant"].includes(profile.role);
  if (!management && item.payroll_status !== "paid") notFound();

  return (
    <div className="print-document payslip-sheet">
      <div className="print-actions no-print">
        <PrintButton label="Print Payslip" />
      </div>

      <header className="document-header">
        <h1>{school?.name || "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL"}</h1>
        <p>{[school?.address, school?.city, school?.region].filter(Boolean).join(", ")}</p>
        <h2>STAFF PAYSLIP</h2>
      </header>

      <div className="document-meta-grid">
        <div><span>Staff Name</span><strong>{item.full_name}</strong></div>
        <div><span>Employee Code</span><strong>{item.employee_code || "—"}</strong></div>
        <div><span>Position</span><strong>{item.position_title || "—"}</strong></div>
        <div><span>Payroll Month</span><strong>{new Date(item.payroll_month + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong></div>
        <div><span>Payroll No.</span><strong>{item.run_no}</strong></div>
        <div><span>Payment Date</span><strong>{item.pay_date || "—"}</strong></div>
        <div><span>Early Attendance</span><strong>{item.early_days || 0} qualifying / {item.total_attendance || 0} present days (15 required)</strong></div>
        <div><span>Service</span><strong>{item.service_years || 0} completed year(s)</strong></div>
      </div>

      <table className="document-table">
        <thead><tr><th>Earnings</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td>{money(item.base_salary)}</td></tr>
          {rows(item.allowance_details).map((row: any, index: number) => (
            <tr key={"a" + index}><td>{row.name || row.label || "Allowance"}{row.detail ? " · " + row.detail : ""}</td><td>{money(row.amount)}</td></tr>
          ))}
          <tr><td><strong>Total Allowances</strong></td><td><strong>{money(item.allowances)}</strong></td></tr>
          <tr><td><strong>Gross Pay</strong></td><td><strong>{money(item.gross_pay)}</strong></td></tr>
        </tbody>
      </table>

      <table className="document-table">
        <thead><tr><th>Deductions</th><th>Amount</th></tr></thead>
        <tbody>
          {rows(item.deduction_details).map((row: any, index: number) => (
            <tr key={"d" + index}><td>{row.name || row.label || "Deduction"}</td><td>{money(row.amount ?? row.deduction)}</td></tr>
          ))}
          {!rows(item.deduction_details).length ? <tr><td>No itemized deductions</td><td>{money(0)}</td></tr> : null}
          <tr><td><strong>Total Deductions</strong></td><td><strong>{money(item.deductions)}</strong></td></tr>
        </tbody>
      </table>

      <table className="document-table">
        <thead><tr><th>Employer contribution (not deducted from employee pay)</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>Employer SSNIT contribution</td><td>{money(item.employer_ssnit_contribution)}</td></tr>
        </tbody>
      </table>

      <div className="payslip-net">
        <span>NET PAY</span>
        <strong>{money(item.net_pay)}</strong>
      </div>

      {item.remarks ? <p className="document-note"><strong>Remarks:</strong> {item.remarks}</p> : null}

      <footer className="document-footer">
        <p>This payslip is generated from the ATIS payroll system.</p>
      </footer>
    </div>
  );
}
