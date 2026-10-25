"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveFeeItemAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const payload = {
    term_id: value(formData, "term_id"),
    class_id: value(formData, "class_id"),
    applies_to_all_students: formData.get("applies_to_all_students") === "on",
    fee_name: value(formData, "fee_name"),
    fee_category: value(formData, "fee_category") || "school_fee",
    amount: value(formData, "amount"),
    due_date: value(formData, "due_date"),
    is_concession_eligible: formData.get("is_concession_eligible") === "on",
    is_active: true,
    notes: value(formData, "notes"),
  };

  const { error } = await supabase.rpc("save_fee_item", { p_payload: payload });
  if (error) redirect("/finance/fees?error=" + encodeURIComponent(error.message));

  revalidatePath("/finance");
  revalidatePath("/finance/fees");
  revalidatePath("/finance/balances");
  redirect("/finance/fees?ok=Fee+item+saved.");
}

export async function recordFeePaymentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const studentId = value(formData, "student_id");
  const termId = value(formData, "term_id");
  const amount = Number(value(formData, "amount"));
  const feeItemId = value(formData, "fee_item_id");

  const { data, error } = await supabase.rpc("record_fee_payment", {
    p_student_id: studentId,
    p_term_id: termId,
    p_amount: amount,
    p_payment_method: value(formData, "payment_method") || null,
    p_reference: value(formData, "reference") || null,
    p_remarks: value(formData, "remarks") || null,
    p_fee_item_id: feeItemId || null,
  });

  if (error) {
    redirect("/finance/payments?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/finance");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/balances");
  revalidatePath("/results");
  redirect("/finance/receipt/" + data + "?ok=Payment+recorded.");
}

export async function reverseFeePaymentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const paymentId = value(formData, "payment_id");
  const reason = value(formData, "reason");

  const { error } = await supabase.rpc("reverse_fee_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });

  if (error) {
    redirect("/finance/receipt/" + paymentId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/finance");
  revalidatePath("/finance/payments");
  revalidatePath("/finance/balances");
  revalidatePath("/finance/receipt/" + paymentId);
  redirect("/finance/receipt/" + paymentId + "?ok=Payment+reversed.");
}

export async function saveFeeAdjustmentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const studentId = value(formData, "student_id");
  const termId = value(formData, "term_id");

  const payload = {
    student_id: studentId,
    term_id: termId,
    fee_item_id: value(formData, "fee_item_id"),
    adjustment_type: value(formData, "adjustment_type") || "discount",
    calculation_type: value(formData, "calculation_type") || "amount",
    adjustment_value: value(formData, "adjustment_value"),
    reason: value(formData, "reason"),
  };

  const { error } = await supabase.rpc("save_fee_adjustment", { p_payload: payload });
  if (error) {
    redirect(
      "/finance/student/" +
        studentId +
        "?term=" +
        encodeURIComponent(termId) +
        "&error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/finance");
  revalidatePath("/finance/balances");
  revalidatePath("/finance/student/" + studentId);
  redirect(
    "/finance/student/" +
      studentId +
      "?term=" +
      encodeURIComponent(termId) +
      "&ok=Adjustment+saved.",
  );
}


export async function updateFeeItemAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const feeItemId = value(formData, "fee_item_id");

  const payload = {
    term_id: value(formData, "term_id"),
    class_id: value(formData, "class_id"),
    applies_to_all_students: formData.get("applies_to_all_students") === "on",
    fee_name: value(formData, "fee_name"),
    fee_category: value(formData, "fee_category") || "school_fee",
    amount: value(formData, "amount"),
    due_date: value(formData, "due_date"),
    is_concession_eligible: formData.get("is_concession_eligible") === "on",
    is_active: formData.get("is_active") === "on",
    notes: value(formData, "notes"),
  };

  const { error } = await supabase.rpc("update_fee_item", {
    p_fee_item_id: feeItemId,
    p_payload: payload,
  });

  if (error) {
    redirect(
      "/finance/fees/" + feeItemId + "/edit?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/finance");
  revalidatePath("/finance/fees");
  revalidatePath("/finance/balances");
  revalidatePath("/results");
  redirect("/finance/fees?ok=" + encodeURIComponent("Fee item updated."));
}
