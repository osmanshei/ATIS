import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { StaffLoginPanel } from "@/components/staff-login-panel";

export default async function StaffAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireProfile(["admin"]);

  const [{ data: staff }, { data: logs }] = await Promise.all([
    supabase
      .from("staff")
      .select("id,user_id,employee_code,full_name,email,mobile,role,position_title,status")
      .eq("id", id)
      .single(),
    supabase
      .from("staff_delivery_logs")
      .select("id,kind,channel,destination,status,created_at")
      .eq("staff_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (!staff) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff Login Access</h1>
          <p>{staff.full_name} · {staff.employee_code || "No employee code"}</p>
        </div>
        <Link className="button secondary" href="/staff">Back to staff</Link>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">Account</h2>
          <p><strong>Role:</strong> {staff.role}</p>
          <p><strong>Position:</strong> {staff.position_title || "—"}</p>
          <p><strong>Phone:</strong> {staff.mobile || "—"}</p>
          <p><strong>Email:</strong> {staff.email || "—"}</p>
          <p><strong>Login account:</strong> {staff.user_id ? "Created" : "Not created yet"}</p>
        </section>

        <StaffLoginPanel staffId={staff.id} hasLogin={Boolean(staff.user_id)} />
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Kind</th><th>Channel</th><th>Destination</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(logs || []).map((row: any) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString("en-GB")}</td>
                <td>{row.kind}</td>
                <td>{row.channel}</td>
                <td>{row.destination || "—"}</td>
                <td>{row.status}</td>
              </tr>
            ))}
            {!logs?.length ? <tr><td colSpan={5} className="muted">No delivery attempts yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
