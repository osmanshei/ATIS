import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;
  const { data, error } = await supabase
    .from("staff")
    .select("id,user_id,employee_code,full_name,email,mobile,role,position_title,specialization_duty,status")
    .order("full_name")
    .limit(300);

  const rows = (data || []) as any[];
  const isAdmin = profile.role === "admin";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff</h1>
          <p>Teaching and non-teaching staff share one HR record while permissions remain role-based.</p>
        </div>
        <div className="action-row">
          {isAdmin ? <Link className="button" href="/staff/new">Add Staff</Link> : null}
          {isAdmin ? <Link className="button secondary" href="/staff/onboarding">Bulk Onboarding</Link> : null}
          <Link className="button secondary" href="/staff/contracts">Appointments & Contracts</Link>
        </div>
      </div>
      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee Code</th><th>Name</th><th>Role</th><th>Duty / Position</th>
              <th>Phone</th><th>Email</th><th>Login</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.employee_code || "—"}</td>
                <td><strong>{r.full_name}</strong></td>
                <td><span className="tag">{r.role}</span></td>
                <td>{r.position_title || r.specialization_duty || "—"}</td>
                <td>{r.mobile || "—"}</td>
                <td>{r.email || "—"}</td>
                <td>{r.user_id ? <span className="tag">Created</span> : <span className="tag gray">Not created</span>}</td>
                <td>{r.status}</td>
                <td>
                  <div className="action-row">
                    {["admin","supervisor"].includes(profile.role) ? (
                      <Link className="button secondary compact" href={"/staff/" + r.id + "/edit"}>Edit</Link>
                    ) : null}
                    {isAdmin ? (
                      <Link className="button secondary compact" href={"/staff/" + r.id + "/access"}>
                        {r.user_id ? "Send Login Details" : "Create Login"}
                      </Link>
                    ) : null}
                    {r.role === "teacher" ? (
                      <Link className="button secondary compact" href="/teacher-assignments">
                        Subject Assignments
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={9} className="muted">No staff records yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
