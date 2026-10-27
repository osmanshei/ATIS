"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { field, parseCsv, parseFlexibleDate } from "@/lib/csv";
import { normalizeGhanaPhone, provisionOrResetStaffLogin } from "@/lib/staff-access";
import {
  removeStaffPhoto,
  staffPhotoValidationError,
  uploadStaffPhoto,
} from "@/lib/staff-photo";
import {
  initialSingleStaffState,
  initialStaffBulkState,
} from "@/lib/staff-onboarding-state";
import type {
  SingleStaffState,
  StaffBulkState,
  StaffCredentialRow,
} from "@/lib/staff-onboarding-state";

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


export async function createSingleStaffAction(
  _previous: SingleStaffState,
  formData: FormData,
): Promise<SingleStaffState> {
  const { supabase, profile } = await requireProfile(["admin"]);
  const admin = createAdminClient();
  const photo = formData.get("photo");
  const photoError = staffPhotoValidationError(photo);
  if (photoError) {
    return { ok: false, message: photoError };
  }

  const fullName = clean(String(formData.get("full_name") || ""));
  const phoneRaw = clean(String(formData.get("mobile") || ""));
  const email = clean(String(formData.get("email") || "")).toLowerCase();
  const normalizedPhone = normalizeGhanaPhone(phoneRaw);

  if (!fullName || !normalizedPhone || !email) {
    return {
      ok: false,
      message: "Full name, phone number and email are required.",
    };
  }

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const requestedRole = clean(String(formData.get("role") || "teacher")).toLowerCase();
  const allowedRoles = new Set(["teacher", "supervisor", "clerk", "accountant", "staff"]);
  if (!allowedRoles.has(requestedRole)) {
    return { ok: false, message: "Choose a valid staff role." };
  }

  const { data: duplicate } = await admin
    .from("staff")
    .select("id,email,mobile,employee_code")
    .eq("school_id", profile.school_id)
    .or(
      "email.eq." +
        email +
        ",mobile.eq." +
        normalizedPhone,
    )
    .limit(1)
    .maybeSingle();

  if (duplicate) {
    return {
      ok: false,
      message: "A staff record with this email or phone number already exists.",
    };
  }

  let employeeCode = clean(String(formData.get("employee_code") || ""));
  if (!employeeCode) {
    const { data: generatedCode, error: codeError } = await supabase.rpc("next_staff_employee_code");
    if (codeError || !generatedCode) {
      return {
        ok: false,
        message: codeError?.message || "Could not generate an employee code.",
      };
    }
    employeeCode = String(generatedCode);
  }

  const { data: duplicateCode } = await admin
    .from("staff")
    .select("id")
    .eq("school_id", profile.school_id)
    .ilike("employee_code", employeeCode)
    .limit(1)
    .maybeSingle();

  if (duplicateCode) {
    return {
      ok: false,
      message: "That employee code is already in use.",
    };
  }

  const position =
    clean(String(formData.get("position_title") || "")) ||
    (requestedRole === "teacher"
      ? "Teacher"
      : requestedRole === "staff"
        ? "Staff"
        : requestedRole.charAt(0).toUpperCase() + requestedRole.slice(1));

  const { data: staff, error: insertError } = await admin
    .from("staff")
    .insert({
      school_id: profile.school_id,
      employee_code: employeeCode,
      full_name: fullName,
      email,
      mobile: normalizedPhone,
      role: requestedRole,
      position_title: position,
      gender: clean(String(formData.get("gender") || "")) || null,
      date_of_birth: clean(String(formData.get("date_of_birth") || "")) || null,
      qualification: clean(String(formData.get("qualification") || "")) || null,
      specialization_duty:
        clean(String(formData.get("specialization_duty") || "")) || position,
      joining_date: clean(String(formData.get("joining_date") || "")) || null,
      address: clean(String(formData.get("address") || "")) || null,
      emergency_contact_name:
        clean(String(formData.get("emergency_contact_name") || "")) || null,
      emergency_contact_phone:
        clean(String(formData.get("emergency_contact_phone") || "")) || null,
      status: "active",
      legacy_payload: {
        source: "hosted_single_staff_onboarding",
      },
    })
    .select("id")
    .single();

  if (insertError || !staff) {
    return {
      ok: false,
      message: insertError?.message || "Could not create the staff record.",
    };
  }

  let photoUploaded = false;
  if (photo instanceof File && photo.size > 0) {
    try {
      await uploadStaffPhoto(admin, {
        schoolId: profile.school_id,
        staffId: staff.id,
        file: photo,
      });
      photoUploaded = true;
    } catch (photoError) {
      await admin.from("staff").delete().eq("id", staff.id);
      return {
        ok: false,
        message:
          "Staff record could not be completed because the photo upload failed: " +
          (photoError instanceof Error ? photoError.message : "Unknown error"),
      };
    }
  }

  try {
    const login = await provisionOrResetStaffLogin(admin, {
      schoolId: profile.school_id,
      staffId: staff.id,
      sentBy: profile.user_id,
      loginUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    });

    await admin.from("audit_logs").insert({
      school_id: profile.school_id,
      actor_user_id: profile.user_id,
      action: "Hosted Single Staff Onboarding",
      entity_type: "staff",
      entity_id: staff.id,
      details: {
        employee_code: employeeCode,
        role: requestedRole,
        email,
        mobile: normalizedPhone,
      },
    });

    revalidatePath("/staff");
    revalidatePath("/dashboard");

    return {
      ok: true,
      message: "Staff member created successfully. Save the login details below.",
      staffId: staff.id,
      fullName,
      employeeCode,
      username: login.username,
      temporaryPassword: login.temporaryPassword,
      smsSent: login.smsSent,
      emailSent: login.emailSent,
    };
  } catch (error) {
    if (photoUploaded) {
      await removeStaffPhoto(admin, {
        schoolId: profile.school_id,
        staffId: staff.id,
        photoPath: profile.school_id + "/" + staff.id + "/profile",
      }).catch(() => undefined);
    }
    await admin.from("staff").delete().eq("id", staff.id);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The staff account could not be provisioned.",
    };
  }
}
