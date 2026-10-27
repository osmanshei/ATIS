import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  importStaffDeviceAttendanceAction,
  saveStaffDeviceMappingAction,
} from "../actions";

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

  const [
    { data: staff },
    { data: mappings },
    { data: records },
    { data: summary },
  ] = await Promise.all([
    supabase
      .from("staff")
      .select("id,full_name,employee_code,position_title")
      .eq("status","active")
      .order("full_name"),
    supabase
      .from("staff_attendance_device_mappings")
      .select("id,staff_id,device_user_id,device_name,active"),
    supabase
      .from("staff_attendance")
      .select("id,staff_id,attendance_date,check_in_time,check_out_time,early,status,source,device_user_id,imported_at")
      .eq("attendance_date",date),
    supabase
      .from("staff_early_attendance_summary")
      .select("*")
      .eq("payroll_month",month),
  ]);

  const staffMap = new Map((staff || []).map((row:any)=>[row.id,row]));
  const mappingMap = new Map((mappings || []).map((row:any)=>[row.staff_id,row]));
  const summaryMap = new Map((summary || []).map((row:any)=>[row.staff_id,row]));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Verification-device attendance</div>
          <h1>Staff Attendance Import</h1>
          <p>
            Staff attendance and early-attendance records used by Payroll come from the
            attendance verification device. ATIS counts a first registration at 7:30 AM or earlier as Early.
          </p>
        </div>
        <Link className="button secondary" href="/payroll">Back to Payroll</Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <section className="card device-import-card">
        <h2 className="section-title">Import attendance device export</h2>
        <p className="muted">
          Upload the device's original .XLS Attendance Report directly. CSV exports are also supported.
          For the .XLS report, ATIS reads each staff member's daily first clock-in and calculates Early automatically at 7:30 AM or earlier.
        </p>
        <form action={importStaffDeviceAttendanceAction} className="device-import-form">
          <div className="field">
            <label>Device / Source name</label>
            <input name="device_name" defaultValue="Attendance Verification Device" />
          </div>
          <div className="field">
            <label>Device attendance file</label>
            <input
              name="attendance_file"
              type="file"
              accept=".xls,.csv,application/vnd.ms-excel,text/csv"
            />
          </div>
          <div className="field device-csv-paste">
            <label>Or paste CSV data</label>
            <textarea
              name="csv_text"
              rows={5}
              placeholder={"employee_code,staff_name,attendance_date,check_in_time,check_out_time,status\nATIS001,Teacher Name,2026-10-27,06:55,16:10,present"}
            />
          </div>
          <button className="button" type="submit">Import Device Attendance</button>
        </form>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Device identity mapping</div>
            <h2>Match device IDs to ATIS staff</h2>
          </div>
        </div>

        <form className="card device-mapping-form" action={saveStaffDeviceMappingAction}>
          <div className="field">
            <label>Staff member</label>
            <select name="staff_id" defaultValue="" required>
              <option value="" disabled>Select staff</option>
              {(staff || []).map((row:any)=>(
                <option key={row.id} value={row.id}>
                  {row.full_name} · {row.employee_code || row.position_title || "Staff"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Device User ID / PIN</label>
            <input name="device_user_id" required placeholder="ID used on the attendance device" />
          </div>
          <div className="field">
            <label>Device name</label>
            <input name="device_name" defaultValue="Attendance Verification Device" />
          </div>
          <button className="button" type="submit">Save Mapping</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Staff</th><th>Employee Code</th><th>Device ID</th><th>Device</th></tr></thead>
            <tbody>
              {(staff || []).map((row:any)=>{
                const mapping=mappingMap.get(row.id) as any;
                return (
                  <tr key={row.id}>
                    <td><strong>{row.full_name}</strong></td>
                    <td>{row.employee_code || "—"}</td>
                    <td>{mapping?.device_user_id || "—"}</td>
                    <td>{mapping?.device_name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Imported records</div>
            <h2>Attendance for {date}</h2>
          </div>
        </div>

        <form className="term-switcher" method="get">
          <label>Date</label>
          <input name="date" type="date" defaultValue={date} />
          <button className="button secondary compact" type="submit">View</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff</th><th>Device ID</th><th>Check In</th><th>Check Out</th>
                <th>Status</th><th>Early</th><th>Month Early Days</th><th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(records || []).map((row:any)=>{
                const staffRow=staffMap.get(row.staff_id) as any;
                const monthSummary=summaryMap.get(row.staff_id) as any;
                return (
                  <tr key={row.id}>
                    <td><strong>{staffRow?.full_name || row.staff_id}</strong><br/><span className="muted">{staffRow?.employee_code || ""}</span></td>
                    <td>{row.device_user_id || mappingMap.get(row.staff_id)?.device_user_id || "—"}</td>
                    <td>{row.check_in_time || "—"}</td>
                    <td>{row.check_out_time || "—"}</td>
                    <td><span className="tag">{row.status}</span></td>
                    <td>
                      {row.early ? (
                        <span className="tag">Yes · ≤ 7:30</span>
                      ) : (
                        <span className="muted">No</span>
                      )}
                    </td>
                    <td>{monthSummary?.early_days || 0} / {monthSummary?.total_attendance || 0}</td>
                    <td>{row.source || "verification_device"}</td>
                  </tr>
                );
              })}
              {!records?.length ? (
                <tr><td colSpan={8} className="muted">No device attendance has been imported for this date.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
