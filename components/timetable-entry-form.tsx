"use client";

import { useMemo, useState } from "react";
import { saveTimetableEntryAction } from "@/app/(protected)/timetable/actions";

type Assignment = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  class_subject_id: string;
  class_id: string;
  class_name: string;
  section?: string | null;
  subject_name: string;
  subject_code?: string | null;
};

type Aspect = {
  id: string;
  class_subject_id: string;
  aspect_name: string;
  aspect_code?: string | null;
  periods_per_week?: number | null;
};

type Period = {
  id: string;
  period_number: number;
  label?: string | null;
  start_time: string;
  end_time: string;
  is_break: boolean;
};

type EditingEntry = {
  id: string;
  teacher_assignment_id: string;
  class_subject_aspect_id?: string | null;
  day_of_week: number;
  period_id: string;
  room_number?: string | null;
  mode: string;
  meeting_link?: string | null;
  notes?: string | null;
} | null;

export function TimetableEntryForm({
  assignments,
  aspects,
  periods,
  termId,
  viewMode,
  viewClassId,
  viewTeacherId,
  editingEntry,
}: {
  assignments: Assignment[];
  aspects: Aspect[];
  periods: Period[];
  termId: string;
  viewMode: "class" | "teacher";
  viewClassId?: string;
  viewTeacherId?: string;
  editingEntry?: EditingEntry;
}) {
  const initialAssignment = editingEntry?.teacher_assignment_id || "";
  const [assignmentId, setAssignmentId] = useState(initialAssignment);

  const assignment = assignments.find((a) => a.id === assignmentId);
  const availableAspects = useMemo(
    () =>
      assignment
        ? aspects.filter((a) => a.class_subject_id === assignment.class_subject_id)
        : [],
    [assignment, aspects],
  );

  if (!assignments.length) {
    return (
      <div className="notice">
        No teacher assignments are available for this view. Configure Teacher Assignments first.
      </div>
    );
  }

  return (
    <form className="form-card timetable-entry-form" action={saveTimetableEntryAction}>
      <input type="hidden" name="timetable_entry_id" value={editingEntry?.id || ""} />
      <input type="hidden" name="term_id" value={termId} />
      <input type="hidden" name="view_mode" value={viewMode} />
      <input type="hidden" name="view_class_id" value={viewClassId || ""} />
      <input type="hidden" name="view_teacher_id" value={viewTeacherId || ""} />

      <div className="section-heading">
        <div>
          <div className="eyebrow">Schedule lesson</div>
          <h2>{editingEntry ? "Edit Timetable Entry" : "Add Timetable Entry"}</h2>
        </div>
      </div>

      <div className="timetable-entry-grid">
        <div className="field span-2">
          <label>Teacher / Main Subject</label>
          <select
            name="teacher_assignment_id"
            value={assignmentId}
            onChange={(event) => setAssignmentId(event.target.value)}
            required
          >
            <option value="">Choose...</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.class_name}{a.section ? " / " + a.section : ""} — {a.subject_name} — {a.teacher_name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Teaching aspect (optional)</label>
          <select
            name="class_subject_aspect_id"
            defaultValue={editingEntry?.class_subject_aspect_id || ""}
            key={assignmentId + ":" + (editingEntry?.class_subject_aspect_id || "")}
          >
            <option value="">Whole subject / no aspect</option>
            {availableAspects.map((a) => (
              <option key={a.id} value={a.id}>
                {a.aspect_name}{a.periods_per_week != null ? " · " + a.periods_per_week + "/week" : ""}
              </option>
            ))}
          </select>
          <small className="muted">
            This changes the lesson label only. Assessment remains on the main subject.
          </small>
        </div>

        <div className="field">
          <label>Day</label>
          <select name="day_of_week" defaultValue={String(editingEntry?.day_of_week || "")} required>
            <option value="">Choose...</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
          </select>
        </div>

        <div className="field">
          <label>Period</label>
          <select name="period_id" defaultValue={editingEntry?.period_id || ""} required>
            <option value="">Choose...</option>
            {periods.filter((p) => !p.is_break).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || "Period " + p.period_number} · {String(p.start_time).slice(0,5)}–{String(p.end_time).slice(0,5)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Room / Location</label>
          <input name="room_number" defaultValue={editingEntry?.room_number || ""} placeholder="e.g. JHS 2, ICT Lab" />
        </div>

        <div className="field">
          <label>Mode</label>
          <select name="mode" defaultValue={editingEntry?.mode || "onsite"}>
            <option value="onsite">Onsite</option>
            <option value="online">Online</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </div>

        <div className="field">
          <label>Meeting link</label>
          <input name="meeting_link" type="url" defaultValue={editingEntry?.meeting_link || ""} />
        </div>

        <div className="field span-2">
          <label>Notes</label>
          <input name="notes" defaultValue={editingEntry?.notes || ""} />
        </div>
      </div>

      <button className="button" type="submit">
        {editingEntry ? "Save Timetable Changes" : "Add Lesson"}
      </button>
    </form>
  );
}
