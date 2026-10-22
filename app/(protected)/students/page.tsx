import { requireProfile } from "@/lib/auth";

export default async function StudentsPage() {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher", "clerk"]);
  const { data, error } = await supabase
    .from("students")
    .select("id,admission_number,first_name,middle_name,last_name,gender,date_of_birth,status,classes(class_name,section)")
    .order("first_name")
    .limit(300);

  const rows = (data || []) as any[];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Students</h1>
          <p>Core student roster with class relationships enforced by PostgreSQL.</p>
        </div>
        <span className="tag">{rows.length} loaded</span>
      </div>
      {error ? <div className="notice error">{error.message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Admission No.</th><th>Student</th><th>Gender</th><th>Date of birth</th><th>Class</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.admission_number || "—"}</td>
                <td><strong>{[r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ")}</strong></td>
                <td>{r.gender || "—"}</td>
                <td>{r.date_of_birth || "—"}</td>
                <td>{r.classes ? `${r.classes.class_name}${r.classes.section ? ` / ${r.classes.section}` : ""}` : "Unassigned"}</td>
                <td><span className="tag gray">{r.status}</span></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="muted">No students have been migrated yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
