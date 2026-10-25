"use client";

import { useMemo, useState } from "react";
import { saveAttendanceAction } from "@/app/(protected)/attendance/actions";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "sick";

type StudentRow = {
  id: string;
  admission_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type InitialRecord = {
  student_id: string;
  status: AttendanceStatus;
  remark: string | null;
};

const OPTIONS: { value: AttendanceStatus; label: string; short: string }[] = [
  { value: "present", label: "Present", short: "P" },
  { value: "absent", label: "Absent", short: "A" },
  { value: "late", label: "Late", short: "L" },
  { value: "excused", label: "Excused", short: "E" },
  { value: "sick", label: "Sick", short: "S" },
];

export function AttendanceRegister({
  classId,
  attendanceDate,
  students,
  initialRecords,
  initialNotes,
  locked,
}: {
  classId: string;
  attendanceDate: string;
  students: StudentRow[];
  initialRecords: InitialRecord[];
  initialNotes: string;
  locked: boolean;
}) {
  const initialMap = new Map(initialRecords.map((r) => [r.student_id, r]));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(
      students.map((s) => [s.id, initialMap.get(s.id)?.status || "present"]),
    ),
  );
  const [remarks, setRemarks] = useState<Record<string, string>>(
    Object.fromEntries(
      students.map((s) => [s.id, initialMap.get(s.id)?.remark || ""]),
    ),
  );

  const counts = useMemo(() => {
    const out: Record<AttendanceStatus, number> = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      sick: 0,
    };
    Object.values(statuses).forEach((status) => {
      out[status] += 1;
    });
    return out;
  }, [statuses]);

  const records = students.map((student) => ({
    student_id: student.id,
    status: statuses[student.id] || "present",
    remark: remarks[student.id] || "",
  }));

  function markAll(status: AttendanceStatus) {
    if (locked) return;
    setStatuses(
      Object.fromEntries(students.map((student) => [student.id, status])),
    );
  }

  return (
    <form action={saveAttendanceAction}>
      <input type="hidden" name="class_id" value={classId} />
      <input type="hidden" name="attendance_date" value={attendanceDate} />
      <input type="hidden" name="records_json" value={JSON.stringify(records)} />

      <div className="attendance-toolbar">
        <div className="attendance-counts">
          <span><b>{counts.present}</b> Present</span>
          <span><b>{counts.absent}</b> Absent</span>
          <span><b>{counts.late}</b> Late</span>
          <span><b>{counts.excused}</b> Excused</span>
          <span><b>{counts.sick}</b> Sick</span>
        </div>
        <div className="action-row">
          <button className="button secondary compact" type="button" onClick={() => markAll("present")} disabled={locked}>
            Mark all present
          </button>
          <button className="button secondary compact" type="button" onClick={() => markAll("absent")} disabled={locked}>
            Mark all absent
          </button>
        </div>
      </div>

      <div className="attendance-list">
        {students.map((student, index) => {
          const fullName = [student.first_name, student.middle_name, student.last_name]
            .filter(Boolean)
            .join(" ");
          const current = statuses[student.id] || "present";

          return (
            <article className="attendance-row" key={student.id}>
              <div className="attendance-student">
                <span className="attendance-number">{index + 1}</span>
                <div>
                  <strong>{fullName}</strong>
                  <small>{student.admission_number || "No admission number"}</small>
                </div>
              </div>

              <div className="attendance-status-buttons">
                {OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    className={`attendance-status ${option.value} ${current === option.value ? "selected" : ""}`}
                    onClick={() =>
                      !locked &&
                      setStatuses((prev) => ({ ...prev, [student.id]: option.value }))
                    }
                    disabled={locked}
                  >
                    <span>{option.short}</span>
                    <small>{option.label}</small>
                  </button>
                ))}
              </div>

              <div className="attendance-remark">
                <input
                  value={remarks[student.id] || ""}
                  onChange={(event) =>
                    setRemarks((prev) => ({ ...prev, [student.id]: event.target.value }))
                  }
                  placeholder="Optional remark"
                  disabled={locked}
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="attendance-notes">
        <div className="field">
          <label>Register notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={initialNotes}
            placeholder="Optional class-level note for this date"
            disabled={locked}
          />
        </div>
        {!locked ? (
          <button className="button" type="submit">Save attendance</button>
        ) : (
          <div className="notice">This register is locked. Admin or Supervisor must unlock it before changes can be saved.</div>
        )}
      </div>
    </form>
  );
}
