"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveFeedingRegisterAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk", "staff"]);
  const classId = value(formData, "class_id");
  const date = value(formData, "feeding_date");

  const records: Array<{ student_id: string; status: string; remark: string }> = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const studentId = key.slice("status_".length);
    records.push({
      student_id: studentId,
      status: String(raw || "not_fed"),
      remark: value(formData, "remark_" + studentId),
    });
  }

  const { error } = await supabase.rpc("save_feeding_register", {
    p_class_id: classId,
    p_feeding_date: date,
    p_unit_cost: Number(value(formData, "unit_cost") || 0),
    p_records: records,
    p_supplier: value(formData, "supplier") || null,
    p_notes: value(formData, "notes") || null,
    p_meal_name: value(formData, "meal_name") || "Lunch",
  });

  const back = "/feeding/register?class=" + encodeURIComponent(classId) + "&date=" + encodeURIComponent(date);
  if (error) redirect(back + "&error=" + encodeURIComponent(error.message));

  revalidatePath("/feeding");
  revalidatePath("/feeding/register");
  redirect(back + "&ok=" + encodeURIComponent("Feeding register saved."));
}

export async function setFeedingLockAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const sessionId = value(formData, "session_id");
  const classId = value(formData, "class_id");
  const date = value(formData, "feeding_date");
  const locked = value(formData, "locked") === "true";

  const { error } = await supabase.rpc("set_feeding_lock", {
    p_session_id: sessionId,
    p_locked: locked,
  });

  const back = "/feeding/register?class=" + encodeURIComponent(classId) + "&date=" + encodeURIComponent(date);
  if (error) redirect(back + "&error=" + encodeURIComponent(error.message));

  revalidatePath("/feeding");
  revalidatePath("/feeding/register");
  redirect(back + "&ok=" + encodeURIComponent(locked ? "Feeding register locked." : "Feeding register unlocked."));
}
