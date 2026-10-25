"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function updateStudentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const studentId = value(formData, "student_id");

  const payload = {
    admission_number: value(formData, "admission_number"),
    first_name: value(formData, "first_name"),
    middle_name: value(formData, "middle_name"),
    last_name: value(formData, "last_name"),
    preferred_name: value(formData, "preferred_name"),
    gender: value(formData, "gender"),
    date_of_birth: value(formData, "date_of_birth"),
    admission_date: value(formData, "admission_date"),
    class_id: value(formData, "class_id"),
    roll_number: value(formData, "roll_number"),
    category: value(formData, "category"),
    address_line: value(formData, "address_line"),
    city: value(formData, "city"),
    region: value(formData, "region"),
    nationality: value(formData, "nationality") || "Ghanaian",
    medical_notes: value(formData, "medical_notes"),
    dietary_requirements: value(formData, "dietary_requirements"),
    allergies: value(formData, "allergies"),
    special_needs: value(formData, "special_needs"),
    house_name: value(formData, "house_name"),
    admission_type: value(formData, "admission_type"),
    concession_percent: value(formData, "concession_percent") || "0",
    transport_required: formData.get("transport_required") === "on",
    transport_route: value(formData, "transport_route"),
    status: value(formData, "status") || "active",
  };

  const { error } = await supabase.rpc("update_student_record", {
    p_student_id: studentId,
    p_payload: payload,
  });

  if (error) {
    redirect("/students/" + studentId + "/edit?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/students");
  revalidatePath("/students/" + studentId + "/edit");
  revalidatePath("/finance");
  revalidatePath("/finance/balances");
  redirect("/students?ok=" + encodeURIComponent("Student updated."));
}
