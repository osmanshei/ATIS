"use client";

import { useMemo, useState } from "react";
import { saveAllCaScoresAction } from "@/app/(protected)/assessments/actions";

type Student = {
  id: string;
  admission_number: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type Assessment = {
  id: string;
  component: string;
  assessment_no: number;
  assessment_name: string;
  max_mark: number;
  status: string;
};

type Score = {
  assessment_id: string;
  student_id: string;
  raw_score: number | null;
  is_absent: boolean;
  remark: string | null;
};

type Cell = { score: string; absent: boolean; remark: string };

const componentOrder = ["class_exercise", "homework", "class_test"];
const componentLabels: Record<string, string> = {
  class_exercise: "Class Exercises",
  homework: "Homework",
  class_test: "Class Tests",
};

function cellKey(assessmentId: string, studentId: string) {
  return assessmentId + ":" + studentId;
}

function studentName(student: Student) {
  return [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
}

export function CaScoreMatrix({
  setupId,
  caWeight,
  caMaxMark,
  assessments,
  students,
  initialScores,
  locked = false,
}: {
  setupId: string;
  caWeight: number;
  caMaxMark: number;
  assessments: Assessment[];
  students: Student[];
  initialScores: Score[];
  locked?: boolean;
}) {
  const initialCells = useMemo(() => {
    const result: Record<string, Cell> = {};
    for (const score of initialScores) {
      result[cellKey(score.assessment_id, score.student_id)] = {
        score: score.raw_score === null || score.raw_score === undefined ? "" : String(score.raw_score),
        absent: Boolean(score.is_absent),
        remark: score.remark || "",
      };
    }
    return result;
  }, [initialScores]);

  const [cells, setCells] = useState<Record<string, Cell>>(initialCells);

  const orderedAssessments = useMemo(
    () =>
      [...assessments].sort((a, b) => {
        const aOrder = componentOrder.indexOf(a.component);
        const bOrder = componentOrder.indexOf(b.component);
        return (aOrder < 0 ? 99 : aOrder) - (bOrder < 0 ? 99 : bOrder) ||
          a.assessment_no - b.assessment_no;
      }),
    [assessments],
  );

  const groups = useMemo(
    () =>
      componentOrder
        .map((component) => ({
          component,
          label: componentLabels[component],
          assessments: orderedAssessments.filter((assessment) => assessment.component === component),
        }))
        .filter((group) => group.assessments.length > 0),
    [orderedAssessments],
  );

  const rawMaximum = orderedAssessments.reduce(
    (sum, assessment) => sum + Number(assessment.max_mark || 0),
    0,
  );

  const summary = useMemo(() => {
    return students.map((student) => {
      let total = 0;
      let complete = orderedAssessments.length > 0;
      let entered = 0;

      for (const assessment of orderedAssessments) {
        const cell = cells[cellKey(assessment.id, student.id)] || { score: "", absent: false, remark: "" };
        if (cell.absent) {
          entered += 1;
          continue;
        }
        if (cell.score.trim() === "") {
          complete = false;
          continue;
        }
        const value = Number(cell.score);
        if (!Number.isFinite(value) || value < 0 || value > Number(assessment.max_mark)) {
          complete = false;
          continue;
        }
        total += value;
        entered += 1;
      }

      return {
        studentId: student.id,
        total,
        complete,
        entered,
        converted: complete && caMaxMark > 0 ? (total / caMaxMark) * caWeight : null,
      };
    });
  }, [students, orderedAssessments, cells, caMaxMark, caWeight]);

  const summaryByStudent = new Map(summary.map((row) => [row.studentId, row]));

  const records = orderedAssessments.map((assessment) => ({
    assessment_id: assessment.id,
    records: students.map((student) => {
      const cell = cells[cellKey(assessment.id, student.id)] || { score: "", absent: false, remark: "" };
      return {
        student_id: student.id,
        raw_score: cell.absent ? "" : cell.score,
        is_absent: cell.absent,
        remark: cell.remark,
      };
    }),
  }));

  function updateCell(assessmentId: string, studentId: string, patch: Partial<Cell>) {
    const key = cellKey(assessmentId, studentId);
    setCells((current) => {
      const existing = current[key] ?? { score: "", absent: false, remark: "" };
      return {
        ...current,
        [key]: { ...existing, ...patch },
      };
    });
  }

  function scoreInput(student: Student, assessment: Assessment) {
    const cell = cells[cellKey(assessment.id, student.id)] || { score: "", absent: false, remark: "" };
    const name = studentName(student);

    return (
      <>
        <input
          aria-label={name + " " + assessment.assessment_name + " score"}
          type="number"
          min="0"
          max={assessment.max_mark}
          step="0.01"
          value={cell.score}
          disabled={locked || cell.absent}
          onChange={(event) => updateCell(assessment.id, student.id, { score: event.target.value })}
        />
        <label className="ca-absent-toggle">
          <input
            type="checkbox"
            checked={cell.absent}
            disabled={locked}
            onChange={(event) =>
              updateCell(assessment.id, student.id, {
                absent: event.target.checked,
                score: event.target.checked ? "" : cell.score,
              })
            }
          />
          Absent
        </label>
      </>
    );
  }

  return (
    <form action={saveAllCaScoresAction}>
      <input type="hidden" name="setup_id" value={setupId} />
      <input type="hidden" name="records_json" value={JSON.stringify(records)} />

      <div className="score-toolbar">
        <div>
          <span className="metric-kicker">CA scorebook</span>
          <strong>{orderedAssessments.length} assessments · {students.length} students</strong>
          <small>Raw maximum: {rawMaximum} · CA maximum: {caMaxMark} · CA contribution: {caWeight} marks</small>
        </div>
        {!locked ? <button className="button" type="submit" disabled={!orderedAssessments.length}>Save all CA scores</button> : null}
      </div>

      <p className="muted">
        Enter marks in the 13 assessment columns. Blank cells are skipped when saving, so you can
        complete the scorebook gradually and previously saved marks remain unchanged. Enter 0 for a
        genuine zero. Use Absent only when the learner missed that assessment. Raw totals and the
        converted CA score update automatically.
      </p>

      {!orderedAssessments.length ? (
        <div className="notice">The standard CA scorebook has not been prepared for this subject. Management can prepare all subjects together from the Assessments page.</div>
      ) : (
        <>
          <div className="table-wrap ca-scorebook-desktop">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>#</th>
                  <th rowSpan={2}>Student</th>
                  {groups.map((group) => (
                    <th key={group.component} colSpan={group.assessments.length}>{group.label}</th>
                  ))}
                  <th rowSpan={2}>Raw total</th>
                  <th rowSpan={2}>CA / {caWeight}</th>
                </tr>
                <tr>
                  {orderedAssessments.map((assessment) => (
                    <th key={assessment.id}>
                      {assessment.assessment_name}
                      <br />
                      <small>/{assessment.max_mark}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => {
                  const fullName = studentName(student);
                  const row = summaryByStudent.get(student.id);
                  return (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td><strong>{fullName}</strong><br /><small>{student.admission_number || "No admission number"}</small></td>
                      {orderedAssessments.map((assessment) => (
                        <td className="ca-score-cell" key={assessment.id}>
                          {scoreInput(student, assessment)}
                        </td>
                      ))}
                      <td>{row?.complete ? row.total.toFixed(2) : row?.entered + "/" + orderedAssessments.length}</td>
                      <td><strong>{row?.converted === null || row?.converted === undefined ? "Incomplete" : row.converted.toFixed(2)}</strong></td>
                    </tr>
                  );
                })}
                {!students.length ? <tr><td colSpan={orderedAssessments.length + 4}>No active students found in this class.</td></tr> : null}
              </tbody>
            </table>
          </div>

          <div className="ca-scorebook-mobile">
            {students.map((student, index) => {
              const fullName = studentName(student);
              const row = summaryByStudent.get(student.id);
              return (
                <details className="ca-mobile-student" key={student.id}>
                  <summary>
                    <span>
                      <strong>{index + 1}. {fullName}</strong>
                      <small>{student.admission_number || "No admission number"}</small>
                    </span>
                    <span className="ca-mobile-total">
                      <strong>{row?.converted === null || row?.converted === undefined ? "Incomplete" : row.converted.toFixed(2) + " / " + caWeight}</strong>
                      <small>{row?.complete ? "CA score" : (row?.entered || 0) + "/" + orderedAssessments.length + " entered"}</small>
                    </span>
                  </summary>
                  <div className="ca-mobile-student-body">
                    {groups.map((group) => (
                      <section className="ca-mobile-group" key={group.component}>
                        <h3>{group.label}</h3>
                        <div className="ca-mobile-fields">
                          {group.assessments.map((assessment) => (
                            <div className="ca-mobile-field" key={assessment.id}>
                              <label>{assessment.assessment_name} / {assessment.max_mark}</label>
                              {scoreInput(student, assessment)}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                    <div className="ca-mobile-raw-total">
                      <span>Raw total</span>
                      <strong>{row?.complete ? row.total.toFixed(2) : "Incomplete"}</strong>
                    </div>
                  </div>
                </details>
              );
            })}
            {!students.length ? <div className="empty-state">No active students found in this class.</div> : null}
          </div>
        </>
      )}

      {locked ? <div className="notice">This subject setup is locked. Scores cannot be changed.</div> : null}
    </form>
  );
}
