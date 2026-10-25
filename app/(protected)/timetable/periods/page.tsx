import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { saveSchoolPeriodAction } from "../actions";

function timeValue(value: string | null | undefined) {
  return value ? String(value).slice(0, 5) : "";
}

export default async function TimetablePeriodsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; ok?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const query = await searchParams;

  const { data: years } = await supabase
    .from("academic_years")
    .select("id,name,is_current,starts_on")
    .order("starts_on", { ascending: false });

  const selectedYearId =
    (years || []).find((y: any) => y.id === query.year)?.id ||
    (years || []).find((y: any) => y.is_current)?.id ||
    (years || [])[0]?.id ||
    "";

  const { data: periods, error } = selectedYearId
    ? await supabase
        .from("school_periods")
        .select(
          "id,academic_year_id,period_number,start_time,end_time,is_break,label,display_order,day_type,is_active",
        )
        .eq("academic_year_id", selectedYearId)
        .eq("day_type", "regular")
        .order("display_order")
        .order("start_time")
    : { data: [] as any[], error: null };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Timetable setup</div>
          <h1>School Periods</h1>
          <p>Define teaching periods and breaks for each academic year.</p>
        </div>
        <Link className="button secondary" href="/timetable">Back to Timetable</Link>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}

      <form className="form-card period-year-filter" method="get">
        <div className="field">
          <label>Academic year</label>
          <select name="year" defaultValue={selectedYearId}>
            {(years || []).map((year: any) => (
              <option key={year.id} value={year.id}>
                {year.name}{year.is_current ? " · Current" : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="button secondary" type="submit">View</button>
      </form>

      {selectedYearId ? (
        <form className="form-card period-create-form" action={saveSchoolPeriodAction}>
          <input type="hidden" name="academic_year_id" value={selectedYearId} />
          <input type="hidden" name="day_type" value="regular" />
          <h2 className="section-title">Add Period or Break</h2>
          <div className="period-form-grid">
            <div className="field">
              <label>Period number</label>
              <input name="period_number" type="number" min="1" max="30" required />
            </div>
            <div className="field">
              <label>Label</label>
              <input name="label" placeholder="Period 1 / Break / Lunch" />
            </div>
            <div className="field">
              <label>Start</label>
              <input name="start_time" type="time" required />
            </div>
            <div className="field">
              <label>End</label>
              <input name="end_time" type="time" required />
            </div>
            <div className="field">
              <label>Display order</label>
              <input name="display_order" type="number" min="1" max="99" />
            </div>
            <label className="checkbox-field compact-check">
              <input name="is_break" type="checkbox" /> Break / non-teaching slot
            </label>
            <label className="checkbox-field compact-check">
              <input name="is_active" type="checkbox" defaultChecked /> Active
            </label>
          </div>
          <button className="button" type="submit">Add Period</button>
        </form>
      ) : null}

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Daily structure</div>
            <h2>Configured Periods</h2>
          </div>
          <span className="tag">{periods?.length || 0} slots</span>
        </div>

        <div className="period-edit-list">
          {(periods || []).map((p: any) => (
            <form className="period-edit-row" action={saveSchoolPeriodAction} key={p.id}>
              <input type="hidden" name="period_id" value={p.id} />
              <input type="hidden" name="academic_year_id" value={selectedYearId} />
              <input type="hidden" name="day_type" value={p.day_type || "regular"} />
              <div className="field small-field">
                <label>No.</label>
                <input name="period_number" type="number" min="1" max="30" defaultValue={p.period_number} required />
              </div>
              <div className="field">
                <label>Label</label>
                <input name="label" defaultValue={p.label || ""} />
              </div>
              <div className="field">
                <label>Start</label>
                <input name="start_time" type="time" defaultValue={timeValue(p.start_time)} required />
              </div>
              <div className="field">
                <label>End</label>
                <input name="end_time" type="time" defaultValue={timeValue(p.end_time)} required />
              </div>
              <div className="field small-field">
                <label>Order</label>
                <input name="display_order" type="number" min="1" max="99" defaultValue={p.display_order} />
              </div>
              <label className="checkbox-field compact-check">
                <input name="is_break" type="checkbox" defaultChecked={p.is_break} /> Break
              </label>
              <label className="checkbox-field compact-check">
                <input name="is_active" type="checkbox" defaultChecked={p.is_active} /> Active
              </label>
              <button className="button secondary compact" type="submit">Save</button>
            </form>
          ))}
          {!periods?.length ? (
            <div className="empty-state">
              <strong>No periods configured</strong>
              <p>Add the school-day periods above. Break periods are shown on the timetable but cannot receive lessons.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
