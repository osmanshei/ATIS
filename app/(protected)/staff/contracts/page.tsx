import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  activateStaffContractAction,
  createStaffContractAction,
  terminateStaffContractAction,
} from "./actions";

export default async function StaffContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;
  const canManage = profile.role === "admin";

  const [staffResult, contractsResult] = await Promise.all([
    supabase
      .from("staff")
      .select("id,full_name,employee_code,role,position_title")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("staff_contract_summary")
      .select("*")
      .order("start_date", { ascending: false })
      .limit(300),
  ]);

  const staff = (staffResult.data || []) as any[];
  const contracts = (contractsResult.data || []) as any[];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff Appointments & Contracts</h1>
          <p>Create appointments, activate them, print letters and track contract status.</p>
        </div>
        <Link className="button secondary" href="/staff">Back to staff</Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      {canManage ? (
        <form className="form-card" action={createStaffContractAction}>
          <h2 className="section-title">New appointment / contract</h2>
          <div className="form-grid">
            <div className="field">
              <label>Staff member *</label>
              <select name="staff_id" required>
                <option value="">Choose...</option>
                {staff.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.full_name}{s.employee_code ? " (" + s.employee_code + ")" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Employment type *</label>
              <select name="employment_type" defaultValue="fixed_term">
                <option value="fixed_term">Fixed term</option>
                <option value="permanent">Permanent</option>
                <option value="probationary">Probationary</option>
                <option value="temporary">Temporary</option>
                <option value="part_time">Part time</option>
              </select>
            </div>
            <div className="field"><label>Position title *</label><input name="position_title" required /></div>
            <div className="field"><label>Department</label><input name="department" /></div>
            <div className="field"><label>Assigned class</label><input name="assigned_class" /></div>
            <div className="field"><label>Subjects / duty</label><input name="subjects" /></div>
            <div className="field"><label>Start date *</label><input name="start_date" type="date" required /></div>
            <div className="field"><label>Probation end</label><input name="probation_end_date" type="date" /></div>
            <div className="field"><label>End date</label><input name="end_date" type="date" /></div>
            <div className="field"><label>Base salary (GHS)</label><input name="base_salary" type="number" min="0" step="0.01" /></div>
            <div className="field"><label>Working hours</label><input name="working_hours" placeholder="e.g. 7:30 AM – 4:00 PM" /></div>
            <div className="field"><label>Reporting to</label><input name="reporting_to" /></div>
            <div className="field"><label>Work location</label><input name="work_location" defaultValue="ATIS" /></div>
            <div className="field"><label>Notice period</label><input name="notice_period" /></div>
            <div className="field">
              <label>Initial status</label>
              <select name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="active">Active / appointed</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Benefits / conditions</label><textarea name="benefits_notes" rows={2} /></div>
          <div className="field"><label>Notes</label><textarea name="notes" rows={2} /></div>
          <button className="button" type="submit">Create appointment</button>
        </form>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contract</th><th>Staff</th><th>Position</th><th>Dates</th>
              <th>Salary</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.contract_no}</strong><br /><span className="muted">{c.employment_type}</span></td>
                <td><strong>{c.full_name}</strong><br /><span className="muted">{c.employee_code || ""}</span></td>
                <td>{c.position_title}<br /><span className="muted">{c.department || c.subjects || "—"}</span></td>
                <td>{c.start_date}{c.end_date ? " → " + c.end_date : ""}</td>
                <td>GHS {Number(c.base_salary || 0).toFixed(2)}</td>
                <td><span className="tag">{c.effective_status}</span></td>
                <td>
                  <div className="action-row">
                    {c.status === "draft" && canManage ? (
                      <form action={activateStaffContractAction}>
                        <input type="hidden" name="contract_id" value={c.id} />
                        <button className="button compact" type="submit">Activate</button>
                      </form>
                    ) : null}

                    {c.status !== "draft" ? (
                      <Link className="button secondary compact" href={"/staff/contracts/" + c.id + "/letter"}>
                        Appointment Letter
                      </Link>
                    ) : null}

                    {canManage && !["terminated", "renewed"].includes(c.status) ? (
                      <form action={terminateStaffContractAction} className="inline-reject">
                        <input type="hidden" name="contract_id" value={c.id} />
                        <input name="termination_date" type="date" required />
                        <input name="reason" placeholder="Termination reason" required />
                        <button className="button secondary compact" type="submit">Terminate</button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!contracts.length ? <tr><td colSpan={7} className="muted">No staff contracts yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
