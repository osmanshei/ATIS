import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AttendanceRegister } from "@/components/attendance-register";
import { setAttendanceLockAction } from "../actions";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function AttendanceRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string; ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "teacher"]);
  const params = await searchParams;
  const classId = params.class || "";
  const attendanceDate = params.date || today();

  if (!classId) notFound();

  const [{ data: cls }, { data: students }, { data: session }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,class_name,section")
      .eq("id", classId)
      .single(),
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
    supabase
      .from("attendance_sessions")
      .select("id,notes,is_locked")
      .eq("class_id", classId)
      .eq("attendance_date", attendanceDate)
      .eq("mode", "daily")
      .maybeSingle(),
  ]);

  if (!cls) notFound();

  const { data: records } = session
    ? await supabase
        .from("attendance_records")
        .select("student_id,status,remark")
        .eq("session_id", session.id)
    : { data: [] as any[] };

  const className = `${cls.class_name}${cls.section ? ` / ${cls.section}` : ""}`;
  const canLock = profile.role === "admin" || profile.role === "supervisor";

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Attendance register</div>
          <h1>{className}</h1>
          <p>{attendanceDate} · {students?.length || 0} active students</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/attendance">Back to attendance</Link>
          {canLock && session ? (
            <form action={setAttendanceLockAction}>
              <input type="hidden" name="session_id" value={session.id} />
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="attendance_date" value={attendanceDate} />
              <input type="hidden" name="locked" value={session.is_locked ? "false" : "true"} />
              <button className="button secondary" type="submit">
                {session.is_locked ? "Unlock register" : "Lock register"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      {!students?.length ? (
        <div className="empty-state">
          <strong>No active students found</strong>
          <p>This class currently has no active students to mark.</p>
        </div>
      ) : (
        <AttendanceRegister
          classId={classId}
          attendanceDate={attendanceDate}
          students={students as any}
          initialRecords={(records || []) as any}
          initialNotes={session?.notes || ""}
          locked={Boolean(session?.is_locked)}
        />
      )}
    </>
  );
}
