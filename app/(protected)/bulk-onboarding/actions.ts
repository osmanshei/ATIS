"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { field, normalizePhone, parseCsv, parseFlexibleDate } from "@/lib/csv";

function normalize(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function guardianIdentity(name: string, phone: string) {
  return `${normalizePhone(phone)}|${normalize(name)}`;
}

export async function bulkImportStudentsAction(formData: FormData) {
  const { profile } = await requireProfile(["admin", "supervisor", "clerk"]);
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

  const admin = createAdminClient();
  const { data: classes, error: classError } = await admin
    .from("classes")
    .select("id,class_name,section,class_code")
    .eq("school_id", profile.school_id)
    .eq("is_active", true);
  if (classError) redirect(`/bulk-onboarding?error=${encodeURIComponent(classError.message)}`);

  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of classes || []) {
    if (c.class_code) byCode.set(normalize(c.class_code), c.id);
    byName.set(normalize(`${c.class_name}${c.section ? ` ${c.section}` : ""}`), c.id);
    if (!c.section) byName.set(normalize(c.class_name), c.id);
  }

  const { data: currentStudents } = await admin
    .from("students")
    .select("admission_number")
    .eq("school_id", profile.school_id);
  const existingAdmissionNumbers = new Set(
    (currentStudents || []).map((s) => normalize(s.admission_number || "")).filter(Boolean),
  );

  const seenInFile = new Set<string>();
  const students: any[] = [];
  const guardianForAdmission = new Map<string, {
    name: string;
    relation: string;
    mobile: string;
    address: string;
    city: string;
  }>();

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

    seenInFile.add(normalizedAdmission);

    students.push({
      school_id: profile.school_id,
      admission_number: admissionNumber,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      gender: field(row, "Gender") || null,
      date_of_birth: dateOfBirth,
      admission_date: admissionDate || new Date().toISOString().slice(0, 10),
      class_id: classId,
      address_line: field(row, "AddressLine", "Address") || null,
      city: field(row, "City", "Town") || null,
      region: field(row, "Region", "State") || null,
      nhis_no: field(row, "NHISNo", "NHIS No") || null,
      ghana_card_no: field(row, "GhanaCardNo", "Ghana Card No") || null,
      medical_notes: field(row, "MedicalNotes", "Medical Notes") || null,
      status: "active",
      legacy_payload: {
        source: "hosted_bulk_onboarding",
        import_file: file.name,
      },
    });

    const guardianName = field(row, "GuardianName", "Guardian Name");
    const guardianMobile = normalizePhone(field(row, "GuardianMobile", "Guardian Phone", "GuardianMobileNumber"));
    if (guardianName || guardianMobile) {
      guardianForAdmission.set(normalizedAdmission, {
        name: guardianName || "Guardian",
        relation: field(row, "GuardianRelation", "Guardian Relation") || "Guardian",
        mobile: guardianMobile,
        address: field(row, "AddressLine", "Address"),
        city: field(row, "City", "Town"),
      });
    }
  }

  if (!students.length) {
    redirect(
      `/bulk-onboarding?error=${encodeURIComponent(
        `No valid new students. Invalid: ${invalid}; duplicates: ${duplicates}.`,
      )}`,
    );
  }

  const { data: insertedStudents, error: insertError } = await admin
    .from("students")
    .insert(students)
    .select("id,admission_number");
  if (insertError) redirect(`/bulk-onboarding?error=${encodeURIComponent(insertError.message)}`);

  const guardianCandidates = new Map<string, {
    migration_key: string;
    full_name: string;
    mobile: string | null;
    address: string | null;
    city: string | null;
    country: string;
    nationality: string;
    whatsapp_number: string | null;
    status: string;
    legacy_payload: any;
  }>();

  for (const g of guardianForAdmission.values()) {
    const identity = guardianIdentity(g.name, g.mobile);
    guardianCandidates.set(identity, {
      migration_key: `live|${g.mobile}|${normalize(g.name)}|${normalize(g.relation)}`,
      full_name: g.name,
      mobile: g.mobile || null,
      address: g.address || null,
      city: g.city || null,
      country: "Ghana",
      nationality: "Ghanaian",
      whatsapp_number: g.mobile || null,
      status: "active",
      legacy_payload: { source: "hosted_bulk_onboarding", relation_hint: g.relation },
    });
  }

  const { data: existingGuardians } = await admin
    .from("guardians")
    .select("id,full_name,mobile,migration_key")
    .eq("school_id", profile.school_id);

  const guardianByIdentity = new Map<string, string>();
  for (const g of existingGuardians || []) {
    guardianByIdentity.set(guardianIdentity(g.full_name || "", g.mobile || ""), g.id);
  }

  const newGuardians = [...guardianCandidates.entries()]
    .filter(([identity]) => !guardianByIdentity.has(identity))
    .map(([, g]) => ({ school_id: profile.school_id, ...g }));

  if (newGuardians.length) {
    const { data: createdGuardians, error: guardianError } = await admin
      .from("guardians")
      .insert(newGuardians)
      .select("id,full_name,mobile");
    if (guardianError) {
      redirect(`/bulk-onboarding?error=${encodeURIComponent(
        "Students were imported, but guardian creation failed: " + guardianError.message,
      )}`);
    }
    for (const g of createdGuardians || []) {
      guardianByIdentity.set(guardianIdentity(g.full_name || "", g.mobile || ""), g.id);
    }
  }

  const studentIdByAdmission = new Map(
    (insertedStudents || []).map((s) => [normalize(s.admission_number || ""), s.id]),
  );
  const links: any[] = [];

  for (const [admission, g] of guardianForAdmission) {
    const studentId = studentIdByAdmission.get(admission);
    const guardianId = guardianByIdentity.get(guardianIdentity(g.name, g.mobile));
    if (studentId && guardianId) {
      links.push({
        school_id: profile.school_id,
        student_id: studentId,
        guardian_id: guardianId,
        relation: g.relation,
        is_primary_contact: true,
      });
    }
  }

  if (links.length) {
    const { error: linkError } = await admin
      .from("student_guardians")
      .upsert(links, { onConflict: "student_id,guardian_id", ignoreDuplicates: false });
    if (linkError) {
      redirect(`/bulk-onboarding?error=${encodeURIComponent(
        "Students were imported, but some guardian links failed: " + linkError.message,
      )}`);
    }
  }

  await admin.from("audit_logs").insert({
    school_id: profile.school_id,
    actor_user_id: profile.user_id,
    action: "Hosted Student Bulk Onboarding",
    entity_type: "student_import",
    details: {
      file_name: file.name,
      total_rows: records.length,
      imported: insertedStudents?.length || 0,
      duplicates,
      invalid,
    },
  });

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/classes");
  redirect(
    `/bulk-onboarding?ok=${encodeURIComponent(
      `Imported ${insertedStudents?.length || 0} students. Skipped ${duplicates} duplicates and ${invalid} invalid rows.`,
    )}`,
  );
}
