import Link from "next/link";
import { requireProfile } from "@/lib/auth";

function isoOffset(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function AttendanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; class?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;
  const from = params.from || isoOffset(-30);
  const to = params.to || isoOffset(0);

  let query = supabase
    .from("attendance_session_summary")
    .select("id,class_id,class_name,section,attendance_date,total_count,present_count,late_count,absent_count,excused_count,sick_count,attendance_percentage,is_locked")
    .gte("attendance_date", from)
    .lte("attendance_date", to)
    .order("attendance_date", { ascending: false })
    .order("class_name");

  if (params.class) query = query.eq("class_id", params.class);

  let historicalQuery = supabase
    .from("student_historical_attendance_totals")
    .select("student_id,class_id,total_attendance,updated_at")
    .order("class_id");

  if (params.class) historicalQuery = historicalQuery.eq("class_id", params.class);

  const [{ data: rows }, { data: classes }, { data: historicalRows }] = await Promise.all([
    query,
    supabase
      .from("class_summary")
      .select("id,class_name,section,is_active")
      .eq("is_active", true)
      .order("class_name"),
    historicalQuery,
  ]);

  const historicalStudentIds = Array.from(
    new Set((historicalRows || []).map((r: any) => r.student_id)),
  );
  const { data: historicalStudents } = historicalStudentIds.length
    ? await supabase
        .from("students")
        .select("id,admission_number,first_name,middle_name,last_name")
        .in("id", historicalStudentIds)
    : { data: [] as any[] };

  const historicalStudentMap = new Map(
    (historicalStudents || []).map((s: any) => [s.id, s]),
  );
  const historicalClassMap = new Map((classes || []).map((c: any) => [c.id, c]));
  const historicalAttendanceTotal = (historicalRows || []).reduce(
    (sum: number, r: any) => sum + Number(r.total_attendance || 0),
    0,
  );

  const total = (rows || []).reduce((a: number, r: any) => a + Number(r.total_count || 0), 0);
  const present = (rows || []).reduce(
    (a: number, r: any) => a + Number(r.present_count || 0) + Number(r.late_count || 0),
    0,
  );
  const abs = (rows || []).reduce((a: number, r: any) => a + Number(r.absent_count || 0), 0);
  const rate = total ? Math.round((present / total) * 1000) / 10 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Attendance analytics</div>
          <h1>{profile.role === "teacher" ? "My Attendance Reports" : "Attendance Reports"}</h1>
          <p>Daily class attendance from {from} to {to}.</p>
        </div>
        <Link className="button secondary" href="/attendance">Back to attendance</Link>
      </div>

      <form className="form-card form-grid" method="get">
        <div className="field">
          <label>From</label>
          <input type="date" name="from" defaultValue={from} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" name="to" defaultValue={to} />
        </div>
        <div className="field">
          <label>Class</label>
          <select name="class" defaultValue={params.class || ""}>
            <option value="">All authorized classes</option>
            {(classes || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.class_name}{c.section ? " / " + c.section : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">Apply filters</button>
      </form>

      <div className="teacher-summary-grid">
        <div className="metric-card">
          <span className="metric-kicker">Registers</span>
          <strong>{rows?.length || 0}</strong>
          <small>Class-day registers in period</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Attendance rate</span>
          <strong>{rate}%</strong>
          <small>Present + late as a share of records</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Absences</span>
          <strong>{abs}</strong>
          <small>Total absent marks in period</small>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Class</th><th>Total</th><th>Present</th><th>Late</th>
              <th>Absent</th><th>Excused</th><th>Sick</th><th>Rate</th><th></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: any) => (
              <tr key={r.id}>
                <td>{r.attendance_date}</td>
                <td><strong>{r.class_name}{r.section ? " / " + r.section : ""}</strong></td>
                <td>{r.total_count}</td>
                <td>{r.present_count}</td>
                <td>{r.late_count}</td>
                <td>{r.absent_count}</td>
                <td>{r.excused_count}</td>
                <td>{r.sick_count}</td>
                <td><strong>{r.attendance_percentage}%</strong></td>
                <td>
                  <Link
                    className="button secondary compact"
                    href={"/attendance/register?class=" + r.class_id + "&date=" + r.attendance_date}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {!rows?.length ? (
              <tr><td colSpan={10} className="muted">No attendance registers in this period.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Imported baseline</div>
            <h2>Historical attendance totals</h2>
            <p className="muted">
              Aggregate attendance recorded before ATIS daily registers. These totals are kept separate from dated registers and are not included in the selected date-range attendance percentage.
            </p>
          </div>
        </div>

        <div className="teacher-summary-grid">
          <div className="metric-card">
            <span className="metric-kicker">Students with historical totals</span>
            <strong>{historicalRows?.length || 0}</strong>
            <small>Imported student records</small>
          </div>
          <div className="metric-card">
            <span className="metric-kicker">Historical attendance total</span>
            <strong>{historicalAttendanceTotal.toLocaleString()}</strong>
            <small>Aggregate days attended</small>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Admission No.</th><th>Class at import</th><th>Total attendance</th><th>Last updated</th></tr>
            </thead>
            <tbody>
              {(historicalRows || []).map((r: any) => {
                const student = historicalStudentMap.get(r.student_id) as any;
                const cls = historicalClassMap.get(r.class_id) as any;
                const name = student
                  ? [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")
                  : "Student record unavailable";
                return (
                  <tr key={r.student_id}>
                    <td><strong>{name}</strong></td>
                    <td>{student?.admission_number || "—"}</td>
                    <td>{cls?.class_name || "—"}{cls?.section ? " / " + cls.section : ""}</td>
                    <td><strong>{Number(r.total_attendance || 0).toLocaleString()}</strong></td>
                    <td>{r.updated_at ? new Date(r.updated_at).toLocaleDateString("en-GH") : "—"}</td>
                  </tr>
                );
              })}
              {!historicalRows?.length ? (
                <tr><td colSpan={5} className="muted">No historical attendance totals have been imported yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
