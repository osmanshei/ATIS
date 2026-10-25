import { requireProfile } from "@/lib/auth";
import { createClassAction } from "./actions";

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;
  const { data, error } = await supabase
    .from("class_summary")
    .select("id,class_name,section,grade_level,class_code,max_capacity,room_number,is_active,total_strength")
    .order("grade_level", { nullsFirst: true })
    .order("class_name");
  const rows = (data || []) as any[];
  const canEdit = ["admin", "supervisor"].includes(profile.role);

  return (
    <>
      <div className="page-head"><div><h1>Classes & Sections</h1><p>Section is optional. Strength is calculated from active student records.</p></div></div>
      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {canEdit ? (
        <form className="form-card form-grid" action={createClassAction}>
          <div className="field"><label>Class name</label><input name="class_name" placeholder="e.g. BASIC SEVEN" required /></div>
          <div className="field"><label>Section (optional)</label><input name="section" placeholder="A / B / blank" /></div>
          <div className="field"><label>Grade level</label><input name="grade_level" type="number" min="0" max="20" /></div>
          <div className="field"><label>Max capacity</label><input name="max_capacity" type="number" min="1" /></div>
          <button className="button" type="submit">Add class</button>
        </form>
      ) : null}
      {error ? <div className="notice error">{error.message}</div> : null}
      <div className="table-wrap"><table>
        <thead><tr><th>Class</th><th>Section</th><th>Grade</th><th>Strength</th><th>Capacity</th><th>Room</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}><td><strong>{r.class_name}</strong></td><td>{r.section || "—"}</td><td>{r.grade_level ?? "—"}</td><td>{r.total_strength}</td><td>{r.max_capacity ?? "—"}</td><td>{r.room_number || "—"}</td><td>{r.is_active ? "Active" : "Inactive"}</td></tr>)}
          {!rows.length ? <tr><td colSpan={7} className="muted">No classes yet.</td></tr> : null}
        </tbody>
      </table></div>
    </>
  );
}
