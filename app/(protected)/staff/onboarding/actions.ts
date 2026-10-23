"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { field, parseCsv, parseFlexibleDate } from "@/lib/csv";
import { normalizeGhanaPhone, provisionOrResetStaffLogin } from "@/lib/staff-access";

export type StaffCredentialRow = {
  fullName: string;
  employeeCode: string;
  role: string;
  position: string;
  email: string;
  phone: string;
  username: string;
  temporaryPassword: string;
  smsSent: boolean;
  emailSent: boolean;
};

export type StaffBulkState = {
  ok: boolean;
  message: string;
  imported: number;
  skipped: number;
  invalid: number;
  credentials: StaffCredentialRow[];
};

export const initialStaffBulkState: StaffBulkState = {
  ok: false,
  message: "",
  imported: 0,
  skipped: 0,
  invalid: 0,
  credentials: [],
};

function clean(value: string) {
  return String(value || "").trim();
}

function roleMapping(rawRole: string) {
  const raw = clean(rawRole).toLowerCase();
  if (!raw) return { role: "teacher", position: "Teacher" };

  if (["teacher"].includes(raw)) return { role: "teacher", position: "Teacher" };
  if (["supervisor", "head teacher", "headteacher"].includes(raw)) return { role: "supervisor", position: clean(rawRole) || "Supervisor" };
  if (["clerk", "secretary"].includes(raw)) return { role: "clerk", position: clean(rawRole) || "Clerk" };
  if (["accountant", "accounts officer", "bursar"].includes(raw)) return { role: "accountant", position: clean(rawRole) || "Accountant" };
  if (["administrator", "admin"].includes(raw)) return null;

  const accepted = [
    "staff","cleaner","cook","caretaker","security","security guard","watchman",
    "driver","nurse","matron","storekeeper","librarian","lab attendant",
    "groundskeeper","gardener","maintenance staff","kitchen staff",
    "office assistant","porter"
  ];
  if (accepted.includes(raw)) {
    return {
      role: "staff",
      position: raw === "staff"
        ? "Staff"
        : raw.split(" ").map((x) => x ? x[0].toUpperCase() + x.slice(1) : x).join(" "),
    };
  }
  return null;
}

export async function bulkOnboardStaffAction(
  _previous: StaffBulkState,
  formData: FormData,
): Promise<StaffBulkState> {
  const { supabase, profile } = await requireProfile(["admin"]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ...initialStaffBulkState, message: "Choose a staff CSV file." };
  }
  if (file.size > 2_000_000) {
    return { ...initialStaffBulkState, message: "The staff CSV file is too large." };
  }

  const rows = parseCsv(await file.text());
  if (!rows.length) {
    return { ...initialStaffBulkState, message: "No staff rows were found in the CSV." };
  }
  if (rows.length > 300) {
    return { ...initialStaffBulkState, message: "A single staff import is limited to 300 rows." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("staff")
    .select("id,email,mobile,employee_code")
    .eq("school_id", profile.school_id);

  const emailSet = new Set((existing || []).map((x) => clean(x.email || "").toLowerCase()).filter(Boolean));
  const phoneSet = new Set((existing || []).map((x) => normalizeGhanaPhone(x.mobile || "")).filter(Boolean));
  const codeSet = new Set((existing || []).map((x) => clean(x.employee_code || "").toLowerCase()).filter(Boolean));

  const seenEmail = new Set<string>();
  const seenPhone = new Set<string>();
  const seenCode = new Set<string>();

  const credentials: StaffCredentialRow[] = [];
  let skipped = 0;
  let invalid = 0;

  for (const row of rows) {
    const fullName = field(row, "Full Name", "FullName", "Name");
    const phoneRaw = field(row, "Phone Number", "Phone", "Mobile");
    const email = field(row, "Email", "Email Address").toLowerCase();
    const mapped = roleMapping(field(row, "Role", "Position", "Staff Role"));
    const normalizedPhone = normalizeGhanaPhone(phoneRaw);

    if (
      !fullName ||
      !normalizedPhone ||
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !mapped
    ) {
      invalid += 1;
      continue;
    }

    const suppliedCode = field(row, "Employee Code", "EmployeeCode");
    const codeKey = suppliedCode.toLowerCase();

    if (
      emailSet.has(email) ||
      phoneSet.has(normalizedPhone) ||
      (suppliedCode && codeSet.has(codeKey)) ||
      seenEmail.has(email) ||
      seenPhone.has(normalizedPhone) ||
      (suppliedCode && seenCode.has(codeKey))
    ) {
      skipped += 1;
      continue;
    }

    let employeeCode = suppliedCode;
    if (!employeeCode) {
      const { data: generatedCode, error: codeError } = await supabase.rpc("next_staff_employee_code");
      if (codeError || !generatedCode) {
        invalid += 1;
        continue;
      }
      employeeCode = String(generatedCode);
    }

    const roleRaw = field(row, "Role", "Position", "Staff Role");
    const specialization = field(row, "Specialization / Duty", "Specialization", "Duty");
    const position = specialization || mapped.position;
    const dateOfBirthRaw = field(row, "Date of Birth", "DateOfBirth", "DOB");
    const joiningDateRaw = field(row, "Date of Employment", "JoiningDate", "DateOfEmployment");
    const dateOfBirth = dateOfBirthRaw ? parseFlexibleDate(dateOfBirthRaw) : null;
    const joiningDate = joiningDateRaw ? parseFlexibleDate(joiningDateRaw) : null;

    if ((dateOfBirthRaw && !dateOfBirth) || (joiningDateRaw && !joiningDate)) {
      invalid += 1;
      continue;
    }

    const { data: staff, error: insertError } = await admin
      .from("staff")
      .insert({
        school_id: profile.school_id,
        employee_code: employeeCode,
        full_name: fullName,
        email,
        mobile: normalizedPhone,
        role: mapped.role,
        position_title: position,
        gender: field(row, "Gender") || null,
        date_of_birth: dateOfBirth,
        qualification: field(row, "Qualification") || null,
        specialization_duty: specialization || position,
        joining_date: joiningDate,
        address: field(row, "Address") || null,
        emergency_contact_name: field(row, "Emergency Contact Name") || null,
        emergency_contact_phone: field(row, "Emergency Contact Phone") || null,
        status: "active",
        legacy_payload: {
          source: "hosted_staff_bulk_onboarding",
          import_file: file.name,
          source_role_text: roleRaw || "Teacher",
        },
      })
      .select("id")
      .single();

    if (insertError || !staff) {
      invalid += 1;
      continue;
    }

    try {
      const login = await provisionOrResetStaffLogin(admin, {
        schoolId: profile.school_id,
        staffId: staff.id,
        sentBy: profile.user_id,
        loginUrl: process.env.NEXT_PUBLIC_APP_URL || "",
      });

      credentials.push({
        fullName,
        employeeCode,
        role: mapped.role,
        position,
        email,
        phone: normalizedPhone,
        username: login.username,
        temporaryPassword: login.temporaryPassword,
        smsSent: login.smsSent,
        emailSent: login.emailSent,
      });

      emailSet.add(email);
      phoneSet.add(normalizedPhone);
      codeSet.add(employeeCode.toLowerCase());
      seenEmail.add(email);
      seenPhone.add(normalizedPhone);
      seenCode.add(employeeCode.toLowerCase());
    } catch {
      await admin.from("staff").delete().eq("id", staff.id);
      invalid += 1;
    }
  }

  await admin.from("audit_logs").insert({
    school_id: profile.school_id,
    actor_user_id: profile.user_id,
    action: "Hosted Staff Bulk Onboarding",
    entity_type: "staff_import",
    details: {
      file_name: file.name,
      total_rows: rows.length,
      imported: credentials.length,
      duplicates_skipped: skipped,
      invalid,
    },
  });

  revalidatePath("/staff");
  revalidatePath("/dashboard");

  return {
    ok: credentials.length > 0,
    message:
      "Imported " + credentials.length + " staff. Skipped " + skipped +
      " duplicates and " + invalid + " invalid rows.",
    imported: credentials.length,
    skipped,
    invalid,
    credentials,
  };
}
