"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createAdmissionAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);

  const payload = {
    first_name: value(formData, "first_name"),
    middle_name: value(formData, "middle_name"),
    last_name: value(formData, "last_name"),
    gender: value(formData, "gender"),
    date_of_birth: value(formData, "date_of_birth"),
    applied_for_class_id: value(formData, "applied_for_class_id"),
    admission_type: value(formData, "admission_type") || "fresh",
    previous_school: value(formData, "previous_school"),
    address_line: value(formData, "address_line"),
    city: value(formData, "city"),
    region: value(formData, "region"),
    father_name: value(formData, "father_name"),
    father_mobile: value(formData, "father_mobile"),
    father_occupation: value(formData, "father_occupation"),
    mother_name: value(formData, "mother_name"),
    mother_mobile: value(formData, "mother_mobile"),
    mother_occupation: value(formData, "mother_occupation"),
    guardian_name: value(formData, "guardian_name"),
    guardian_relation: value(formData, "guardian_relation"),
    guardian_mobile: value(formData, "guardian_mobile"),
    student_email: value(formData, "student_email"),
    student_mobile: value(formData, "student_mobile"),
    blood_group: value(formData, "blood_group"),
    nhis_no: value(formData, "nhis_no"),
    ghana_card_no: value(formData, "ghana_card_no"),
    medical_notes: value(formData, "medical_notes"),
    transport_required: formData.get("transport_required") === "on",
    transport_route: value(formData, "transport_route"),
    remarks: value(formData, "remarks"),
  };

  if (!payload.first_name || !payload.last_name || !payload.applied_for_class_id) {
    redirect("/admissions/new?error=First+name%2C+last+name+and+class+are+required.");
  }

  const { data, error } = await supabase.rpc("create_admission", { p_payload: payload });
  if (error) redirect(`/admissions/new?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/admissions");
  redirect(`/admissions?ok=Applicant+registered.&new=${data}`);
}

export async function confirmAdmissionAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const admissionId = value(formData, "admission_id");
  const classId = value(formData, "class_id");

  const { error } = await supabase.rpc("confirm_admission", {
    p_admission_id: admissionId,
    p_allotted_class_id: classId || null,
  });

  if (error) redirect(`/admissions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admissions");
  redirect("/admissions?ok=Admission+confirmed.+The+letter+is+ready+to+print.");
}

export async function enrollAdmissionAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const admissionId = value(formData, "admission_id");

  const { error } = await supabase.rpc("enroll_admission", {
    p_admission_id: admissionId,
  });

  if (error) redirect(`/admissions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admissions");
  revalidatePath("/students");
  revalidatePath("/sections");
  revalidatePath("/dashboard");
  redirect("/admissions?ok=Student+enrolled+successfully.");
}

export async function rejectAdmissionAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const admissionId = value(formData, "admission_id");
  const reason = value(formData, "reason");

  const { error } = await supabase.rpc("reject_admission", {
    p_admission_id: admissionId,
    p_reason: reason,
  });

  if (error) redirect(`/admissions?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admissions");
  redirect("/admissions?ok=Application+rejected.");
}
