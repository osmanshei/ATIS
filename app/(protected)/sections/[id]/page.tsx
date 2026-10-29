import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { assignSectionMasterAction } from "../actions";
import { PrintButton } from "@/components/print-button";

const SECTION_NAMES: Record<string, "Red" | "Yellow" | "Green" | "Blue"> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
};

const sectionClass: Record<string, string> = {
  Red: "section-red",
  Yellow: "section-yellow",
  Green: "section-green",
  Blue: "section-blue",
};

export default async function ColourSectionRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const sectionName = SECTION_NAMES[id.toLowerCase()];
  if (!sectionName) notFound();

  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const [{ data: section }, { data: students, error: studentsError }, { data: teachers }, { data: school }] = await Promise.all([
    supabase
      .from("school_sections")
      .select("id,section_name,section_master_id")
      .eq("school_id", profile.school_id)
      .eq("section_name", sectionName)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name,gender,class_id,classes(class_name,section)")
      .eq("school_id", profile.school_id)
      .eq("student_section", sectionName)
      .eq("status", "active")
      .order("first_name")
      .order("last_name")
      .range(0, 4999),
    supabase
      .from("staff")
      .select("id,full_name,employee_code")
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .eq("status", "active")
      .order("full_name"),
    supabase.from("schools").select("name,short_name,phone,address").eq("id", profile.school_id).maybeSingle(),
  ]);

  if (!section) notFound();

  const studentRows = (students || []) as any[];
  const teacherRows = (teachers || []) as any[];
  const currentMaster = teacherRows.find((teacher) => teacher.id === section.section_master_id);
  const canAssign = profile.role === "admin";

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="eyebrow">School-wide colour section</div>
          <h1>{sectionName} Section Register</h1>
          <p>{studentRows.length} active students across all classes</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/sections">All Colour Sections</Link>
          <PrintButton label="Print Section Register" />
        </div>
      </div>

      {query.ok ? <div className="notice success no-print">{query.ok}</div> : null}
      {query.error ? <div className="notice error no-print">{query.error}</div> : null}
      {studentsError ? <div className="notice error no-print">{studentsError.message}</div> : null}

      {canAssign ? (
        <form id="assign-master" className="form-card no-print" action={assignSectionMasterAction}>
          <input type="hidden" name="section_name" value={sectionName} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="teacher_id">Section Master (teacher)</label>
              <select id="teacher_id" name="teacher_id" defaultValue={section.section_master_id || ""}>
                <option value="">Not assigned</option>
                {teacherRows.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}{teacher.employee_code ? " · " + teacher.employee_code : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Current Section Master</label>
              <input value={currentMaster?.full_name || "No section master assigned"} readOnly />
            </div>
            <div className="field">
              <label>Students in section</label>
              <input value={String(studentRows.length)} readOnly />
            </div>
          </div>
          <button className="button" type="submit">Save {sectionName} Section Master</button>
        </form>
      ) : (
        <div className="notice no-print">Section Master: {currentMaster?.full_name || "Not assigned"}</div>
      )}

      <section className={"print-document section-register " + sectionClass[sectionName]}>
        <header className="document-header">
          <h1>{school?.name || school?.short_name || "ATIS"}</h1>
          {school?.address ? <p>{school.address}</p> : null}
          {school?.phone ? <p>Tel: {school.phone}</p> : null}
          <h2>{sectionName.toUpperCase()} SECTION — STUDENT REGISTER</h2>
          <p>Academic Year: Current School Register</p>
        </header>

        <div className="document-meta-grid">
          <div><span>Section</span><strong>{sectionName}</strong></div>
          <div><span>Section Master</span><strong>{currentMaster?.full_name || "Not assigned"}</strong></div>
          <div><span>Total Students</span><strong>{studentRows.length}</strong></div>
        </div>

        <table className="document-table section-register-table">
          <thead>
            <tr><th style={{ width: "7%" }}>No.</th><th style={{ width: "20%" }}>Admission No.</th><th>Student Name</th><th style={{ width: "11%" }}>Gender</th><th style={{ width: "20%" }}>Class</th><th style={{ width: "20%" }}>Signature / Remarks</th></tr>
          </thead>
          <tbody>
            {studentRows.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td>{student.admission_number || "—"}</td>
                <td>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</td>
                <td>{student.gender || "—"}</td>
                <td>{student.classes?.class_name || "Unassigned"}{student.classes?.section ? " / " + student.classes.section : ""}</td>
                <td>&nbsp;</td>
              </tr>
            ))}
            {!studentRows.length ? <tr><td colSpan={6}>No active students are assigned to this section.</td></tr> : null}
          </tbody>
        </table>

        <div className="signature-grid section-register-signatures">
          <div><div className="signature-line" /><span>Section Master</span></div>
          <div><div className="signature-line" /><span>Headteacher / Supervisor</span></div>
          <div><div className="signature-line" /><span>Date</span></div>
        </div>
        <p className="document-footer">Generated from the ATIS school management system.</p>
      </section>
    </>
  );
}
