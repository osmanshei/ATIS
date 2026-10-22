import { requireProfile } from "@/lib/auth";

export default async function StaffPage() {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const { data, error } = await supabase
    .from("staff")
    .select("id,employee_code,full_name,email,mobile,role,position_title,specialization_duty,status")
    .order("full_name")
    .limit(300);

  const rows = (data || []) as any[];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <p>Teaching and non-teaching staff share one HR record while permissions remain role-based.</p>
        </div>
        <span className="tag">{rows.length} loaded</span>
      </div>
      {error ? <div className="notice error">{error.message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee Code</th><th>Name</th><th>Role</th><th>Duty / Position</th><th>Phone</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.employee_code || "—"}</td>
                <td><strong>{r.full_name}</strong></td>
                <td><span className="tag">{r.role}</span></td>
                <td>{r.position_title || r.specialization_duty || "—"}</td>
                <td>{r.mobile || "—"}</td>
                <td>{r.email || "—"}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="muted">No staff have been migrated yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
