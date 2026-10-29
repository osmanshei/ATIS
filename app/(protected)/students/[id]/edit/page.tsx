import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { removeStudentPhotoAction, updateStudentAction } from "../../actions";
import { signedStudentPhotoUrl } from "@/lib/student-photo";

export default async function EditStudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);

  const [{ data: student }, { data: classes }] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).single(),
    supabase
      .from("classes")
      .select("id,class_name,section,grade_level,is_active")
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
  ]);

  if (!student) notFound();
  const photoUrl = await signedStudentPhotoUrl(supabase, student.photo_url);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Student record</div>
          <h1>Edit Student</h1>
          <p>{[student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" ")} · {student.admission_number || "No admission number"}</p>
        </div>
        <div className="action-row">
          {profile.role === "admin" ? (
            <Link className="button" href={"/students/" + student.id + "/access"}>Portal Access</Link>
          ) : null}
          <Link className="button secondary" href="/students">Back to students</Link>
        </div>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <section className="student-photo-editor">
        <div className="student-photo-preview">
          {photoUrl ? (
            <img src={photoUrl} alt="Student" />
          ) : (
            <span>{String(student.first_name || "?").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="eyebrow">Student picture</div>
          <h2 className="section-title">{photoUrl ? "Picture on file" : "No picture uploaded"}</h2>
          <p className="muted">Upload a new picture below to replace the current one.</p>
          {photoUrl ? (
            <form action={removeStudentPhotoAction}>
              <input type="hidden" name="student_id" value={student.id} />
              <button className="button secondary compact" type="submit">Remove Picture</button>
            </form>
          ) : null}
        </div>
      </section>

      <form className="form-card" action={updateStudentAction}>
        <input type="hidden" name="student_id" value={student.id} />

        <h2 className="section-title">Identity & enrolment</h2>
        <div className="form-grid">
          <div className="field"><label>Admission number</label><input name="admission_number" defaultValue={student.admission_number || ""} /></div>
          <div className="field"><label>Roll number</label><input name="roll_number" defaultValue={student.roll_number || ""} /></div>
          <div className="field"><label>First name</label><input name="first_name" defaultValue={student.first_name || ""} required /></div>
          <div className="field"><label>Middle name</label><input name="middle_name" defaultValue={student.middle_name || ""} /></div>
          <div className="field"><label>Last name</label><input name="last_name" defaultValue={student.last_name || ""} required /></div>
          <div className="field"><label>Preferred name</label><input name="preferred_name" defaultValue={student.preferred_name || ""} /></div>
          <div className="field">
            <label>Gender</label>
            <select name="gender" defaultValue={student.gender || ""}>
              <option value="">Not set</option><option value="male">Male</option><option value="female">Female</option>
            </select>
          </div>
          <div className="field"><label>Date of birth</label><input name="date_of_birth" type="date" defaultValue={student.date_of_birth || ""} /></div>
          <div className="field"><label>Admission date</label><input name="admission_date" type="date" defaultValue={student.admission_date || ""} /></div>
          <div className="field">
            <label>Class</label>
            <select name="class_id" defaultValue={student.class_id || ""}>
              <option value="">Unassigned</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}{c.section ? " / " + c.section : ""}{!c.is_active ? " · Inactive" : ""}
                </option>
              ))}
            </select>
          </div>
          {["admin", "supervisor"].includes(profile.role) ? (
            <div className="field">
              <label>Colour Section</label>
              <select name="student_section" defaultValue={student.student_section || "Red"} required>
                <option value="Red">Red</option>
                <option value="Yellow">Yellow</option>
                <option value="Green">Green</option>
                <option value="Blue">Blue</option>
              </select>
              <small className="muted">The school-wide section is separate from the student's class group.</small>
            </div>
          ) : (
            <div className="field">
              <label>Colour Section</label>
              <input value={student.student_section || "Not assigned"} readOnly />
            </div>
          )}
          <div className="field"><label>Category</label><input name="category" defaultValue={student.category || ""} /></div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue={student.status || "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="transferred">Transferred</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="graduated">Graduated</option>
              <option value="alumni">Alumni</option>
            </select>
          </div>
        </div>

        <h2 className="section-title">Address & school details</h2>
        <div className="form-grid">
          <div className="field"><label>Address</label><input name="address_line" defaultValue={student.address_line || ""} /></div>
          <div className="field"><label>City / Town</label><input name="city" defaultValue={student.city || ""} /></div>
          <div className="field"><label>Region</label><input name="region" defaultValue={student.region || ""} /></div>
          <div className="field"><label>Nationality</label><input name="nationality" defaultValue={student.nationality || "Ghanaian"} /></div>
          <div className="field"><label>Other house / group (optional)</label><input name="house_name" defaultValue={student.house_name || ""} /></div>
          <div className="field"><label>Admission type</label><input name="admission_type" defaultValue={student.admission_type || ""} /></div>
          <div className="field"><label>Fee concession (%)</label><input name="concession_percent" type="number" min="0" max="100" step="0.01" defaultValue={student.concession_percent ?? 0} /></div>
          <div className="field"><label>Transport route</label><input name="transport_route" defaultValue={student.transport_route || ""} /></div>
          <div className="field">
            <label>Replace student photo</label>
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
            <small className="muted">JPG, PNG or WebP, maximum 5 MB.</small>
          </div>
        </div>
        <label className="checkbox-field"><input name="transport_required" type="checkbox" defaultChecked={Boolean(student.transport_required)} /> Transport required</label>

        <h2 className="section-title">Health & support</h2>
        <div className="form-grid">
          <div className="field"><label>Medical notes</label><textarea name="medical_notes" rows={2} defaultValue={student.medical_notes || ""} /></div>
          <div className="field"><label>Dietary requirements</label><textarea name="dietary_requirements" rows={2} defaultValue={student.dietary_requirements || ""} /></div>
          <div className="field"><label>Allergies</label><textarea name="allergies" rows={2} defaultValue={student.allergies || ""} /></div>
          <div className="field"><label>Special needs</label><textarea name="special_needs" rows={2} defaultValue={student.special_needs || ""} /></div>
        </div>

        <div className="action-row">
          <button className="button" type="submit">Save Student Changes</button>
          <Link className="button secondary" href="/students">Cancel</Link>
        </div>
      </form>
    </>
  );
}
