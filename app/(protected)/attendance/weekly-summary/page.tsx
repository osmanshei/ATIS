import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";

const WEEK_COUNT = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export default async function WeeklyAttendanceSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; class?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;

  const [{ data: terms }, { data: classes }] = await Promise.all([
    supabase
      .from("terms")
      .select("id,name,is_current,starts_on,ends_on")
      .order("starts_on"),
    supabase
      .from("class_summary")
      .select("id,class_name,section,is_active")
      .eq("is_active", true)
      .order("class_name"),
  ]);

  const selectedTermId =
    params.term ||
    terms?.find((term: any) => term.is_current)?.id ||
    terms?.[0]?.id ||
    "";
  const selectedClassId = params.class || classes?.[0]?.id || "";
  const term = (terms || []).find((item: any) => item.id === selectedTermId);
  const classRow = (classes || []).find((item: any) => item.id === selectedClassId);

  const [{ data: students }, { data: sessions }] = selectedTermId && selectedClassId && term?.starts_on && term?.ends_on
    ? await Promise.all([
        supabase
          .from("students")
          .select("id,admission_number,first_name,middle_name,last_name")
          .eq("class_id", selectedClassId)
          .eq("status", "active")
          .order("first_name")
          .order("last_name"),
        supabase
          .from("attendance_sessions")
          .select("id,attendance_date")
          .eq("class_id", selectedClassId)
          .eq("mode", "daily")
          .gte("attendance_date", term.starts_on)
          .lte("attendance_date", term.ends_on),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const sessionIds = (sessions || []).map((session: any) => session.id);
  const { data: records } = sessionIds.length
    ? await supabase
        .from("attendance_records")
        .select("session_id,student_id,status")
        .in("session_id", sessionIds)
    : { data: [] as any[] };

  const sessionDates = new Map((sessions || []).map((session: any) => [session.id, session.attendance_date]));
  const weeklyTotals = new Map<string, number[]>();
  for (const student of students || []) {
    weeklyTotals.set(student.id, Array(WEEK_COUNT).fill(0));
  }

  const termStart = term?.starts_on ? utcDate(term.starts_on) : 0;
  for (const record of records || []) {
    if (record.status !== "present" && record.status !== "late") continue;
    const date = sessionDates.get(record.session_id) as string | undefined;
    if (!date) continue;
    const weekIndex = Math.floor((utcDate(date) - termStart) / (7 * DAY_MS));
    if (weekIndex < 0 || weekIndex >= WEEK_COUNT) continue;
    const values = weeklyTotals.get(record.student_id);
    if (values) values[weekIndex] += 1;
  }

  const weeks = Array.from({ length: WEEK_COUNT }, (_, index) => {
    const start = termStart + index * 7 * DAY_MS;
    const end = start + 6 * DAY_MS;
    return {
      label: "WK" + (index + 1),
      range: dateLabel(start) + "–" + dateLabel(end),
    };
  });

  const rows = (students || []).map((student: any) => {
    const values = weeklyTotals.get(student.id) || Array(WEEK_COUNT).fill(0);
    return {
      ...student,
      values,
      total: values.reduce((sum, value) => sum + value, 0),
    };
  });

  const classLabel = classRow
    ? classRow.class_name + (classRow.section ? " / " + classRow.section : "")
    : "Select a class";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Attendance · {term?.name || "Term"}</div>
          <h1>Weekly Attendance Summary</h1>
          <p>{classLabel} · 15 weekly totals, calculated from the daily registers.</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/attendance/reports">Attendance reports</Link>
          <PrintButton label="Print summary" />
        </div>
      </div>

      <form className="form-card form-grid no-print" method="get">
        <div className="field">
          <label>Term</label>
          <select name="term" defaultValue={selectedTermId}>
            {(terms || []).map((item: any) => (
              <option key={item.id} value={item.id}>{item.name}{item.is_current ? " · Current" : ""}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Class</label>
          <select name="class" defaultValue={selectedClassId}>
            {(classes || []).map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.class_name}{item.section ? " / " + item.section : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">View summary</button>
      </form>

      <div className="notice">
        Each weekly figure counts days marked Present or Late. The weekly values are calculated from
        existing daily attendance records, so teachers do not need to enter attendance twice.
      </div>

      {!term?.starts_on || !term?.ends_on || !selectedClassId ? (
        <div className="empty-state">
          <strong>Term dates or class are not available</strong>
          <p>Select a term with start and end dates and an active class.</p>
        </div>
      ) : (
        <>
          <div className="teacher-summary-grid">
            <div className="metric-card"><span className="metric-kicker">Students</span><strong>{rows.length}</strong><small>Active learners in this class</small></div>
            <div className="metric-card"><span className="metric-kicker">Weeks shown</span><strong>{WEEK_COUNT}</strong><small>Up to 5 attendance days per week</small></div>
            <div className="metric-card"><span className="metric-kicker">Attendance records</span><strong>{records?.length || 0}</strong><small>Daily marks within the selected term</small></div>
          </div>

          <div className="table-wrap weekly-attendance-desktop">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>Name of Student</th>
                  {weeks.map((week) => <th key={week.label}>{week.label}<br /><small>{week.range}</small></th>)}
                  <th rowSpan={2}>Total</th>
                </tr>
                <tr>
                  {weeks.map((week) => <th key={week.label + "-max"}> / 5 </th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((student, index) => (
                  <tr key={student.id}>
                    <td>{index + 1}</td>
                    <td><strong>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</strong><br /><small>{student.admission_number || ""}</small></td>
                    {student.values.map((value: number, weekIndex: number) => <td key={weekIndex}>{value}</td>)}
                    <td><strong>{student.total}</strong></td>
                  </tr>
                ))}
                {!rows.length ? <tr><td colSpan={WEEK_COUNT + 3}>No active students found in this class.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="weekly-attendance-mobile">
            {rows.map((student, index) => (
              <article className="weekly-attendance-card" key={student.id}>
                <div className="weekly-attendance-card-head">
                  <div>
                    <strong>{index + 1}. {[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</strong>
                    <small>{student.admission_number || "No admission number"}</small>
                  </div>
                  <div><strong>{student.total}</strong><small>Total</small></div>
                </div>
                <div className="weekly-attendance-weeks">
                  {student.values.map((value: number, weekIndex: number) => (
                    <div key={weekIndex}>
                      <small>WK{weekIndex + 1}</small>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!rows.length ? <div className="empty-state">No active students found in this class.</div> : null}
          </div>
        </>
      )}
    </>
  );
}
