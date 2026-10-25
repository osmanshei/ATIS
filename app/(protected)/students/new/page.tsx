import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createStudentAction } from "../actions";

export default async function NewStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const query = await searchParams;

  const { data: classes } = await supabase
    .from("classes")
    .select("id,class_name,section,grade_level")
    .eq("is_active", true)
    .order("grade_level", { nullsFirst: true })
    .order("class_name");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Students · direct enrolment</div>
          <h1>Add Student</h1>
          <p>
            Add an already-enrolled learner directly to the student register.
            Use Admissions instead when you need the applicant approval and admission-letter workflow.
          </p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/admissions/new">Use Admissions</Link>
          <Link className="button secondary" href="/students">Back to students</Link>
        </div>
      </div>

      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form className="form-card" action={createStudentAction}>
        <h2 className="section-title">Student details</h2>
        <div className="form-grid">
          <div className="field">
            <label>Admission number *</label>
            <input name="admission_number" required />
          </div>
          <div className="field">
            <label>Class *</label>
            <select name="class_id" required>
              <option value="">Choose class...</option>
              {(classes || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}{c.section ? " / " + c.section : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>First name *</label><input name="first_name" required /></div>
          <div className="field"><label>Middle name</label><input name="middle_name" /></div>
          <div className="field"><label>Last name *</label><input name="last_name" required /></div>
          <div className="field">
            <label>Gender</label>
            <select name="gender">
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="field"><label>Date of birth</label><input name="date_of_birth" type="date" /></div>
          <div className="field"><label>Admission date</label><input name="admission_date" type="date" /></div>
          <div className="field">
            <label>Student photo</label>
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
            <small className="muted">Optional. JPG, PNG or WebP, maximum 5 MB.</small>
          </div>
        </div>

        <h2 className="section-title">Primary guardian</h2>
        <div className="form-grid">
          <div className="field"><label>Guardian name</label><input name="guardian_name" /></div>
          <div className="field"><label>Relation</label><input name="guardian_relation" placeholder="Parent / Guardian" /></div>
          <div className="field"><label>Guardian phone</label><input name="guardian_mobile" /></div>
        </div>

        <h2 className="section-title">Other details</h2>
        <div className="form-grid">
          <div className="field"><label>Address</label><input name="address_line" /></div>
          <div className="field"><label>City / Town</label><input name="city" /></div>
          <div className="field"><label>Region</label><input name="region" /></div>
          <div className="field"><label>NHIS number</label><input name="nhis_no" /></div>
          <div className="field"><label>Ghana Card number</label><input name="ghana_card_no" /></div>
        </div>
        <div className="field"><label>Medical notes</label><textarea name="medical_notes" rows={3} /></div>

        <div className="action-row">
          <button className="button" type="submit">Add Student</button>
          <Link className="button secondary" href="/students">Cancel</Link>
        </div>
      </form>
    </>
  );
}
