"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveFeedingRateAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const payload = {
    term_id: value(formData, "term_id"),
    class_id: value(formData, "class_id"),
    daily_rate: value(formData, "daily_rate"),
    weekly_rate: value(formData, "weekly_rate"),
    monthly_rate: value(formData, "monthly_rate"),
    termly_rate: value(formData, "termly_rate"),
    status: value(formData, "status") || "active",
    notes: value(formData, "notes"),
  };

  const { error } = await supabase.rpc("save_feeding_rate", { p_payload: payload });
  if (error) redirect("/feeding/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/feeding");
  revalidatePath("/feeding/settings");
  revalidatePath("/feeding/payments");
  redirect("/feeding/settings?ok=" + encodeURIComponent("Feeding rate saved."));
}

export async function saveStudentFeedingPlanAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant", "clerk"]);

  const payload = {
    term_id: value(formData, "term_id"),
    student_id: value(formData, "student_id"),
    frequency: value(formData, "frequency") || "daily",
    related_staff_id: value(formData, "related_staff_id"),
    status: "active",
    notes: value(formData, "notes"),
  };

  const { error } = await supabase.rpc("save_student_feeding_plan", { p_payload: payload });
  const back = "/feeding/settings?term=" + encodeURIComponent(payload.term_id);

  if (error) redirect(back + "&error=" + encodeURIComponent(error.message));

  revalidatePath("/feeding");
  revalidatePath("/feeding/settings");
  revalidatePath("/feeding/payments");
  redirect(back + "&ok=" + encodeURIComponent("Student feeding plan saved."));
}

export async function recordFeedingPaymentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant", "clerk"]);
  const studentId = value(formData, "student_id");
  const termId = value(formData, "term_id");

  const { data, error } = await supabase.rpc("record_feeding_payment", {
    p_student_id: studentId,
    p_term_id: termId,
    p_frequency: value(formData, "frequency"),
    p_payment_date: value(formData, "payment_date") || null,
    p_coverage_start: value(formData, "coverage_start") || null,
    p_payment_method: value(formData, "payment_method") || null,
    p_reference: value(formData, "reference") || null,
    p_remarks: value(formData, "remarks") || null,
    p_amount: value(formData, "amount") ? Number(value(formData, "amount")) : null,
  });

  const back =
    "/feeding/payments?term=" +
    encodeURIComponent(termId) +
    "&student=" +
    encodeURIComponent(studentId);

  if (error) redirect(back + "&error=" + encodeURIComponent(error.message));

  revalidatePath("/feeding");
  revalidatePath("/feeding/payments");
  revalidatePath("/feeding/register");
  redirect(
    back +
      "&ok=" +
      encodeURIComponent("Feeding payment recorded. Receipt: " + String(data || "")),
  );
}
