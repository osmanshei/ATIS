import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createAdmissionAction } from "../actions";

export default async function NewAdmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;

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
          <h1>Register Applicant</h1>
          <p>Create an application first. The student record is created only after enrollment.</p>
        </div>
        <Link className="button secondary" href="/admissions">Back to admissions</Link>
      </div>

      {params.error ? <div className="notice error">{params.error}</div> : null}

      <form className="form-card" action={createAdmissionAction}>
        <h2 className="section-title">Student details</h2>
        <div className="form-grid">
          <div className="field"><label>First name *</label><input name="first_name" required /></div>
          <div className="field"><label>Middle name</label><input name="middle_name" /></div>
          <div className="field"><label>Last name *</label><input name="last_name" required /></div>
          <div className="field"><label>Gender</label><select name="gender"><option value="">Choose...</option><option>male</option><option>female</option></select></div>
          <div className="field"><label>Date of birth</label><input name="date_of_birth" type="date" /></div>
          <div className="field">
            <label>Class applied for *</label>
            <select name="applied_for_class_id" required>
              <option value="">Choose...</option>
              {(classes || []).map((c: any) => (
                <option value={c.id} key={c.id}>
                  {c.class_name}{c.section ? ` / ${c.section}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field"><label>Admission type</label><select name="admission_type"><option value="fresh">Fresh</option><option value="transfer">Transfer</option><option value="re-admission">Re-admission</option></select></div>
          <div className="field"><label>Previous school</label><input name="previous_school" /></div>
        </div>

        <h2 className="section-title">Family / guardian</h2>
        <div className="form-grid">
          <div className="field"><label>Father name</label><input name="father_name" /></div>
          <div className="field"><label>Father phone</label><input name="father_mobile" /></div>
          <div className="field"><label>Father occupation</label><input name="father_occupation" /></div>
          <div className="field"><label>Mother name</label><input name="mother_name" /></div>
          <div className="field"><label>Mother phone</label><input name="mother_mobile" /></div>
          <div className="field"><label>Mother occupation</label><input name="mother_occupation" /></div>
          <div className="field"><label>Guardian name</label><input name="guardian_name" /></div>
          <div className="field"><label>Guardian relation</label><input name="guardian_relation" placeholder="Guardian" /></div>
          <div className="field"><label>Guardian phone</label><input name="guardian_mobile" /></div>
        </div>

        <h2 className="section-title">Contact & other details</h2>
        <div className="form-grid">
          <div className="field"><label>Address</label><input name="address_line" /></div>
          <div className="field"><label>City / Town</label><input name="city" /></div>
          <div className="field"><label>Region</label><input name="region" /></div>
          <div className="field"><label>Student email</label><input name="student_email" type="email" /></div>
          <div className="field"><label>Student phone</label><input name="student_mobile" /></div>
          <div className="field"><label>NHIS number</label><input name="nhis_no" /></div>
          <div className="field"><label>Ghana Card number</label><input name="ghana_card_no" /></div>
          <div className="field"><label>Blood group</label><input name="blood_group" /></div>
          <div className="field"><label><input name="transport_required" type="checkbox" /> Transport required</label></div>
          <div className="field"><label>Transport route</label><input name="transport_route" /></div>
        </div>

        <div className="field"><label>Medical notes</label><textarea name="medical_notes" rows={3} /></div>
        <div className="field"><label>Remarks</label><textarea name="remarks" rows={3} /></div>
        <button className="button" type="submit">Register applicant</button>
      </form>
    </>
  );
}
