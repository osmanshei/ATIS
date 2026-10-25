import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { updateStaffAction } from "../../actions";

export default async function EditStaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const { data: staff } = await supabase.from("staff").select("*").eq("id", id).single();
  if (!staff) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Human resources</div>
          <h1>Edit Staff</h1>
          <p>{staff.full_name} · {staff.employee_code || "No employee code"}</p>
        </div>
        <Link className="button secondary" href="/staff">Back to staff</Link>
      </div>

      {query.error ? <div className="notice error">{query.error}</div> : null}
      {staff.user_id ? (
        <div className="notice">
          This staff member has a login account. Changes to name, email, phone, role and status will be synchronized with the account profile.
        </div>
      ) : null}

      <form className="form-card" action={updateStaffAction}>
        <input type="hidden" name="staff_id" value={staff.id} />

        <div className="form-grid">
          <div className="field"><label>Employee code</label><input name="employee_code" defaultValue={staff.employee_code || ""} /></div>
          <div className="field"><label>Full name</label><input name="full_name" defaultValue={staff.full_name || ""} required /></div>
          <div className="field"><label>Email</label><input name="email" type="email" defaultValue={staff.email || ""} required /></div>
          <div className="field"><label>Phone</label><input name="mobile" defaultValue={staff.mobile || ""} required /></div>
          <div className="field">
            <label>System role</label>
            <select name="role" defaultValue={staff.role || "staff"}>
              <option value="teacher">Teacher</option>
              <option value="supervisor">Supervisor</option>
              <option value="accountant">Accountant</option>
              <option value="clerk">Clerk / Secretary</option>
              <option value="staff">Other Staff</option>
            </select>
          </div>
          <div className="field"><label>Position / Title</label><input name="position_title" defaultValue={staff.position_title || ""} /></div>
          <div className="field"><label>Specialization / Duty</label><input name="specialization_duty" defaultValue={staff.specialization_duty || ""} /></div>
          <div className="field">
            <label>Gender</label>
            <select name="gender" defaultValue={staff.gender || ""}>
              <option value="">Not set</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          <div className="field"><label>Date of birth</label><input name="date_of_birth" type="date" defaultValue={staff.date_of_birth || ""} /></div>
          <div className="field"><label>Date of employment</label><input name="joining_date" type="date" defaultValue={staff.joining_date || ""} /></div>
          <div className="field"><label>Qualification</label><input name="qualification" defaultValue={staff.qualification || ""} /></div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue={staff.status || "active"}>
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="field"><label>Address</label><textarea name="address" rows={2} defaultValue={staff.address || ""} /></div>
          <div className="field"><label>Emergency contact name</label><input name="emergency_contact_name" defaultValue={staff.emergency_contact_name || ""} /></div>
          <div className="field"><label>Emergency contact phone</label><input name="emergency_contact_phone" defaultValue={staff.emergency_contact_phone || ""} /></div>
        </div>

        <div className="action-row">
          <button className="button" type="submit">Save Staff Changes</button>
          <Link className="button secondary" href="/staff">Cancel</Link>
        </div>
      </form>
    </>
  );
}
