"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { field, parseCsv, parseFlexibleDate } from "@/lib/csv";

function normalize(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function bulkImportStudentsAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/bulk-onboarding?error=Choose+a+CSV+file.");
  }
  if (file.size > 3_000_000) {
    redirect("/bulk-onboarding?error=The+CSV+file+is+too+large.");
  }

  const records = parseCsv(await file.text());
  if (!records.length) {
    redirect("/bulk-onboarding?error=No+student+rows+were+found+in+the+CSV.");
  }
  if (records.length > 1500) {
    redirect("/bulk-onboarding?error=This+import+is+limited+to+1500+students+at+a+time.");
  }

  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id,class_name,section,class_code")
    .eq("is_active", true);
  if (classError) redirect(`/bulk-onboarding?error=${encodeURIComponent(classError.message)}`);

  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of classes || []) {
    if (c.class_code) byCode.set(normalize(c.class_code), c.id);
    byName.set(normalize(`${c.class_name}${c.section ? ` ${c.section}` : ""}`), c.id);
    if (!c.section) byName.set(normalize(c.class_name), c.id);
  }

  const { data: currentStudents } = await supabase
    .from("students")
    .select("admission_number");
  const existingAdmissionNumbers = new Set(
    (currentStudents || []).map((s) => normalize(s.admission_number || "")).filter(Boolean),
  );

  const seenInFile = new Set<string>();
  const rows: any[] = [];
  let invalid = 0;
  let duplicates = 0;

  for (const row of records) {
    const admissionNumber = field(row, "AdmissionNumber", "Admission Number", "ADM No", "Admission No");
    const firstName = field(row, "FirstName", "First Name");
    const middleName = field(row, "MiddleName", "Middle Name");
    const lastName = field(row, "LastName", "Last Name", "Surname");
    const classCode = field(row, "ClassCode", "Class Code");
    const className = field(row, "ClassName", "Class Name", "Class");
    const section = field(row, "Section");
    const classId =
      byCode.get(normalize(classCode)) ||
      byName.get(normalize(`${className}${section ? ` ${section}` : ""}`)) ||
      byName.get(normalize(className));

    const normalizedAdmission = normalize(admissionNumber);
    if (!admissionNumber || !firstName || !lastName || !classId) {
      invalid += 1;
      continue;
    }

    if (
      existingAdmissionNumbers.has(normalizedAdmission) ||
      seenInFile.has(normalizedAdmission)
    ) {
      duplicates += 1;
      continue;
    }

    const dateOfBirthRaw = field(row, "DateOfBirth", "Date of Birth", "DOB");
    const admissionDateRaw = field(row, "AdmissionDate", "Admission Date");
    const dateOfBirth = dateOfBirthRaw ? parseFlexibleDate(dateOfBirthRaw) : null;
    const admissionDate = admissionDateRaw ? parseFlexibleDate(admissionDateRaw) : null;

    if (dateOfBirthRaw && !dateOfBirth) {
      invalid += 1;
      continue;
    }
    if (admissionDateRaw && !admissionDate) {
      invalid += 1;
      continue;
    }

    seenInFile.add(normalizedAdmission);
    rows.push({
      admission_number: admissionNumber,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      gender: field(row, "Gender") || null,
      date_of_birth: dateOfBirth,
      admission_date: admissionDate,
      class_id: classId,
      guardian_name: field(row, "GuardianName", "Guardian Name") || null,
      guardian_relation: field(row, "GuardianRelation", "Guardian Relation") || "Guardian",
      guardian_mobile: field(row, "GuardianMobile", "Guardian Phone", "GuardianMobileNumber") || null,
      address_line: field(row, "AddressLine", "Address") || null,
      city: field(row, "City", "Town") || null,
      region: field(row, "Region", "State") || null,
      nhis_no: field(row, "NHISNo", "NHIS No") || null,
      ghana_card_no: field(row, "GhanaCardNo", "Ghana Card No") || null,
      medical_notes: field(row, "MedicalNotes", "Medical Notes") || null,
    });
  }

  if (!rows.length) {
    redirect(
      `/bulk-onboarding?error=${encodeURIComponent(
        `No valid new students. Invalid: ${invalid}; duplicates: ${duplicates}.`,
      )}`,
    );
  }

  const { data, error } = await supabase.rpc("bulk_onboard_students", {
    p_rows: rows,
    p_file_name: file.name,
  });

  if (error) redirect(`/bulk-onboarding?error=${encodeURIComponent(error.message)}`);

  const imported = Number((data as any)?.imported || 0);
  const databaseDuplicates = Number((data as any)?.duplicates || 0);
  const totalDuplicates = duplicates + databaseDuplicates;

  revalidatePath("/students");
  revalidatePath("/sections");
  revalidatePath("/dashboard");
  revalidatePath("/classes");

  redirect(
    `/bulk-onboarding?ok=${encodeURIComponent(
      `Imported ${imported} students. Skipped ${totalDuplicates} duplicates and ${invalid} invalid rows.`,
    )}`,
  );
}
