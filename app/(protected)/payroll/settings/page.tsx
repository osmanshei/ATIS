import { requireProfile } from "@/lib/auth";
import {
  createStaffLoanAction,
  savePayrollAllowanceTypeAction,
  savePayrollCategoryAction,
  savePayrollProfileAction,
  savePayrollSettingAction,
  saveStaffAllowanceAction,
} from "../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function PayrollSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant"]);
  const params = await searchParams;
  const canConfigure = profile.role === "admin" || profile.role === "supervisor";

  const [
    { data: settings },
    { data: categories },
    { data: profiles },
    { data: staff },
    { data: allowanceTypes },
    { data: staffAllowances },
    { data: loans },
  ] = await Promise.all([
    supabase.from("payroll_settings").select("*").order("key"),
    supabase.from("payroll_categories").select("*").order("category_name"),
    supabase.from("payroll_profile_summary").select("*").order("full_name"),
    supabase.from("payroll_staff_directory").select("id,full_name,employee_code,position_title").order("full_name"),
    supabase.from("payroll_allowance_types").select("*").order("name"),
    supabase.from("staff_allowances").select("id,staff_id,allowance_type_id,amount,active,effective_from,effective_to,notes").eq("active",true).order("created_at",{ascending:false}).limit(100),
    supabase.from("staff_loans").select("id,staff_id,loan_name,principal,monthly_deduction,amount_paid,balance,start_month,status").order("created_at",{ascending:false}).limit(100),
  ]);

  const staffMap = new Map((staff || []).map((s: any) => [s.id, s]));
  const typeMap = new Map((allowanceTypes || []).map((a: any) => [a.id, a]));
  const visibleSettings = (settings || []).filter((row: any) => row.key !== "EMPLOYEE_SSNIT_RATE");
  const settingLabels: Record<string, string> = {
    SSNIT_FIXED_AMOUNT: "Monthly SSNIT amount (GHS)",
    EARLY_ALLOWANCE_MIN_DAYS: "Minimum early-attendance days",
    EARLY_ALLOWANCE_AMOUNT: "Early-attendance allowance (GHS)",
    RETENTION_BONUS_PER_YEAR: "Long-service allowance per completed year (GHS)",
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Payroll configuration</div>
          <h1>Categories, Allowances & Loans</h1>
          <p>Maintain base pay by staff category, automatic allowance rules, staff-specific allowances and loan servicing.</p>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Automatic rules</div><h2>Payroll settings</h2><p className="muted">SSNIT is a fixed monthly amount, not a percentage of basic salary. The employer contribution matches the employee deduction.</p></div>
        </div>
        <div className="payroll-settings-grid">
          {visibleSettings.map((row: any) => (
            <form className="card payroll-setting-card" action={savePayrollSettingAction} key={row.key}>
              <input type="hidden" name="key" value={row.key} />
              <input type="hidden" name="description" value={row.description || ""} />
              <strong>{settingLabels[row.key] || row.key.replaceAll("_"," ")}</strong>
              <p>{row.description || "Payroll setting"}{row.key === "SSNIT_FIXED_AMOUNT" ? " This same fixed amount is recorded as the employee deduction and employer contribution; the employer share is not deducted from net pay." : ""}</p>
              <div className="field">
                <label>Value</label>
                <input name="setting_value" type="number" min="0" step="0.01" defaultValue={row.value} readOnly={!canConfigure} />
              </div>
              {canConfigure ? <button className="button compact" type="submit">Save</button> : null}
            </form>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Base pay</div><h2>Staff categories</h2></div>
        </div>

        {canConfigure ? (
          <form className="card payroll-category-form" action={savePayrollCategoryAction}>
            <div className="field"><label>Category</label><input name="category_name" placeholder="e.g. Teacher, Cook, Clerk" required /></div>
            <div className="field"><label>Base pay</label><input name="base_pay" type="number" min="0" step="0.01" required /></div>
            <div className="field"><label>Notes</label><input name="notes" /></div>
            <button className="button" type="submit">Save Category</button>
          </form>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Category</th><th>Base Pay</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {(categories || []).map((row: any) => (
                <tr key={row.id}>
                  <td><strong>{row.category_name}</strong></td>
                  <td>{money(row.base_pay)}</td>
                  <td><span className="tag">{row.active ? "Active" : "Inactive"}</span></td>
                  <td>{row.notes || "—"}</td>
                </tr>
              ))}
              {!categories?.length ? <tr><td colSpan={4} className="muted">No payroll categories configured.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Staff setup</div><h2>Payroll profiles</h2></div>
        </div>
        {canConfigure ? (
          <form className="card payroll-category-form" action={savePayrollProfileAction}>
            <div className="field">
              <label>Add / update staff</label>
              <select name="staff_id" required defaultValue="">
                <option value="" disabled>Select staff</option>
                {(staff || []).map((s: any) => (
                  <option key={s.id} value={s.id}>{s.full_name} · {s.employee_code || s.position_title || "Staff"}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select name="category_id" required defaultValue="">
                <option value="" disabled>Select category</option>
                {(categories || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.category_name} · {money(cat.base_pay)}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Base override</label><input name="base_pay_override" type="number" min="0" step="0.01" /></div>
            <label className="compact-check"><input name="ssnit_enabled" type="checkbox" defaultChecked /> SSNIT (GHS 80 employee deduction + GHS 80 employer contribution)</label>
            <label className="compact-check"><input name="early_allowance_eligible" type="checkbox" defaultChecked /> Early allowance</label>
            <label className="compact-check"><input name="long_service_eligible" type="checkbox" defaultChecked /> Long service</label>
            <input type="hidden" name="notes" value="" />
            <button className="button" type="submit">Save Payroll Profile</button>
          </form>
        ) : null}

        <div className="payroll-profile-list">
          {(profiles || []).map((row: any) => (
            <form className="card payroll-profile-row" action={savePayrollProfileAction} key={row.id}>
              <input type="hidden" name="staff_id" value={row.staff_id} />
              <div className="payroll-person">
                <strong>{row.full_name}</strong>
                <small>{row.employee_code || "—"} · {row.position_title || "Staff"}</small>
                <small>Effective base: {money(row.effective_base_pay)}</small>
              </div>
              <div className="field">
                <label>Category</label>
                <select name="category_id" defaultValue={row.category_id || ""} disabled={!canConfigure}>
                  <option value="">No category</option>
                  {(categories || []).map((cat: any) => <option key={cat.id} value={cat.id}>{cat.category_name} · {money(cat.base_pay)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Base pay override</label>
                <input name="base_pay_override" type="number" min="0" step="0.01" defaultValue={row.base_pay_override ?? ""} readOnly={!canConfigure} />
              </div>
              <label className="compact-check"><input name="ssnit_enabled" type="checkbox" defaultChecked={row.ssnit_enabled} disabled={!canConfigure} /> SSNIT (fixed amount)</label>
              <label className="compact-check"><input name="early_allowance_eligible" type="checkbox" defaultChecked={row.early_allowance_eligible} disabled={!canConfigure} /> Early allowance</label>
              <label className="compact-check"><input name="long_service_eligible" type="checkbox" defaultChecked={row.long_service_eligible} disabled={!canConfigure} /> Long service</label>
              <input type="hidden" name="notes" value={row.notes || ""} />
              {canConfigure ? <button className="button compact" type="submit">Save</button> : null}
            </form>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Allowances</div><h2>Allowance types & assignments</h2></div>
        </div>

        {canConfigure ? (
          <div className="grid-2">
            <form className="card" action={savePayrollAllowanceTypeAction}>
              <h3 className="section-title">Create allowance type</h3>
              <div className="field"><label>Name</label><input name="name" required /></div>
              <div className="field">
                <label>Calculation</label>
                <select name="calculation_type" defaultValue="fixed">
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage_base">Percentage of base pay</option>
                  <option value="system_early">Automatic early attendance</option>
                  <option value="system_long_service">Automatic long service</option>
                </select>
              </div>
              <div className="field"><label>Default amount / percentage</label><input name="default_amount" type="number" min="0" step="0.01" defaultValue="0" /></div>
              <div className="field"><label>Notes</label><input name="notes" /></div>
              <button className="button" type="submit">Save Allowance Type</button>
            </form>

            <form className="card" action={saveStaffAllowanceAction}>
              <h3 className="section-title">Assign staff allowance</h3>
              <div className="field"><label>Staff</label><select name="staff_id" required defaultValue=""><option value="" disabled>Select staff</option>{(staff || []).map((s:any)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div>
              <div className="field"><label>Allowance</label><select name="allowance_type_id" required defaultValue=""><option value="" disabled>Select type</option>{(allowanceTypes || []).filter((a:any)=>["fixed","percentage_base"].includes(a.calculation_type)).map((a:any)=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div className="field"><label>Amount / percentage override</label><input name="amount" type="number" min="0" step="0.01" /></div>
              <div className="grid-2"><div className="field"><label>Effective from</label><input name="effective_from" type="date" /></div><div className="field"><label>Effective to</label><input name="effective_to" type="date" /></div></div>
              <div className="field"><label>Notes</label><input name="notes" /></div>
              <button className="button" type="submit">Assign Allowance</button>
            </form>
          </div>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Staff</th><th>Allowance</th><th>Amount</th><th>Effective</th><th>Status</th></tr></thead>
            <tbody>
              {(staffAllowances || []).map((row:any)=>{
                const s=staffMap.get(row.staff_id) as any;
                const t=typeMap.get(row.allowance_type_id) as any;
                return <tr key={row.id}><td>{s?.full_name || row.staff_id}</td><td>{t?.name || row.allowance_type_id}</td><td>{row.amount ?? t?.default_amount ?? 0}</td><td>{row.effective_from || "Any"} → {row.effective_to || "Open"}</td><td>{row.active ? "Active":"Inactive"}</td></tr>
              })}
              {!staffAllowances?.length ? <tr><td colSpan={5} className="muted">No staff-specific allowances assigned.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Loan servicing</div><h2>Staff loans</h2></div>
        </div>

        <form className="card payroll-loan-form" action={createStaffLoanAction}>
          <div className="field"><label>Staff</label><select name="staff_id" required defaultValue=""><option value="" disabled>Select staff</option>{(staff || []).map((s:any)=><option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div>
          <div className="field"><label>Loan name</label><input name="loan_name" defaultValue="Staff Loan" required /></div>
          <div className="field"><label>Principal</label><input name="principal" type="number" min="0.01" step="0.01" required /></div>
          <div className="field"><label>Monthly deduction</label><input name="monthly_deduction" type="number" min="0.01" step="0.01" required /></div>
          <div className="field"><label>Start month</label><input name="start_month" type="month" defaultValue={new Date().toISOString().slice(0,7)} required /></div>
          <div className="field"><label>Notes</label><input name="notes" /></div>
          <button className="button" type="submit">Create Loan</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Staff</th><th>Loan</th><th>Principal</th><th>Monthly</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {(loans || []).map((row:any)=>{
                const s=staffMap.get(row.staff_id) as any;
                return <tr key={row.id}><td>{s?.full_name || row.staff_id}</td><td>{row.loan_name}</td><td>{money(row.principal)}</td><td>{money(row.monthly_deduction)}</td><td>{money(row.amount_paid)}</td><td><strong>{money(row.balance)}</strong></td><td><span className="tag">{row.status}</span></td></tr>
              })}
              {!loans?.length ? <tr><td colSpan={7} className="muted">No staff loans recorded.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
