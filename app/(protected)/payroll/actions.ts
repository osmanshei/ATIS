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
        type: "manual",
        label: String(label || "").trim(),
        name: String(label || "").trim(),
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
  const allowanceDetails = detailsFromText(value(formData, "allowance_details"));
  const deductionDetails = detailsFromText(value(formData, "deduction_details"));
  const typedAllowances = Number(value(formData, "other_allowances") || 0);
  const typedDeductions = Number(value(formData, "other_deductions") || 0);
  const allowances = allowanceDetails.length
    ? allowanceDetails.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    : typedAllowances;
  const deductions = deductionDetails.length
    ? deductionDetails.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    : typedDeductions;

  const { error } = await supabase.rpc("save_payroll_item", {
    p_item_id: itemId,
    p_allowances: allowances,
    p_deductions: deductions,
    p_allowance_details: allowanceDetails,
    p_deduction_details: deductionDetails,
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


export async function savePayrollSettingAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const key = value(formData, "key");

  const { error } = await supabase.rpc("save_payroll_setting", {
    p_key: key,
    p_value: Number(value(formData, "setting_value") || 0),
    p_description: value(formData, "description") || null,
  });

  if (error) redirect("/payroll/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/settings");
  redirect("/payroll/settings?ok=" + encodeURIComponent("Payroll setting updated."));
}

export async function savePayrollCategoryAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const { error } = await supabase.rpc("save_payroll_category", {
    p_payload: {
      category_name: value(formData, "category_name"),
      base_pay: value(formData, "base_pay"),
      active: true,
      notes: value(formData, "notes"),
    },
  });

  if (error) redirect("/payroll/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll");
  redirect("/payroll/settings?ok=" + encodeURIComponent("Staff category saved."));
}

export async function savePayrollAllowanceTypeAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const { error } = await supabase.rpc("save_payroll_allowance_type", {
    p_payload: {
      name: value(formData, "name"),
      calculation_type: value(formData, "calculation_type") || "fixed",
      default_amount: value(formData, "default_amount") || "0",
      active: true,
      notes: value(formData, "notes"),
    },
  });

  if (error) redirect("/payroll/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/settings");
  redirect("/payroll/settings?ok=" + encodeURIComponent("Allowance type saved."));
}

export async function savePayrollProfileAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const staffId = value(formData, "staff_id");

  const { error } = await supabase.rpc("save_payroll_profile", {
    p_payload: {
      staff_id: staffId,
      category_id: value(formData, "category_id"),
      base_pay_override: value(formData, "base_pay_override"),
      ssnit_enabled: formData.get("ssnit_enabled") === "on",
      ssnit_rate_override: value(formData, "ssnit_rate_override"),
      early_allowance_eligible: formData.get("early_allowance_eligible") === "on",
      long_service_eligible: formData.get("long_service_eligible") === "on",
      active: true,
      notes: value(formData, "notes"),
    },
  });

  if (error) redirect("/payroll/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll");
  redirect("/payroll/settings?ok=" + encodeURIComponent("Staff payroll profile saved."));
}

export async function saveStaffAllowanceAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const { error } = await supabase.rpc("save_staff_allowance", {
    p_payload: {
      staff_id: value(formData, "staff_id"),
      allowance_type_id: value(formData, "allowance_type_id"),
      amount: value(formData, "amount"),
      active: true,
      effective_from: value(formData, "effective_from"),
      effective_to: value(formData, "effective_to"),
      notes: value(formData, "notes"),
    },
  });

  if (error) redirect("/payroll/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/settings");
  redirect("/payroll/settings?ok=" + encodeURIComponent("Staff allowance saved."));
}

export async function createStaffLoanAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant"]);

  const { error } = await supabase.rpc("create_staff_loan", {
    p_payload: {
      staff_id: value(formData, "staff_id"),
      loan_name: value(formData, "loan_name"),
      principal: value(formData, "principal"),
      monthly_deduction: value(formData, "monthly_deduction"),
      start_month: value(formData, "start_month") + "-01",
      notes: value(formData, "notes"),
    },
  });

  if (error) redirect("/payroll/settings?error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/settings");
  revalidatePath("/payroll");
  redirect("/payroll/settings?ok=" + encodeURIComponent("Staff loan created."));
}

export async function saveStaffAttendanceAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const date = value(formData, "attendance_date");

  const { error } = await supabase.rpc("save_staff_attendance", {
    p_staff_id: value(formData, "staff_id"),
    p_attendance_date: date,
    p_check_in_time: value(formData, "check_in_time") || null,
    p_status: value(formData, "status") || "present",
    p_early: formData.get("early") === "on",
    p_notes: value(formData, "notes") || null,
  });

  const back = "/payroll/attendance?date=" + encodeURIComponent(date);
  if (error) redirect(back + "&error=" + encodeURIComponent(error.message));

  revalidatePath("/payroll/attendance");
  revalidatePath("/payroll");
  redirect(back + "&ok=" + encodeURIComponent("Staff attendance saved."));
}
