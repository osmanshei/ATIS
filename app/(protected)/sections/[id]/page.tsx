import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { assignSectionMasterAction } from "../actions";
import { PrintButton } from "@/components/print-button";

export default async function SectionRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);

  const { data: cls } = await supabase
    .from("classes")
    .select("id,school_id,academic_year_id,class_name,section,grade_level,class_code,room_number,is_active,class_teacher_id")
    .eq("id", id)
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (!cls) notFound();

  const [{ data: students, error: studentsError }, { data: teachers }, { data: school }, { data: year }] = await Promise.all([
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name,gender,roll_number,status")
      .eq("school_id", profile.school_id)
      .eq("class_id", id)
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
    supabase
      .from("staff")
      .select("id,full_name,employee_code")
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .eq("status", "active")
      .order("full_name"),
    supabase.from("schools").select("name,short_name,phone,address").eq("id", profile.school_id).maybeSingle(),
    supabase.from("academic_years").select("name").eq("id", cls.academic_year_id).maybeSingle(),
  ]);

  const studentRows = (students || []) as any[];
  const teacherRows = (teachers || []) as any[];
  const currentTeacher = teacherRows.find((teacher) => teacher.id === cls.class_teacher_id);
  const canAssign = ["admin", "supervisor"].includes(profile.role);
  const sectionLabel = cls.section ? "Section " + cls.section : "Section not specified";

  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="eyebrow">Section register</div>
          <h1>{cls.class_name} · {sectionLabel}</h1>
          <p>{studentRows.length} active students · {year?.name || "Academic year not specified"}</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/sections">All Sections</Link>
          <PrintButton label="Print Student Register" />
        </div>
      </div>

      {query.ok ? <div className="notice success no-print">{query.ok}</div> : null}
      {query.error ? <div className="notice error no-print">{query.error}</div> : null}
      {studentsError ? <div className="notice error no-print">{studentsError.message}</div> : null}

      {canAssign ? (
        <form className="form-card no-print" action={assignSectionMasterAction}>
          <input type="hidden" name="class_id" value={cls.id} />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="teacher_id">Section master</label>
              <select id="teacher_id" name="teacher_id" defaultValue={cls.class_teacher_id || ""}>
                <option value="">Not assigned</option>
                {teacherRows.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}{teacher.employee_code ? " · " + teacher.employee_code : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Current assignment</label>
              <input value={currentTeacher?.full_name || "No section master assigned"} readOnly />
            </div>
            <div className="field">
              <label>Students in section</label>
              <input value={String(studentRows.length)} readOnly />
            </div>
            <div className="field">
              <label>Class / Section</label>
              <input value={cls.class_name + " / " + (cls.section || "Not specified")} readOnly />
            </div>
          </div>
          <button className="button" type="submit">Save Section Master</button>
        </form>
      ) : (
        <div className="notice no-print">Section master: {currentTeacher?.full_name || "Not assigned"}</div>
      )}

      <section className="print-document section-register">
        <header className="document-header">
          <h1>{school?.name || school?.short_name || "ATIS"}</h1>
          {school?.address ? <p>{school.address}</p> : null}
          {school?.phone ? <p>Tel: {school.phone}</p> : null}
          <h2>STUDENT SECTION REGISTER</h2>
          <p>{cls.class_name} · {sectionLabel} · Academic Year: {year?.name || "Not specified"}</p>
        </header>

        <div className="document-meta-grid">
          <div><span>Class</span><strong>{cls.class_name}</strong></div>
          <div><span>Section</span><strong>{cls.section || "Not specified"}</strong></div>
          <div><span>Section master</span><strong>{currentTeacher?.full_name || "Not assigned"}</strong></div>
        </div>

        <table className="document-table section-register-table">
          <thead>
            <tr><th style={{ width: "7%" }}>No.</th><th style={{ width: "22%" }}>Admission No.</th><th>Student Name</th><th style={{ width: "13%" }}>Gender</th><th style={{ width: "23%" }}>Signature / Remarks</th></tr>
          </thead>
          <tbody>
            {studentRows.map((student, index) => (
              <tr key={student.id}>
                <td>{index + 1}</td>
                <td>{student.admission_number || "—"}</td>
                <td>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")}</td>
                <td>{student.gender || "—"}</td>
                <td>&nbsp;</td>
              </tr>
            ))}
            {!studentRows.length ? <tr><td colSpan={5}>No active students are assigned to this section.</td></tr> : null}
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
