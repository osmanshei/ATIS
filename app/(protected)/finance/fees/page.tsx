import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { saveFeeItemAction } from "../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function FeeSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; class?: string; ok?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const params = await searchParams;

  const [{ data: terms }, { data: classes }] = await Promise.all([
    supabase.from("terms").select("id,name,is_current,starts_on").order("starts_on"),
    supabase
      .from("classes")
      .select("id,class_name,section,grade_level")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
  ]);

  const termId =
    params.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";
  const classId = params.class || "";

  const { data: allItems } = await supabase
    .from("fee_items")
    .select(
      "id,class_id,applies_to_all_students,fee_name,fee_category,amount,due_date,is_concession_eligible,is_active,notes",
    )
    .eq("term_id", termId)
    .order("fee_name");

  const items = classId
    ? (allItems || []).filter(
        (item: any) => item.applies_to_all_students || item.class_id === classId,
      )
    : allItems || [];

  const classMap = new Map((classes || []).map((c: any) => [c.id, c]));
  const globalCount = (allItems || []).filter((x: any) => x.applies_to_all_students).length;
  const classFeeCount = (allItems || []).filter((x: any) => !x.applies_to_all_students).length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · fee structure</div>
          <h1>Fee Setup</h1>
          <p>
            Create school-wide fees once for every learner, then add class-specific fees only where needed.
          </p>
        </div>
        <Link className="button secondary" href={"/finance?term=" + termId}>Back to finance</Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <div className="teacher-summary-grid">
        <div className="metric-card">
          <span className="metric-kicker">School-wide fees</span>
          <strong>{globalCount}</strong>
          <small>Automatically charged to every active student</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Class-specific fees</span>
          <strong>{classFeeCount}</strong>
          <small>Charged only to the selected class</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Total fee items</span>
          <strong>{allItems?.length || 0}</strong>
          <small>Active and inactive items in this term</small>
        </div>
      </div>

      <div className="grid-2">
        <form className="form-card" action={saveFeeItemAction}>
          <h2 className="section-title">Add / update fee item</h2>

          <div className="field">
            <label>Term</label>
            <select name="term_id" defaultValue={termId} required>
              {(terms || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_current ? " · Current" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="fee-scope-box">
            <label className="checkbox-field">
              <input name="applies_to_all_students" type="checkbox" />
              <span>
                <strong>Applies to all students</strong>
                <small>ATIS will add this fee automatically to every active learner for the term.</small>
              </span>
            </label>
          </div>

          <div className="field">
            <label>Class — only for class-specific fees</label>
            <select name="class_id">
              <option value="">Choose a class if this is not a school-wide fee</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}{c.section ? " / " + c.section : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Fee name</label>
              <input name="fee_name" placeholder="e.g. PTA Levy" required />
            </div>
            <div className="field">
              <label>Category</label>
              <select name="fee_category" defaultValue="school_fee">
                <option value="school_fee">School Fee</option>
                <option value="tuition">Tuition</option>
                <option value="books">Books</option>
                <option value="uniform">Uniform</option>
                <option value="transport">Transport</option>
                <option value="activity">Activity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Amount (GHS)</label>
              <input name="amount" type="number" min="0" step="0.01" required />
            </div>
            <div className="field">
              <label>Due date</label>
              <input name="due_date" type="date" />
            </div>
          </div>

          <label className="checkbox-field">
            <input name="is_concession_eligible" type="checkbox" />
            Apply student concession percentage to this fee
          </label>

          <div className="field">
            <label>Notes</label>
            <textarea name="notes" rows={2} />
          </div>

          <button className="button" type="submit">Save fee item</button>
        </form>

        <form className="form-card" method="get">
          <h2 className="section-title">Filter fee structure</h2>
          <div className="field">
            <label>Term</label>
            <select name="term" defaultValue={termId}>
              {(terms || []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_current ? " · Current" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Class</label>
            <select name="class" defaultValue={classId}>
              <option value="">All fee items</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}{c.section ? " / " + c.section : ""}
                </option>
              ))}
            </select>
            <small className="muted">A class filter also shows school-wide fees because they apply to that class.</small>
          </div>
          <button className="button secondary" type="submit">Apply filter</button>
        </form>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scope</th><th>Fee Item</th><th>Category</th><th>Amount</th>
              <th>Due Date</th><th>Concession</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const cls = classMap.get(item.class_id) as any;
              return (
                <tr key={item.id}>
                  <td>
                    {item.applies_to_all_students ? (
                      <span className="tag">All Students</span>
                    ) : (
                      <span className="tag gray">
                        {cls?.class_name || "Class"}{cls?.section ? " / " + cls.section : ""}
                      </span>
                    )}
                  </td>
                  <td><strong>{item.fee_name}</strong></td>
                  <td>{String(item.fee_category || "").replaceAll("_", " ")}</td>
                  <td><strong>{money(item.amount)}</strong></td>
                  <td>{item.due_date || "—"}</td>
                  <td>{item.is_concession_eligible ? <span className="tag">Eligible</span> : <span className="tag gray">No</span>}</td>
                  <td><span className={item.is_active ? "tag" : "tag gray"}>{item.is_active ? "Active" : "Inactive"}</span></td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr><td colSpan={7} className="muted">No fee items configured for this selection.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
