"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function updateStaffAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const staffId = value(formData, "staff_id");

  const { data: current, error: loadError } = await supabase
    .from("staff")
    .select("id,user_id,email")
    .eq("id", staffId)
    .single();

  if (loadError || !current) {
    redirect("/staff?error=" + encodeURIComponent("Staff record not found."));
  }

  const newEmail = value(formData, "email").toLowerCase();
  const oldEmail = String(current.email || "").toLowerCase();
  let authEmailChanged = false;

  if (current.user_id && newEmail && newEmail !== oldEmail) {
    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(current.user_id, {
      email: newEmail,
      email_confirm: true,
    });
    if (authError) {
      redirect(
        "/staff/" + staffId + "/edit?error=" +
          encodeURIComponent("Login email could not be changed: " + authError.message),
      );
    }
    authEmailChanged = true;
  }

  const payload = {
    employee_code: value(formData, "employee_code"),
    full_name: value(formData, "full_name"),
    email: newEmail,
    mobile: value(formData, "mobile"),
    role: value(formData, "role") || "staff",
    position_title: value(formData, "position_title"),
    gender: value(formData, "gender"),
    date_of_birth: value(formData, "date_of_birth"),
    qualification: value(formData, "qualification"),
    specialization_duty: value(formData, "specialization_duty"),
    joining_date: value(formData, "joining_date"),
    address: value(formData, "address"),
    emergency_contact_name: value(formData, "emergency_contact_name"),
    emergency_contact_phone: value(formData, "emergency_contact_phone"),
    status: value(formData, "status") || "active",
  };

  const { error } = await supabase.rpc("update_staff_record", {
    p_staff_id: staffId,
    p_payload: payload,
  });

  if (error) {
    if (authEmailChanged && current.user_id && oldEmail) {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(current.user_id, {
        email: oldEmail,
        email_confirm: true,
      });
    }
    redirect("/staff/" + staffId + "/edit?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/staff");
  revalidatePath("/staff/" + staffId + "/edit");
  revalidatePath("/staff/" + staffId + "/access");
  revalidatePath("/teacher-assignments");
  redirect("/staff?ok=" + encodeURIComponent("Staff record updated."));
}
