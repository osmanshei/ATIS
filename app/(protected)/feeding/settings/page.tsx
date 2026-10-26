import { requireProfile } from "@/lib/auth";
import {
  saveFeedingRateAction,
  saveStudentFeedingPlanAction,
} from "../actions";

function studentName(row: any) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

export default async function FeedingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; q?: string; ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "accountant", "clerk"]);
  const params = await searchParams;

  const { data: terms } = await supabase
    .from("terms")
    .select("id,name,is_current,academic_year_id,starts_on")
    .order("starts_on");

  const termId =
    params.term ||
    terms?.find((row: any) => row.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  const [{ data: classes }, { data: rates }, { data: staff }] = await Promise.all([
    supabase
      .from("classes")
      .select("id,class_name,section,grade_level")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
    supabase
      .from("feeding_rates")
      .select("*")
      .eq("term_id", termId),
    supabase
      .from("feeding_staff_directory")
      .select("id,full_name,employee_code,role")
      .eq("status", "active")
      .order("full_name"),
  ]);

  let studentQuery = supabase
    .from("students")
    .select("id,admission_number,first_name,middle_name,last_name,class_id")
    .eq("status", "active")
    .order("first_name")
    .limit(60);

  const q = String(params.q || "").trim();
  if (q) {
    const safe = q.replace(/,/g, " ");
    const filter =
      "admission_number.ilike.%" + safe + "%," +
      "first_name.ilike.%" + safe + "%," +
      "middle_name.ilike.%" + safe + "%," +
      "last_name.ilike.%" + safe + "%";
    studentQuery = studentQuery.or(filter);
  }

  const { data: students } = await studentQuery;
  const rateMap = new Map((rates || []).map((row: any) => [row.class_id, row]));
  const canConfigureRates = ["admin", "supervisor", "accountant"].includes(profile.role);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Feeding configuration</div>
          <h1>Rates, Plans & Exemptions</h1>
          <p>Configure daily, weekly, monthly and termly fees and identify staff or management children who are exempt.</p>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form className="term-switcher" method="get">
        <label>Term</label>
        <select name="term" defaultValue={termId}>
          {(terms || []).map((term: any) => (
            <option key={term.id} value={term.id}>
              {term.name}{term.is_current ? " · Current" : ""}
            </option>
          ))}
        </select>
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Class rates</div>
            <h2>Feeding fee schedule</h2>
          </div>
        </div>

        <div className="feeding-rate-grid">
          {(classes || []).map((cls: any) => {
            const rate = rateMap.get(cls.id) as any;
            return (
              <form className="card feeding-rate-card" action={saveFeedingRateAction} key={cls.id}>
                <input type="hidden" name="term_id" value={termId} />
                <input type="hidden" name="class_id" value={cls.id} />
                <div><strong>{cls.class_name}{cls.section ? " / " + cls.section : ""}</strong></div>
                <div className="field"><label>Daily</label><input name="daily_rate" type="number" min="0" step="0.01" defaultValue={rate?.daily_rate ?? 4} readOnly={!canConfigureRates} /></div>
                <div className="field"><label>Weekly</label><input name="weekly_rate" type="number" min="0" step="0.01" defaultValue={rate?.weekly_rate ?? 16} readOnly={!canConfigureRates} /></div>
                <div className="field"><label>Monthly</label><input name="monthly_rate" type="number" min="0" step="0.01" defaultValue={rate?.monthly_rate ?? 64} readOnly={!canConfigureRates} /></div>
                <div className="field"><label>Termly</label><input name="termly_rate" type="number" min="0" step="0.01" defaultValue={rate?.termly_rate ?? 236} readOnly={!canConfigureRates} /></div>
                {canConfigureRates ? <button className="button compact" type="submit">Save</button> : null}
              </form>
            );
          })}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Student plans</div>
            <h2>Payment frequency & exemptions</h2>
          </div>
        </div>

        <form className="roster-search-card" method="get">
          <input type="hidden" name="term" value={termId} />
          <div className="field">
            <label>Find student</label>
            <input name="q" defaultValue={q} placeholder="Name or admission number" />
          </div>
          <button className="button secondary compact" type="submit">Search</button>
        </form>

        <form className="card feeding-plan-form" action={saveStudentFeedingPlanAction}>
          <input type="hidden" name="term_id" value={termId} />
          <div className="field">
            <label>Student</label>
            <select name="student_id" required defaultValue="">
              <option value="" disabled>Select student</option>
              {(students || []).map((student: any) => (
                <option value={student.id} key={student.id}>
                  {student.admission_number || "—"} · {studentName(student)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Feeding plan</label>
            <select name="frequency" defaultValue="daily">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="termly">Termly</option>
              <option value="exempt">Exempt - Staff/Management Child</option>
            </select>
          </div>
          <div className="field">
            <label>Related staff member (for exemption)</label>
            <select name="related_staff_id" defaultValue="">
              <option value="">Not applicable / Other exemption</option>
              {(staff || []).map((row: any) => (
                <option key={row.id} value={row.id}>
                  {row.full_name} · {row.employee_code || row.role}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <input name="notes" />
          </div>
          <button className="button" type="submit">Save Feeding Plan</button>
        </form>
      </section>
    </>
  );
}
