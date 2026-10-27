"use client";

import { Fragment, useMemo, useState } from "react";
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

function cellKey(assessmentId: string, studentId: string) {
  return assessmentId + ":" + studentId;
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
  const rawMaximum = assessments.reduce((sum, assessment) => sum + Number(assessment.max_mark || 0), 0);

  const summary = useMemo(() => {
    return students.map((student) => {
      let total = 0;
      let complete = assessments.length > 0;
      let entered = 0;
      for (const assessment of assessments) {
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
        converted: complete && rawMaximum > 0 ? (total / caMaxMark) * caWeight : null,
      };
    });
  }, [students, assessments, cells, rawMaximum, caWeight]);

  const records = assessments.map((assessment) => ({
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
    setCells((current) => ({
      ...current,
      [key]: { score: "", absent: false, remark: "", ...current[key], ...patch },
    }));
  }

  return (
    <form action={saveAllCaScoresAction}>
      <input type="hidden" name="setup_id" value={setupId} />
      <input type="hidden" name="records_json" value={JSON.stringify(records)} />

      <div className="score-toolbar">
        <div>
          <span className="metric-kicker">CA scorebook</span>
          <strong>{assessments.length} assessments · {students.length} students</strong>
          <small>Raw maximum: {rawMaximum} · Configured CA maximum: {caMaxMark} · CA contribution: {caWeight} marks</small>
        </div>
        {!locked ? <button className="button" type="submit" disabled={!assessments.length}>Save all CA scores</button> : null}
      </div>

      <p className="muted">
        Enter a score in each assessment column. Leave a score blank if it has not been entered yet;
        enter 0 for a genuine zero. Tick Absent only when the learner was absent. The CA total converts
        automatically to the configured CA weight once all assessment cells are complete.
      </p>

      {!assessments.length ? (
        <div className="notice">Create the standard 13 CA slots on the subject page before entering scores.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th rowSpan={2}>#</th>
                <th rowSpan={2}>Student</th>
                {assessments.map((assessment) => (
                  <th key={assessment.id} colSpan={2}>
                    {assessment.assessment_name}
                    <br />
                    <small>{assessment.max_mark} marks</small>
                  </th>
                ))}
                <th rowSpan={2}>Raw total</th>
                <th rowSpan={2}>CA / {caWeight}</th>
              </tr>
              <tr>
                {assessments.map((assessment) => (
                  <Fragment key={assessment.id}>
                    <th>Score / Absent</th>
                    <th>Remark</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => {
                const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ");
                const row = summary.find((item) => item.studentId === student.id);
                return (
                  <tr key={student.id}>
                    <td>{index + 1}</td>
                    <td><strong>{fullName}</strong><br /><small>{student.admission_number || "No admission number"}</small></td>
                    {assessments.map((assessment) => {
                      const cell = cells[cellKey(assessment.id, student.id)] || { score: "", absent: false, remark: "" };
                      return (
                        <td key={assessment.id} style={{ minWidth: 120 }}>
                          <input
                            aria-label={fullName + " " + assessment.assessment_name + " score"}
                            type="number"
                            min="0"
                            max={assessment.max_mark}
                            step="0.01"
                            value={cell.score}
                            disabled={locked || cell.absent}
                            onChange={(event) => updateCell(assessment.id, student.id, { score: event.target.value })}
                            style={{ width: 88 }}
                          />
                          <label style={{ display: "block", fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={cell.absent}
                              disabled={locked}
                              onChange={(event) => updateCell(assessment.id, student.id, { absent: event.target.checked, score: "" })}
                            /> Absent
                          </label>
                        </td>
                      );
                    })}
                    {assessments.map((assessment) => {
                      const cell = cells[cellKey(assessment.id, student.id)] || { score: "", absent: false, remark: "" };
                      return (
                        <td key={assessment.id + "-remark"} style={{ minWidth: 140 }}>
                          <input
                            aria-label={fullName + " " + assessment.assessment_name + " remark"}
                            value={cell.remark}
                            disabled={locked}
                            placeholder="Optional"
                            onChange={(event) => updateCell(assessment.id, student.id, { remark: event.target.value })}
                            style={{ width: 120 }}
                          />
                        </td>
                      );
                    })}
                    <td>{row?.complete ? row.total.toFixed(2) : row?.entered + "/" + assessments.length}</td>
                    <td><strong>{row?.converted === null || row?.converted === undefined ? "Incomplete" : row.converted.toFixed(2)}</strong></td>
                  </tr>
                );
              })}
              {!students.length ? <tr><td colSpan={assessments.length * 2 + 4}>No active students found in this class.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
      {locked ? <div className="notice">This subject setup is locked. Scores cannot be changed.</div> : null}
    </form>
  );
}
