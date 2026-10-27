"use client";

import { useMemo, useState } from "react";
import { createTeacherAssignmentAction } from "@/app/(protected)/teacher-assignments/actions";

type Teacher = {
  id: string;
  full_name: string;
  employee_code: string | null;
};

type ClassRow = {
  id: string;
  class_name: string;
  section: string | null;
};

type ClassSubject = {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string | null;
};

export function TeacherAssignmentForm({
  teachers,
  classes,
  classSubjects,
}: {
  teachers: Teacher[];
  classes: ClassRow[];
  classSubjects: ClassSubject[];
}) {
  const [classId, setClassId] = useState("");

  const subjects = useMemo(
    () => classSubjects.filter((row) => row.class_id === classId),
    [classId, classSubjects],
  );

  return (
    <form className="form-card teacher-assignment-bundle" action={createTeacherAssignmentAction}>
      <div className="field">
        <label>Teacher</label>
        <select name="teacher_id" required defaultValue="">
          <option value="" disabled>Select teacher</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.full_name}
              {teacher.employee_code ? " (" + teacher.employee_code + ")" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Class</label>
        <select
          name="class_id"
          required
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">Select class</option>
          {classes.map((row) => (
            <option key={row.id} value={row.id}>
              {row.class_name}{row.section ? " / " + row.section : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="teacher-subject-picker">
        <label>Subject / Subjects</label>
        {!classId ? (
          <div className="muted">Select a class to show its subjects.</div>
        ) : subjects.length ? (
          <div className="teacher-subject-options">
            {subjects.map((subject) => (
              <label className="subject-check-card" key={subject.id}>
                <input type="checkbox" name="subject_ids" value={subject.subject_id} />
                <span>
                  <strong>{subject.subject_name}</strong>
                  {subject.subject_code ? <small>{subject.subject_code}</small> : null}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="notice">No subjects have been configured for this class yet.</div>
        )}
      </div>

      <label className="class-teacher-toggle">
        <input name="is_class_teacher" type="checkbox" />
        <span>
          <strong>Class Teacher</strong>
          <small>Make this teacher responsible for the selected class.</small>
        </span>
      </label>

      <button className="button" type="submit" disabled={!classId || !subjects.length}>
        Save Teacher Assignment
      </button>
    </form>
  );
}
