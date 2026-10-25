import Link from "next/link";
import { requireProfile } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendancePage() {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const date = today();

  const [{ data: classes }, { data: sessions }] = await Promise.all([
    supabase
      .from("class_summary")
      .select("id,class_name,section,total_strength,grade_level,is_active")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
    supabase
      .from("attendance_session_summary")
      .select("id,class_id,class_name,section,attendance_date,total_count,present_count,late_count,absent_count,attendance_percentage,is_locked")
      .eq("attendance_date", date)
      .order("class_name"),
  ]);

  const sessionMap = new Map((sessions || []).map((s: any) => [s.class_id, s]));
  const totalClasses = (classes || []).length;
  const marked = (sessions || []).length;
  const absent = (sessions || []).reduce((sum: number, s: any) => sum + Number(s.absent_count || 0), 0);
  const total = (sessions || []).reduce((sum: number, s: any) => sum + Number(s.total_count || 0), 0);
  const attended = (sessions || []).reduce(
    (sum: number, s: any) => sum + Number(s.present_count || 0) + Number(s.late_count || 0),
    0,
  );
  const rate = total ? Math.round((attended / total) * 1000) / 10 : 0;

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">
            {profile.role === "teacher" ? "Teacher attendance" : "Attendance management"} · {date}
          </div>
          <h1>{profile.role === "teacher" ? "My Class Attendance" : "Student Attendance"}</h1>
          <p>
            {profile.role === "teacher"
              ? "Mark attendance only for classes assigned to you."
              : "Monitor daily attendance across the school and review class registers."}
          </p>
        </div>
        <Link className="button hero-button" href="/attendance/reports">
          Attendance reports
        </Link>
      </section>

      <div className="teacher-summary-grid">
        <div className="metric-card">
          <span className="metric-kicker">Classes available</span>
          <strong>{totalClasses}</strong>
          <small>Within your authorized scope</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Registers marked today</span>
          <strong>{marked}</strong>
          <small>{Math.max(totalClasses - marked, 0)} still unmarked</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Attendance rate today</span>
          <strong>{rate}%</strong>
          <small>{absent} absent learners recorded</small>
        </div>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Today</div>
            <h2>Class registers</h2>
          </div>
        </div>

        <div className="attendance-class-grid">
          {(classes || []).map((c: any) => {
            const s = sessionMap.get(c.id) as any;
            const classLabel = c.class_name + (c.section ? " / " + c.section : "");
            return (
              <article className="attendance-class-card" key={c.id}>
                <div>
                  <span className="metric-kicker">Class</span>
                  <h3>{classLabel}</h3>
                  <p>{c.total_strength || 0} active students</p>
                </div>
                <div className="attendance-class-status">
                  {s ? (
                    <>
                      <span className="tag">Marked</span>
                      <strong>{s.attendance_percentage}%</strong>
                      <small>
                        {s.absent_count} absent · {s.late_count} late{s.is_locked ? " · Locked" : ""}
                      </small>
                    </>
                  ) : (
                    <>
                      <span className="tag gray">Not marked</span>
                      <strong>—</strong>
                      <small>Register pending</small>
                    </>
                  )}
                </div>
                <Link
                  className="button compact"
                  href={"/attendance/register?class=" + c.id + "&date=" + date}
                >
                  {s ? "Open register" : "Take attendance"}
                </Link>
              </article>
            );
          })}
          {!classes?.length ? (
            <div className="empty-state">
              <strong>No classes available</strong>
              <p>No class is assigned to this account.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
