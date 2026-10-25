"use client";

import { useMemo, useState } from "react";
import {
  saveCaScoresAction,
  saveExamScoresAction,
} from "@/app/(protected)/assessments/actions";

type StudentRow = {
  id: string;
  admission_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type ScoreRow = {
  student_id: string;
  raw_score: number | null;
  is_absent: boolean;
  remark: string | null;
};

export function ScoreEntryGrid({
  mode,
  setupId,
  assessmentId,
  maxMark,
  students,
  initialScores,
  locked = false,
}: {
  mode: "ca" | "exam";
  setupId: string;
  assessmentId?: string;
  maxMark: number;
  students: StudentRow[];
  initialScores: ScoreRow[];
  locked?: boolean;
}) {
  const initial = new Map(initialScores.map((s) => [s.student_id, s]));

  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(
      students.map((s) => [
        s.id,
        initial.get(s.id)?.raw_score === null || initial.get(s.id)?.raw_score === undefined
          ? ""
          : String(initial.get(s.id)?.raw_score),
      ]),
    ),
  );
  const [absent, setAbsent] = useState<Record<string, boolean>>(
    Object.fromEntries(students.map((s) => [s.id, Boolean(initial.get(s.id)?.is_absent)])),
  );
  const [remarks, setRemarks] = useState<Record<string, string>>(
    Object.fromEntries(students.map((s) => [s.id, initial.get(s.id)?.remark || ""])),
  );

  const entered = useMemo(
    () =>
      students.filter(
        (s) =>
          absent[s.id] ||
          (scores[s.id] !== undefined &&
            scores[s.id] !== "" &&
            !Number.isNaN(Number(scores[s.id]))),
      ).length,
    [students, absent, scores],
  );

  const records = students.map((student) => ({
    student_id: student.id,
    raw_score: absent[student.id] ? "" : scores[student.id] || "",
    is_absent: Boolean(absent[student.id]),
    remark: remarks[student.id] || "",
  }));

  const action = mode === "ca" ? saveCaScoresAction : saveExamScoresAction;

  return (
    <form action={action}>
      <input type="hidden" name="setup_id" value={setupId} />
      {assessmentId ? <input type="hidden" name="assessment_id" value={assessmentId} /> : null}
      {mode === "exam" ? <input type="hidden" name="max_mark" value={maxMark} /> : null}
      <input type="hidden" name="records_json" value={JSON.stringify(records)} />

      <div className="score-toolbar">
        <div>
          <span className="metric-kicker">Score entry</span>
          <strong>{entered} / {students.length}</strong>
          <small>Maximum mark: {maxMark}</small>
        </div>
        {!locked ? <button className="button" type="submit">Save scores</button> : null}
      </div>

      <div className="score-list">
        {students.map((student, index) => {
          const fullName = [student.first_name, student.middle_name, student.last_name]
            .filter(Boolean)
            .join(" ");
          const isAbsent = Boolean(absent[student.id]);

          return (
            <article className="score-row" key={student.id}>
              <div className="score-student">
                <span className="attendance-number">{index + 1}</span>
                <div>
                  <strong>{fullName}</strong>
                  <small>{student.admission_number || "No admission number"}</small>
                </div>
              </div>

              <div className="field score-input">
                <label>Score</label>
                <input
                  type="number"
                  min="0"
                  max={maxMark}
                  step="0.01"
                  value={scores[student.id] || ""}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [student.id]: e.target.value }))
                  }
                  disabled={locked || isAbsent}
                  required={!isAbsent}
                />
              </div>

              <label className="score-absent">
                <input
                  type="checkbox"
                  checked={isAbsent}
                  onChange={(e) =>
                    setAbsent((prev) => ({ ...prev, [student.id]: e.target.checked }))
                  }
                  disabled={locked}
                />
                Absent
              </label>

              <div className="field score-remark">
                <label>Remark</label>
                <input
                  value={remarks[student.id] || ""}
                  onChange={(e) =>
                    setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))
                  }
                  placeholder="Optional"
                  disabled={locked}
                />
              </div>
            </article>
          );
        })}
      </div>

      {locked ? (
        <div className="notice">This subject setup is locked. Scores cannot be changed.</div>
      ) : null}
    </form>
  );
}
