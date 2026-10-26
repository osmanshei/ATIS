import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  approvePayrollRunAction,
  markPayrollPaidAction,
  savePayrollItemAction,
} from "../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

function rows(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function manualDetailsToText(value: unknown) {
  return rows(value)
    .filter((row: any) => row?.type === "manual")
    .map((row: any) => {
      const label = String(row?.label || row?.name || "").trim();
      const amount = Number(row?.amount || 0);
      return label ? label + ": " + amount.toFixed(2) : "";
    })
    .filter(Boolean)
    .join("\n");
}

function automaticDetails(value: unknown) {
  return rows(value).filter((row: any) => row?.type !== "manual");
}

export default async function PayrollRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string; voucher?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant"]);
  const { id } = await params;
  const query = await searchParams;

  const [{ data: run }, { data: items }, { data: voucher }] = await Promise.all([
    supabase.from("payroll_run_summary").select("*").eq("id", id).maybeSingle(),
    supabase.from("payroll_item_summary").select("*").eq("payroll_run_id", id).order("full_name"),
    supabase
      .from("payment_voucher_summary")
      .select("id,voucher_no,status,amount")
      .eq("payroll_run_id", id)
      .maybeSingle(),
  ]);

  if (!run) notFound();

  const canApprove = profile.role === "admin" || profile.role === "supervisor";
  const editable = run.status === "draft";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Payroll run</div>
          <h1>{run.title}</h1>
          <p>{run.run_no} · {run.staff_count} staff · <span className="tag">{run.status}</span></p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/payroll">Back to Payroll</Link>
          <Link className="button secondary" href="/payroll/settings">Settings</Link>
          <Link className="button secondary" href="/payroll/attendance">Staff Attendance</Link>
          {voucher ? <Link className="button secondary" href={"/finance/vouchers/" + voucher.id}>Open PV</Link> : null}
        </div>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <div className="cards cards-five">
        <div className="metric-card"><span className="metric-kicker">Base pay</span><strong>{money(run.base_total)}</strong></div>
        <div className="metric-card"><span className="metric-kicker">Allowances</span><strong>{money(run.allowance_total)}</strong></div>
        <div className="metric-card"><span className="metric-kicker">Gross payroll</span><strong>{money(run.gross_total)}</strong></div>
        <div className="metric-card"><span className="metric-kicker">Deductions</span><strong>{money(run.deduction_total)}</strong></div>
        <div className="metric-card"><span className="metric-kicker">Net payroll</span><strong>{money(run.net_total)}</strong></div>
      </div>

      <section className="card payroll-actions-card">
        <h2 className="section-title">Payroll approval & payment</h2>
        <div className="action-row">
          {editable && canApprove ? (
            <form action={approvePayrollRunAction}>
              <input type="hidden" name="run_id" value={id} />
              <button className="button" type="submit">Approve Payroll</button>
            </form>
          ) : null}

          {run.status === "approved" ? (
            <form action={markPayrollPaidAction} className="payroll-pay-form">
              <input type="hidden" name="run_id" value={id} />
              <div className="field">
                <label>Payment date</label>
                <input name="pay_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
              <div className="field">
                <label>Method</label>
                <select name="payment_method" defaultValue="Bank Transfer">
                  <option>Bank Transfer</option>
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div className="field">
                <label>Reference</label>
                <input name="reference" placeholder="Optional transaction reference" />
              </div>
              <button className="button" type="submit">Mark Payroll Paid & Create PV</button>
            </form>
          ) : null}

          {run.status === "paid" ? (
            <span className="notice success">Paid {run.pay_date ? "on " + run.pay_date : ""}</span>
          ) : null}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Staff payroll</div>
            <h2>Salary details</h2>
          </div>
        </div>

        <div className="payroll-item-list">
          {(items || []).map((item: any) => {
            const autoAllowances = automaticDetails(item.allowance_details);
            const autoDeductions = automaticDetails(item.deduction_details);

            return (
              <form className="card payroll-item-form legacy-payroll-item" action={savePayrollItemAction} key={item.id}>
                <input type="hidden" name="item_id" value={item.id} />
                <input type="hidden" name="run_id" value={id} />

                <div className="payroll-person">
                  <strong>{item.full_name}</strong>
                  <small>{item.employee_code || "No employee code"} · {item.position_title || "Staff"}</small>
                  <small>{item.early_days || 0} early day(s) / {item.total_attendance || 0} attendance day(s)</small>
                  <small>{item.service_years || 0} completed service year(s)</small>
                </div>

                <div className="field">
                  <label>Base pay</label>
                  <input value={Number(item.base_salary || 0).toFixed(2)} readOnly />
                </div>

                <div className="field">
                  <label>Automatic allowances</label>
                  <input value={Number(item.automatic_allowances || 0).toFixed(2)} readOnly />
                </div>

                <div className="field">
                  <label>Other allowances</label>
                  <input name="other_allowances" type="number" min="0" step="0.01" defaultValue={Number(item.other_allowances || 0).toFixed(2)} readOnly={!editable} />
                </div>

                <div className="field">
                  <label>SSNIT / Statutory</label>
                  <input value={Number(item.ssnit_deduction || 0).toFixed(2)} readOnly />
                </div>

                <div className="field">
                  <label>Loan deduction</label>
                  <input value={Number(item.loan_deduction || 0).toFixed(2)} readOnly />
                </div>

                <div className="field">
                  <label>Other deductions</label>
                  <input name="other_deductions" type="number" min="0" step="0.01" defaultValue={Number(item.other_deductions || 0).toFixed(2)} readOnly={!editable} />
                </div>

                <div className="payroll-net">
                  <span>Net pay</span>
                  <strong>{money(item.net_pay)}</strong>
                </div>

                <div className="payroll-auto-breakdown">
                  <strong>Automatic earnings</strong>
                  {autoAllowances.length ? autoAllowances.map((row: any, index: number) => (
                    <small key={"aa" + index}>
                      {row.name || row.label || "Allowance"}: {money(row.amount)}
                      {row.detail ? " · " + row.detail : ""}
                    </small>
                  )) : <small>No automatic allowances</small>}
                </div>

                <div className="payroll-auto-breakdown">
                  <strong>Automatic deductions</strong>
                  {autoDeductions.length ? autoDeductions.map((row: any, index: number) => (
                    <small key={"ad" + index}>
                      {row.name || row.label || "Deduction"}: {money(row.amount || row.deduction)}
                    </small>
                  )) : <small>No automatic deductions</small>}
                </div>

                {editable ? (
                  <>
                    <div className="field payroll-detail-field">
                      <label>Other allowance breakdown</label>
                      <textarea
                        name="allowance_details"
                        rows={2}
                        defaultValue={manualDetailsToText(item.allowance_details)}
                        placeholder={"Responsibility: 100.00\nTransport: 50.00"}
                      />
                      <small>Only discretionary/manual items. One per line: Name: Amount</small>
                    </div>

                    <div className="field payroll-detail-field">
                      <label>Other deduction breakdown</label>
                      <textarea
                        name="deduction_details"
                        rows={2}
                        defaultValue={manualDetailsToText(item.deduction_details)}
                        placeholder={"Advance: 50.00\nOther: 20.00"}
                      />
                      <small>Only discretionary/manual items. One per line: Name: Amount</small>
                    </div>

                    <div className="field">
                      <label>Remarks</label>
                      <input name="remarks" defaultValue={item.remarks || ""} />
                    </div>

                    <button className="button compact" type="submit">Save Adjustments</button>
                  </>
                ) : (
                  <Link className="button secondary compact" href={"/payroll/payslip/" + item.id}>Payslip</Link>
                )}
              </form>
            );
          })}
        </div>
      </section>
    </>
  );
}
