import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;
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
      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Admission No.</th><th>Student</th><th>Gender</th><th>Date of birth</th><th>Class</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.admission_number || "—"}</td>
                <td><strong>{[r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ")}</strong></td>
                <td>{r.gender || "—"}</td>
                <td>{r.date_of_birth || "—"}</td>
                <td>{r.classes ? `${r.classes.class_name}${r.classes.section ? ` / ${r.classes.section}` : ""}` : "Unassigned"}</td>
                <td><span className="tag gray">{r.status}</span></td>
                <td><Link className="button secondary compact" href={"/students/" + r.id + "/edit"}>Edit</Link></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="muted">No students have been migrated yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
