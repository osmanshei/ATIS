import Link from "next/link";
import { requireProfile } from "@/lib/auth";

const SECTIONS = ["Red", "Yellow", "Green", "Blue"] as const;

const sectionClass: Record<string, string> = {
  Red: "section-red",
  Yellow: "section-yellow",
  Green: "section-green",
  Blue: "section-blue",
};

export default async function SectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;

  const [{ data: sectionRows, error }, { data: teachers }] = await Promise.all([
    supabase
      .from("school_sections")
      .select("id,section_name,section_master_id")
      .eq("school_id", profile.school_id)
      .order("section_name"),
    supabase
      .from("staff")
      .select("id,full_name,employee_code")
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const teacherRows = (teachers || []) as any[];
  const teacherById = new Map<string, any>(
    teacherRows.map((teacher) => [String(teacher.id), teacher] as [string, any]),
  );
  const sectionRowsByName = new Map<string, any>(
    ((sectionRows || []) as any[]).map((row) => [row.section_name, row] as [string, any]),
  );

  const counts = await Promise.all(SECTIONS.map(async (sectionName) => {
    const { count } = await supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", profile.school_id)
      .eq("student_section", sectionName)
      .eq("status", "active");
    return [sectionName, count || 0] as [string, number];
  }));
  const countBySection = new Map<string, number>(counts);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Student houses / colour sections</div>
          <h1>Red, Yellow, Green & Blue Sections</h1>
          <p>These four school-wide sections are independent of class groups and class teachers. New students are allocated automatically to keep the numbers balanced.</p>
        </div>
        <div className="action-row no-print">
          <Link className="button secondary" href="/classes">Manage Classes</Link>
          <Link className="button secondary" href="/students">Student Register</Link>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}

      <div className="grid-2">
        {SECTIONS.map((sectionName) => {
          const row = sectionRowsByName.get(sectionName);
          const master = row?.section_master_id ? teacherById.get(row.section_master_id) : null;
          return (
            <section className={"card colour-section-card " + sectionClass[sectionName]} key={sectionName}>
              <div className="section-card-heading">
                <div>
                  <div className="eyebrow">Colour section</div>
                  <h2>{sectionName}</h2>
                </div>
                <div className="section-count">{countBySection.get(sectionName) || 0}<small>active students</small></div>
              </div>
              <p><strong>Section Master:</strong> {master?.full_name || "Not assigned"}</p>
              <p className="muted">{master?.employee_code || (master ? "Teacher" : "Assign a teacher to lead this section.")}</p>
              <div className="action-row no-print">
                <Link className="button secondary" href={"/sections/" + sectionName.toLowerCase()}>View / Print Register</Link>
                {profile.role === "admin" ? <Link className="button" href={"/sections/" + sectionName.toLowerCase() + "#assign-master"}>Assign Master</Link> : null}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
