import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function SectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;

  const { data: classes, error } = await supabase
    .from("classes")
    .select("id,class_name,section,grade_level,room_number,is_active,class_teacher_id")
    .order("grade_level", { nullsFirst: true })
    .order("class_name")
    .order("section");

  const rows = (classes || []) as any[];
  const teacherIds = [...new Set(rows.map((row) => row.class_teacher_id).filter(Boolean))] as string[];
  const { data: teachers } = teacherIds.length
    ? await supabase.from("staff").select("id,full_name").in("id", teacherIds)
    : { data: [] as any[] };
  const teacherNames = new Map<string, string>(
    (teachers || []).map((teacher: any) => [String(teacher.id), String(teacher.full_name)] as [string, string]),
  );

  const activeClassIds = rows.filter((row) => row.is_active).map((row) => row.id);
  const { data: activeStudents } = activeClassIds.length
    ? await supabase.from("students").select("class_id").in("class_id", activeClassIds).eq("status", "active")
    : { data: [] as any[] };
  const strengthByClass = new Map<string, number>();
  for (const student of activeStudents || []) {
    strengthByClass.set(student.class_id, (strengthByClass.get(student.class_id) || 0) + 1);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Academic administration</div>
          <h1>Sections & Section Masters</h1>
          <p>View each class section explicitly, print its student register, and assign a teacher as section master.</p>
        </div>
        <div className="action-row no-print">
          <Link className="button secondary" href="/classes">Manage Classes</Link>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}

      <div className="cards cards-five">
        <div className="card"><div className="stat-label">Sections / class groups</div><div className="stat-value">{rows.length}</div><div className="stat-note">Each row is a class group</div></div>
        <div className="card"><div className="stat-label">Active groups</div><div className="stat-value">{rows.filter((row) => row.is_active).length}</div><div className="stat-note">Available for current use</div></div>
        <div className="card"><div className="stat-label">Assigned section masters</div><div className="stat-value">{rows.filter((row) => row.class_teacher_id).length}</div><div className="stat-note">Teacher responsibility assigned</div></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Class</th><th>Section</th><th>Grade</th><th>Students</th><th>Section Master</th><th>Room</th><th>Status</th><th className="no-print">Action</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.class_name}</strong></td>
                <td><span className="tag">{row.section ? "Section " + row.section : "Section not specified"}</span></td>
                <td>{row.grade_level ?? "—"}</td>
                <td>{strengthByClass.get(row.id) || 0}</td>
                <td>{row.class_teacher_id ? teacherNames.get(row.class_teacher_id) || "Assigned teacher" : <span className="muted">Not assigned</span>}</td>
                <td>{row.room_number || "—"}</td>
                <td>{row.is_active ? "Active" : "Inactive"}</td>
                <td className="no-print"><Link className="button secondary compact" href={"/sections/" + row.id}>View / Print Register</Link></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={8} className="muted">No classes or sections have been created yet. Create class groups first, then manage their section registers here.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
