import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  saveFeedingRegisterAction,
  setFeedingLockAction,
} from "../actions";

function fullName(row: any) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

export default async function FeedingRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string; ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk", "staff"]);
  const params = await searchParams;
  const classId = params.class || "";
  const date = params.date || new Date().toISOString().slice(0, 10);

  if (!classId) notFound();

  const [{ data: cls }, { data: students }, { data: session }] = await Promise.all([
    supabase.from("classes").select("id,class_name,section").eq("id", classId).maybeSingle(),
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name,dietary_requirements,allergies")
      .eq("class_id", classId)
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
    supabase
      .from("feeding_sessions")
      .select("id,meal_name,unit_cost,supplier,notes,is_locked")
      .eq("class_id", classId)
      .eq("feeding_date", date)
      .eq("meal_name", "Lunch")
      .maybeSingle(),
  ]);

  if (!cls) notFound();

  const { data: existing } = session
    ? await supabase
        .from("feeding_records")
        .select("student_id,status,remark")
        .eq("feeding_session_id", session.id)
    : { data: [] as any[] };

  const recordMap = new Map((existing || []).map((row: any) => [row.student_id, row]));
  const canLock = profile.role === "admin" || profile.role === "supervisor";
  const classLabel = cls.class_name + (cls.section ? " / " + cls.section : "");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Feeding register</div>
          <h1>{classLabel}</h1>
          <p>{date} · {students?.length || 0} active students</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/feeding?date=" + date}>Back to Feeding</Link>
          {canLock && session ? (
            <form action={setFeedingLockAction}>
              <input type="hidden" name="session_id" value={session.id} />
              <input type="hidden" name="class_id" value={classId} />
              <input type="hidden" name="feeding_date" value={date} />
              <input type="hidden" name="locked" value={session.is_locked ? "false" : "true"} />
              <button className="button secondary" type="submit">
                {session.is_locked ? "Unlock Register" : "Lock Register"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {session?.is_locked ? <div className="notice">This feeding register is locked.</div> : null}

      {!students?.length ? (
        <div className="empty-state">
          <strong>No active students</strong>
          <p>This class has no active students to record for feeding.</p>
        </div>
      ) : (
        <form action={saveFeedingRegisterAction}>
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="feeding_date" value={date} />
          <input type="hidden" name="meal_name" value="Lunch" />

          <section className="card feeding-meta-form">
            <div className="field">
              <label>Meal</label>
              <input value="Lunch" readOnly />
            </div>
            <div className="field">
              <label>Cost per meal (GHS)</label>
              <input
                name="unit_cost"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(session?.unit_cost || 0).toFixed(2)}
                readOnly={Boolean(session?.is_locked)}
                required
              />
            </div>
            <div className="field">
              <label>Supplier / Caterer</label>
              <input name="supplier" defaultValue={session?.supplier || ""} readOnly={Boolean(session?.is_locked)} />
            </div>
            <div className="field">
              <label>Notes</label>
              <input name="notes" defaultValue={session?.notes || ""} readOnly={Boolean(session?.is_locked)} />
            </div>
          </section>

          <div className="table-wrap feeding-register-table">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Adm. No.</th><th>Student</th><th>Diet / Allergy</th><th>Feeding Status</th><th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {(students || []).map((student: any, index: number) => {
                  const record = recordMap.get(student.id) as any;
                  return (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td>{student.admission_number || "—"}</td>
                      <td><strong>{fullName(student)}</strong></td>
                      <td>
                        {student.dietary_requirements || student.allergies ? (
                          <span className="feeding-alert">
                            {[student.dietary_requirements, student.allergies].filter(Boolean).join(" · ")}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <select
                          name={"status_" + student.id}
                          defaultValue={record?.status || "fed"}
                          disabled={Boolean(session?.is_locked)}
                        >
                          <option value="fed">Fed</option>
                          <option value="not_fed">Not Fed</option>
                          <option value="exempt">Exempt</option>
                        </select>
                      </td>
                      <td>
                        <input
                          name={"remark_" + student.id}
                          defaultValue={record?.remark || ""}
                          placeholder="Optional"
                          disabled={Boolean(session?.is_locked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!session?.is_locked ? (
            <div className="form-actions">
              <button className="button" type="submit">Save Feeding Register</button>
            </div>
          ) : null}
        </form>
      )}
    </>
  );
}
