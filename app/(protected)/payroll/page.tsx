import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createPayrollRunAction } from "./actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile([
    "admin",
    "supervisor",
    "accountant",
    "teacher",
    "clerk",
    "staff",
  ]);
  const params = await searchParams;
  const management = ["admin", "supervisor", "accountant"].includes(profile.role);

  if (!management) {
    const { data: slips, error } = await supabase
      .from("payroll_item_summary")
      .select("id,run_no,payroll_month,payroll_title,payroll_status,pay_date,base_salary,allowances,deductions,gross_pay,net_pay")
      .eq("payroll_status", "paid")
      .order("payroll_month", { ascending: false });

    return (
      <>
        <section className="welcome-hero">
          <div>
            <div className="eyebrow">Staff self-service</div>
            <h1>My Payslips</h1>
            <p>View your salary history and print individual payslips.</p>
          </div>
        </section>

        {error ? <div className="notice error">{error.message}</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th><th>Payroll</th><th>Gross</th><th>Deductions</th><th>Net pay</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(slips || []).map((row: any) => (
                <tr key={row.id}>
                  <td>{new Date(row.payroll_month + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</td>
                  <td>{row.run_no}</td>
                  <td>{money(row.gross_pay)}</td>
                  <td>{money(row.deductions)}</td>
                  <td><strong>{money(row.net_pay)}</strong></td>
                  <td><span className="tag">{row.payroll_status}</span></td>
                  <td><Link className="button secondary compact" href={"/payroll/payslip/" + row.id}>Payslip</Link></td>
                </tr>
              ))}
              {!slips?.length ? (
                <tr><td colSpan={7} className="muted">No payslips are available yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const { data: runs, error } = await supabase
    .from("payroll_run_summary")
    .select("id,run_no,payroll_month,title,status,pay_date,staff_count,base_total,allowance_total,deduction_total,gross_total,net_total")
    .order("payroll_month", { ascending: false });

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">Payroll workspace · {profile.role}</div>
          <h1>Payroll & Payslips</h1>
          <p>Generate monthly payroll from staff categories and payroll profiles, apply automatic allowances and loans, approve payment and print payslips.</p>
        </div>
        <div className="hero-actions">
          <Link className="button hero-button" href="/payroll/settings">Payroll Settings</Link>
          {["admin", "supervisor"].includes(profile.role) ? (
            <Link className="button secondary hero-secondary" href="/payroll/attendance">Device Attendance</Link>
          ) : null}
          <Link className="button secondary hero-secondary" href="/finance/vouchers">Payment Vouchers</Link>
        </div>
      </section>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}

      <section className="card payroll-create-card">
        <h2 className="section-title">Create monthly payroll</h2>
        <form action={createPayrollRunAction} className="payroll-create-form">
          <div className="field">
            <label>Payroll month</label>
            <input name="payroll_month" type="month" defaultValue={currentMonth()} required />
          </div>
          <div className="field">
            <label>Notes</label>
            <input name="notes" placeholder="Optional payroll note" />
          </div>
          <button className="button" type="submit">Generate Payroll</button>
        </form>
        <p className="muted">Base pay comes from each staff member's payroll category/profile. Early attendance, long service, assigned allowances, statutory deductions and active loans are calculated automatically.</p>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th><th>Run No.</th><th>Staff</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Employer SSNIT</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(runs || []).map((row: any) => (
              <tr key={row.id}>
                <td>{new Date(row.payroll_month + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</td>
                <td><strong>{row.run_no}</strong></td>
                <td>{row.staff_count}</td>
                <td>{money(row.gross_total)}</td>
                <td>{money(row.deduction_total)}</td>
                <td><strong>{money(row.net_total)}</strong></td>
                <td>{money(row.employer_ssnit_total)}</td>
                <td><span className="tag">{row.status}</span></td>
                <td><Link className="button secondary compact" href={"/payroll/" + row.id}>Open</Link></td>
              </tr>
            ))}
            {!runs?.length ? (
              <tr><td colSpan={9} className="muted">No payroll runs have been created yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
