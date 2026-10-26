"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function detailsFromText(input: string) {
  if (!input.trim()) return [];
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, rawAmount] = line.split(":");
      const amount = Number(String(rawAmount || "").trim());
      return {
        label: String(label || "").trim(),
        amount: Number.isFinite(amount) ? amount : 0,
      };
    })
    .filter((row) => row.label);
}

export async function createPayrollRunAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const month = value(formData, "payroll_month");

  const { data, error } = await supabase.rpc("create_payroll_run", {
    p_payroll_month: month ? month + "-01" : null,
    p_notes: value(formData, "notes") || null,
  });

  if (error) redirect("/payroll?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll");
  redirect("/payroll/" + data + "?ok=" + encodeURIComponent("Payroll run created."));
}

export async function savePayrollItemAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const itemId = value(formData, "item_id");
  const runId = value(formData, "run_id");
  const allowances = Number(value(formData, "allowances") || 0);
  const deductions = Number(value(formData, "deductions") || 0);

  const { error } = await supabase.rpc("save_payroll_item", {
    p_item_id: itemId,
    p_allowances: allowances,
    p_deductions: deductions,
    p_allowance_details: detailsFromText(value(formData, "allowance_details")),
    p_deduction_details: detailsFromText(value(formData, "deduction_details")),
    p_remarks: value(formData, "remarks") || null,
  });

  if (error) {
    redirect("/payroll/" + runId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/payroll");
  revalidatePath("/payroll/" + runId);
  redirect("/payroll/" + runId + "?ok=" + encodeURIComponent("Payroll item updated."));
}

export async function approvePayrollRunAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const runId = value(formData, "run_id");

  const { error } = await supabase.rpc("approve_payroll_run", { p_run_id: runId });
  if (error) {
    redirect("/payroll/" + runId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/payroll");
  revalidatePath("/payroll/" + runId);
  redirect("/payroll/" + runId + "?ok=" + encodeURIComponent("Payroll approved."));
}

export async function markPayrollPaidAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const runId = value(formData, "run_id");

  const { data, error } = await supabase.rpc("mark_payroll_paid", {
    p_run_id: runId,
    p_pay_date: value(formData, "pay_date"),
    p_payment_method: value(formData, "payment_method") || null,
    p_reference: value(formData, "reference") || null,
  });

  if (error) {
    redirect("/payroll/" + runId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/payroll");
  revalidatePath("/payroll/" + runId);
  revalidatePath("/finance/vouchers");
  redirect(
    "/payroll/" +
      runId +
      "?ok=" +
      encodeURIComponent("Payroll marked paid. Payment voucher created.") +
      "&voucher=" +
      encodeURIComponent(String(data || "")),
  );
}

export async function createVoucherAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const payload = {
    voucher_date: value(formData, "voucher_date"),
    payee: value(formData, "payee"),
    category: value(formData, "category") || "other",
    description: value(formData, "description"),
    amount: value(formData, "amount"),
    payment_method: value(formData, "payment_method"),
    reference: value(formData, "reference"),
    notes: value(formData, "notes"),
  };

  const { data, error } = await supabase.rpc("create_payment_voucher", {
    p_payload: payload,
  });

  if (error) {
    redirect("/finance/vouchers?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/finance/vouchers");
  redirect(
    "/finance/vouchers/" +
      data +
      "?ok=" +
      encodeURIComponent("Payment voucher created."),
  );
}

export async function approveVoucherAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const id = value(formData, "voucher_id");

  const { error } = await supabase.rpc("approve_payment_voucher", {
    p_voucher_id: id,
  });

  if (error) {
    redirect("/finance/vouchers/" + id + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/finance/vouchers");
  revalidatePath("/finance/vouchers/" + id);
  redirect("/finance/vouchers/" + id + "?ok=" + encodeURIComponent("Voucher approved."));
}

export async function markVoucherPaidAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);
  const id = value(formData, "voucher_id");

  const { error } = await supabase.rpc("mark_payment_voucher_paid", {
    p_voucher_id: id,
    p_payment_method: value(formData, "payment_method") || null,
    p_reference: value(formData, "reference") || null,
  });

  if (error) {
    redirect("/finance/vouchers/" + id + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/finance/vouchers");
  revalidatePath("/finance/vouchers/" + id);
  redirect("/finance/vouchers/" + id + "?ok=" + encodeURIComponent("Voucher marked paid."));
}
