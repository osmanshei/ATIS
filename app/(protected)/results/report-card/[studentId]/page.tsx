import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { saveReportRemarkAction } from "../../actions";

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string; ok?: string; error?: string }>;
}) {
  const { studentId } = await params;
  const query = await searchParams;
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);

  const { data: student } = await supabase
    .from("students")
    .select("id,admission_number,first_name,middle_name,last_name,gender,class_id")
    .eq("id", studentId)
    .single();

  if (!student || !student.class_id) notFound();

  const [{ data: terms }, { data: cls }, { data: school }] = await Promise.all([
    supabase
      .from("terms")
      .select("id,name,is_current,academic_year_id,starts_on,ends_on")
      .order("starts_on"),
    supabase
      .from("classes")
      .select("id,class_name,section")
      .eq("id", student.class_id)
      .single(),
    supabase
      .from("schools")
      .select("name,short_name,address,phone,email,website,logo_url")
      .eq("id", profile.school_id)
      .single(),
  ]);

  const termId =
    query.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  const term = terms?.find((t: any) => t.id === termId);
  if (!term || !cls) notFound();

  const nextTerm = terms?.find(
    (t: any) =>
      t.academic_year_id === term.academic_year_id &&
      t.starts_on &&
      term.starts_on &&
      t.starts_on > term.starts_on,
  );

  const [
    { data: subjectRows },
    { data: setups },
    { data: remarks },
    { data: publication },
    { data: classRows },
    { data: attendanceSessions },
  ] = await Promise.all([
    supabase
      .from("student_subject_results")
      .select(
        "setup_id,subject_id,subject_name,subject_code,ca_weighted_score,exam_weighted_score,total_score,grade,interpretation,grade_remark,result_complete,exam_absent",
      )
      .eq("student_id", studentId)
      .eq("term_id", termId)
      .order("subject_name"),
    supabase
      .from("assessment_setup_summary")
      .select("id,subject_id")
      .eq("class_id", student.class_id)
      .eq("term_id", termId),
    supabase
      .from("report_remarks")
      .select("teacher_remark,headteacher_remark,conduct,next_term_begins")
      .eq("student_id", studentId)
      .eq("class_id", student.class_id)
      .eq("term_id", termId)
      .maybeSingle(),
    supabase
      .from("result_publications")
      .select("status,published_at")
      .eq("class_id", student.class_id)
      .eq("term_id", termId)
      .maybeSingle(),
    supabase
      .from("student_subject_results")
      .select("student_id,total_score,result_complete")
      .eq("class_id", student.class_id)
      .eq("term_id", termId),
    supabase
      .from("attendance_sessions")
      .select("id,attendance_date")
      .eq("class_id", student.class_id)
      .eq("mode", "daily")
      .gte("attendance_date", term.starts_on)
      .lte("attendance_date", term.ends_on),
  ]);

  const sessionIds = (attendanceSessions || []).map((s: any) => s.id);
  const { data: attendanceRecords } = sessionIds.length
    ? await supabase
        .from("attendance_records")
        .select("status")
        .eq("student_id", studentId)
        .in("session_id", sessionIds)
    : { data: [] as any[] };

  const attendance = {
    total: attendanceRecords?.length || 0,
    present: (attendanceRecords || []).filter((r: any) => r.status === "present").length,
    late: (attendanceRecords || []).filter((r: any) => r.status === "late").length,
    absent: (attendanceRecords || []).filter((r: any) => r.status === "absent").length,
    excused: (attendanceRecords || []).filter((r: any) => r.status === "excused").length,
    sick: (attendanceRecords || []).filter((r: any) => r.status === "sick").length,
  };
  const attendanceRate = attendance.total
    ? Math.round(((attendance.present + attendance.late) / attendance.total) * 1000) / 10
    : 0;

  const subjectCount = setups?.length || 0;
  const completeCount = (subjectRows || []).filter((r: any) => r.result_complete).length;
  const allComplete = subjectCount > 0 && completeCount === subjectCount;
  const average = subjectRows?.length
    ? (subjectRows || []).reduce((sum: number, row: any) => sum + Number(row.total_score || 0), 0) /
      subjectRows.length
    : 0;

  const grouped = new Map<string, { total: number; complete: number; count: number }>();
  for (const row of classRows || []) {
    const item = grouped.get(row.student_id) || { total: 0, complete: 0, count: 0 };
    item.total += Number(row.total_score || 0);
    item.count += 1;
    if (row.result_complete) item.complete += 1;
    grouped.set(row.student_id, item);
  }

  const ranked = [...grouped.entries()]
    .filter(([, item]) => subjectCount > 0 && item.complete === subjectCount)
    .map(([id, item]) => ({
      id,
      average: item.count ? item.total / item.count : 0,
    }))
    .sort((a, b) => b.average - a.average);

  let position: number | null = null;
  let previousAverage: number | null = null;
  let previousPosition = 0;
  for (let index = 0; index < ranked.length; index += 1) {
    const rounded = Math.round(ranked[index].average * 100) / 100;
    if (previousAverage === null || rounded !== previousAverage) {
      previousPosition = index + 1;
      previousAverage = rounded;
    }
    if (ranked[index].id === studentId) {
      position = previousPosition;
      break;
    }
  }

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
  const classLabel = cls.class_name + (cls.section ? " / " + cls.section : "");
  const publicationStatus = publication?.status || "draft";
  const nextTermBegins = remarks?.next_term_begins || nextTerm?.starts_on || "";

  return (
    <>
      <div className="report-toolbar no-print">
        <Link
          className="button secondary"
          href={"/results/class/" + student.class_id + "?term=" + termId}
        >
          Back to class
        </Link>
        <PrintButton />
      </div>

      {query.ok ? <div className="notice success no-print">{query.ok}</div> : null}
      {query.error ? <div className="notice error no-print">{query.error}</div> : null}

      <div className="report-card-page">
        {publicationStatus !== "published" ? (
          <div className="report-watermark">DRAFT · NOT PUBLISHED</div>
        ) : null}

        <header className="report-header">
          <div className="report-logo">
            <Image src="/atis-logo.svg" alt="ATIS" width={82} height={82} />
          </div>
          <div>
            <h1>{school?.name || "AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL"}</h1>
            <p>{school?.address || "Bimbilla, Northern Region - Ghana"}</p>
            <p>{[school?.phone, school?.email].filter(Boolean).join(" · ")}</p>
            <h2>TERMINAL REPORT CARD</h2>
          </div>
        </header>

        <section className="report-student-meta">
          <div><span>Student</span><strong>{fullName}</strong></div>
          <div><span>Admission No.</span><strong>{student.admission_number || "—"}</strong></div>
          <div><span>Class</span><strong>{classLabel}</strong></div>
          <div><span>Term</span><strong>{term.name}</strong></div>
          <div><span>Gender</span><strong>{student.gender || "—"}</strong></div>
          <div><span>Position</span><strong>{allComplete && position ? position : "—"}</strong></div>
        </section>

        <table className="report-results-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>CA</th>
              <th>Exam</th>
              <th>Total</th>
              <th>Grade</th>
              <th>Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {(subjectRows || []).map((row: any) => (
              <tr key={row.setup_id}>
                <td><strong>{row.subject_name}</strong><small>{row.subject_code}</small></td>
                <td>{row.result_complete ? Number(row.ca_weighted_score || 0).toFixed(1) : "—"}</td>
                <td>{row.result_complete ? Number(row.exam_weighted_score || 0).toFixed(1) : "—"}</td>
                <td><strong>{row.result_complete ? Number(row.total_score || 0).toFixed(1) : "Pending"}</strong></td>
                <td>{row.result_complete ? row.grade || "—" : "—"}</td>
                <td>{row.result_complete ? row.interpretation || row.grade_remark || "—" : "Score entry incomplete"}</td>
              </tr>
            ))}
            {!subjectRows?.length ? (
              <tr><td colSpan={6}>No subject results have been configured for this term.</td></tr>
            ) : null}
          </tbody>
        </table>

        <section className="report-summary-grid">
          <div>
            <span>Overall Average</span>
            <strong>{allComplete ? average.toFixed(1) + "%" : "Incomplete"}</strong>
          </div>
          <div>
            <span>Subjects Complete</span>
            <strong>{completeCount} / {subjectCount}</strong>
          </div>
          <div>
            <span>Attendance</span>
            <strong>{attendanceRate}%</strong>
          </div>
          <div>
            <span>Days Recorded</span>
            <strong>{attendance.total}</strong>
          </div>
          <div>
            <span>Absent</span>
            <strong>{attendance.absent}</strong>
          </div>
          <div>
            <span>Late</span>
            <strong>{attendance.late}</strong>
          </div>
        </section>

        <section className="report-remarks">
          <div>
            <span>Conduct</span>
            <p>{remarks?.conduct || "—"}</p>
          </div>
          <div>
            <span>Teacher's Remark</span>
            <p>{remarks?.teacher_remark || "—"}</p>
          </div>
          <div>
            <span>Headteacher's Remark</span>
            <p>{remarks?.headteacher_remark || "—"}</p>
          </div>
          <div>
            <span>Next Term Begins</span>
            <p>{nextTermBegins || "—"}</p>
          </div>
        </section>

        <footer className="report-signatures">
          <div><span></span><strong>Class Teacher</strong></div>
          <div><span></span><strong>Head of School</strong></div>
          <div><span></span><strong>Parent / Guardian</strong></div>
        </footer>
      </div>

      <form className="form-card no-print" action={saveReportRemarkAction}>
        <h2 className="section-title">Report remarks</h2>
        <input type="hidden" name="class_id" value={student.class_id} />
        <input type="hidden" name="student_id" value={studentId} />
        <input type="hidden" name="term_id" value={termId} />
        <div className="form-grid">
          <div className="field">
            <label>Conduct</label>
            <input name="conduct" defaultValue={remarks?.conduct || ""} />
          </div>
          <div className="field">
            <label>Next term begins</label>
            <input name="next_term_begins" type="date" defaultValue={nextTermBegins || ""} />
          </div>
        </div>
        <div className="field">
          <label>Teacher's remark</label>
          <textarea name="teacher_remark" rows={2} defaultValue={remarks?.teacher_remark || ""} />
        </div>
        <div className="field">
          <label>Headteacher's remark</label>
          <textarea name="headteacher_remark" rows={2} defaultValue={remarks?.headteacher_remark || ""} />
        </div>
        <button className="button" type="submit">Save report remarks</button>
      </form>
    </>
  );
}
