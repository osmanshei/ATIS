import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { saveStaffAttendanceAction } from "../actions";

function today() {
  return new Date().toISOString().slice(0,10);
}

export default async function StaffPayrollAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; ok?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin","supervisor","clerk"]);
  const params = await searchParams;
  const date = params.date || today();
  const month = date.slice(0,7) + "-01";

  const [{ data: staff }, { data: records }, { data: summary }] = await Promise.all([
    supabase.from("staff").select("id,full_name,employee_code,position_title").eq("status","active").order("full_name"),
    supabase.from("staff_attendance").select("*").eq("attendance_date",date),
    supabase.from("staff_early_attendance_summary").select("*").eq("payroll_month",month),
  ]);

  const recordMap = new Map((records || []).map((r:any)=>[r.staff_id,r]));
  const summaryMap = new Map((summary || []).map((r:any)=>[r.staff_id,r]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Payroll attendance</div>
          <h1>Staff Attendance & Early Days</h1>
          <p>Record staff attendance used for the monthly early-attendance allowance.</p>
        </div>
        <Link className="button secondary" href="/payroll">Back to Payroll</Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form className="term-switcher" method="get">
        <label>Date</label><input name="date" type="date" defaultValue={date} />
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="payroll-attendance-list">
        {(staff || []).map((s:any)=>{
          const r=recordMap.get(s.id) as any;
          const m=summaryMap.get(s.id) as any;
          return (
            <form className="card payroll-attendance-row" action={saveStaffAttendanceAction} key={s.id}>
              <input type="hidden" name="staff_id" value={s.id} />
              <input type="hidden" name="attendance_date" value={date} />
              <div className="payroll-person">
                <strong>{s.full_name}</strong>
                <small>{s.employee_code || "—"} · {s.position_title || "Staff"}</small>
                <small>{m?.early_days || 0} early day(s) / {m?.total_attendance || 0} attendance day(s) this month</small>
              </div>
              <div className="field"><label>Status</label><select name="status" defaultValue={r?.status || "present"}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option><option value="sick">Sick</option><option value="official">Official duty</option></select></div>
              <div className="field"><label>Check-in</label><input name="check_in_time" type="time" defaultValue={r?.check_in_time || ""} /></div>
              <label className="compact-check"><input name="early" type="checkbox" defaultChecked={Boolean(r?.early)} /> Early</label>
              <div className="field"><label>Notes</label><input name="notes" defaultValue={r?.notes || ""} /></div>
              <button className="button compact" type="submit">Save</button>
            </form>
          );
        })}
      </div>
    </>
  );
}
