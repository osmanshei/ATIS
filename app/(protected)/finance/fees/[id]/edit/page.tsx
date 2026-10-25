import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { updateFeeItemAction } from "../../actions";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function EditFeeItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const [{ data: item }, { data: terms }, { data: classes }] = await Promise.all([
    supabase.from("fee_items").select("*").eq("id", id).single(),
    supabase.from("terms").select("id,name,is_current,starts_on").order("starts_on"),
    supabase.from("classes").select("id,class_name,section,is_active").order("class_name"),
  ]);

  if (!item) notFound();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Finance · fee structure</div>
          <h1>Edit Fee Item</h1>
          <p>{item.fee_name} · {money(item.amount)}</p>
        </div>
        <Link className="button secondary" href={"/finance/fees?term=" + item.term_id}>Back to fee setup</Link>
      </div>

      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form className="form-card" action={updateFeeItemAction}>
        <input type="hidden" name="fee_item_id" value={item.id} />

        <div className="field">
          <label>Term</label>
          <select name="term_id" defaultValue={item.term_id} required>
            {(terms || []).map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? " · Current" : ""}</option>)}
          </select>
        </div>

        <div className="fee-scope-box">
          <label className="checkbox-field">
            <input name="applies_to_all_students" type="checkbox" defaultChecked={Boolean(item.applies_to_all_students)} />
            <span><strong>Applies to all students</strong><small>When enabled, matching same-name class-specific fees will be deactivated automatically to prevent double billing.</small></span>
          </label>
        </div>

        <div className="field">
          <label>Class — for class-specific fees only</label>
          <select name="class_id" defaultValue={item.class_id || ""}>
            <option value="">No class / school-wide</option>
            {(classes || []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.class_name}{c.section ? " / " + c.section : ""}{!c.is_active ? " · Inactive" : ""}</option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="field"><label>Fee name</label><input name="fee_name" defaultValue={item.fee_name || ""} required /></div>
          <div className="field">
            <label>Category</label>
            <select name="fee_category" defaultValue={item.fee_category || "school_fee"}>
              <option value="school_fee">School Fee</option><option value="tuition">Tuition</option>
              <option value="books">Books</option><option value="uniform">Uniform</option>
              <option value="transport">Transport</option><option value="activity">Activity</option><option value="other">Other</option>
            </select>
          </div>
          <div className="field"><label>Amount (GHS)</label><input name="amount" type="number" min="0" step="0.01" defaultValue={item.amount ?? 0} required /></div>
          <div className="field"><label>Due date</label><input name="due_date" type="date" defaultValue={item.due_date || ""} /></div>
        </div>
        <label className="checkbox-field"><input name="is_concession_eligible" type="checkbox" defaultChecked={Boolean(item.is_concession_eligible)} /> Apply student concession to this fee</label>
        <label className="checkbox-field"><input name="is_active" type="checkbox" defaultChecked={Boolean(item.is_active)} /> Active fee item</label>
        <div className="field"><label>Notes</label><textarea name="notes" rows={3} defaultValue={item.notes || ""} /></div>

        <div className="action-row">
          <button className="button" type="submit">Save Fee Changes</button>
          <Link className="button secondary" href={"/finance/fees?term=" + item.term_id}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
