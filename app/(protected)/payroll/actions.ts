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


function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows.filter((cells) => cells.some((cell) => cell !== ""));
}

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDate(value: string) {
  const text = value.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    return match[3] + "-" + month + "-" + day;
  }

  return text;
}

function normalizeTime(value: string) {
  const text = value.trim();
  if (!text) return "";
  const ampm = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = ampm[2];
    const second = ampm[3] || "00";
    const meridiem = ampm[4].toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return String(hour).padStart(2, "0") + ":" + minute + ":" + second;
  }
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [h, m] = text.split(":");
    return h.padStart(2, "0") + ":" + m + ":00";
  }
  return text;
}

function normalizeBoolean(value: string) {
  const text = value.trim().toLowerCase();
  return ["1", "true", "yes", "y", "early"].includes(text);
}

function findCell(record: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record[alias];
    if (value !== undefined && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export async function saveStaffDeviceMappingAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);

  const { error } = await supabase.rpc("save_staff_attendance_device_mapping", {
    p_staff_id: value(formData, "staff_id"),
    p_device_user_id: value(formData, "device_user_id"),
    p_device_name: value(formData, "device_name") || null,
  });

  if (error) {
    redirect("/payroll/attendance?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/payroll/attendance");
  redirect("/payroll/attendance?ok=" + encodeURIComponent("Device ID mapping saved."));
}

export async function importStaffDeviceAttendanceAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);

  let csv = value(formData, "csv_text");
  const file = formData.get("attendance_file");

  if (!csv && file && typeof file === "object" && "text" in file) {
    csv = await (file as File).text();
  }

  if (!csv.trim()) {
    redirect(
      "/payroll/attendance?error=" +
        encodeURIComponent("Choose a CSV export from the attendance device or paste CSV data."),
    );
  }

  const parsed = parseCsv(csv);
  if (parsed.length < 2) {
    redirect(
      "/payroll/attendance?error=" +
        encodeURIComponent("The attendance CSV has no data rows."),
    );
  }

  if (parsed.length > 5001) {
    redirect(
      "/payroll/attendance?error=" +
        encodeURIComponent("Import a maximum of 5,000 attendance rows at a time."),
    );
  }

  const headers = parsed[0].map(headerKey);
  const rows = parsed.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] || "";
    });

    const identifier = findCell(record, [
      "deviceuserid",
      "userid",
      "employeeid",
      "employeecode",
      "staffcode",
      "pin",
      "id",
    ]);
    const date = findCell(record, ["attendancedate", "date", "punchdate", "logdate"]);
    const checkIn = findCell(record, [
      "checkintime",
      "checkin",
      "timein",
      "intime",
      "punchtime",
      "time",
    ]);
    const checkOut = findCell(record, ["checkouttime", "checkout", "timeout", "outtime"]);
    const early = findCell(record, ["early", "isearly", "earlyattendance"]);
    const status = findCell(record, ["status", "attendancestatus"]) || "present";
    const recordId = findCell(record, ["devicerecordid", "recordid", "logid", "transactionid"]);

    return {
      device_user_id: identifier,
      attendance_date: normalizeDate(date),
      check_in_time: normalizeTime(checkIn),
      check_out_time: normalizeTime(checkOut),
      early: normalizeBoolean(early),
      status: status.toLowerCase(),
      device_record_id: recordId,
    };
  });

  const source = value(formData, "device_name") || "verification_device";
  const { data, error } = await supabase.rpc("import_staff_device_attendance", {
    p_rows: rows,
    p_source: source,
  });

  if (error) {
    redirect("/payroll/attendance?error=" + encodeURIComponent(error.message));
  }

  const result = (data || {}) as {
    imported?: number;
    unmatched?: number;
    skipped?: number;
  };

  revalidatePath("/payroll/attendance");
  revalidatePath("/payroll");

  redirect(
    "/payroll/attendance?ok=" +
      encodeURIComponent(
        "Device attendance imported: " +
          Number(result.imported || 0) +
          " saved, " +
          Number(result.unmatched || 0) +
          " unmatched, " +
          Number(result.skipped || 0) +
          " skipped.",
      ),
  );
}
