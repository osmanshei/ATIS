"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  removeStudentPhoto,
  studentPhotoValidationError,
  uploadStudentPhoto,
} from "@/lib/student-photo";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function updateStudentAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const studentId = value(formData, "student_id");
  const photo = formData.get("photo");
  const photoError = studentPhotoValidationError(photo);
  if (photoError) {
    redirect("/students/" + studentId + "/edit?error=" + encodeURIComponent(photoError));
  }

  const payload = {
    admission_number: value(formData, "admission_number"),
    first_name: value(formData, "first_name"),
    middle_name: value(formData, "middle_name"),
    last_name: value(formData, "last_name"),
    preferred_name: value(formData, "preferred_name"),
    gender: value(formData, "gender"),
    date_of_birth: value(formData, "date_of_birth"),
    admission_date: value(formData, "admission_date"),
    class_id: value(formData, "class_id"),
    roll_number: value(formData, "roll_number"),
    category: value(formData, "category"),
    address_line: value(formData, "address_line"),
    city: value(formData, "city"),
    region: value(formData, "region"),
    nationality: value(formData, "nationality") || "Ghanaian",
    medical_notes: value(formData, "medical_notes"),
    dietary_requirements: value(formData, "dietary_requirements"),
    allergies: value(formData, "allergies"),
    special_needs: value(formData, "special_needs"),
    house_name: value(formData, "house_name"),
    admission_type: value(formData, "admission_type"),
    concession_percent: value(formData, "concession_percent") || "0",
    transport_required: formData.get("transport_required") === "on",
    transport_route: value(formData, "transport_route"),
    status: value(formData, "status") || "active",
  };

  const { error } = await supabase.rpc("update_student_record", {
    p_student_id: studentId,
    p_payload: payload,
  });

  if (error) {
    redirect("/students/" + studentId + "/edit?error=" + encodeURIComponent(error.message));
  }

  if (photo instanceof File && photo.size > 0) {
    try {
      await uploadStudentPhoto(supabase, {
        schoolId: profile.school_id,
        studentId,
        file: photo,
      });
    } catch (photoUploadError) {
      redirect(
        "/students/" + studentId + "/edit?error=" +
          encodeURIComponent(
            "Student details were saved, but the photo could not be uploaded: " +
              (photoUploadError instanceof Error ? photoUploadError.message : "Unknown error"),
          ),
      );
    }
  }

  revalidatePath("/students");
  revalidatePath("/students/" + studentId + "/edit");
  revalidatePath("/finance");
  revalidatePath("/finance/balances");
  redirect("/students?ok=" + encodeURIComponent("Student updated."));
}


export async function createStudentAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const photo = formData.get("photo");
  const photoError = studentPhotoValidationError(photo);
  if (photoError) {
    redirect("/students/new?error=" + encodeURIComponent(photoError));
  }

  const admissionNumber = value(formData, "admission_number");
  const firstName = value(formData, "first_name");
  const lastName = value(formData, "last_name");
  const classId = value(formData, "class_id");

  if (!admissionNumber || !firstName || !lastName || !classId) {
    redirect(
      "/students/new?error=" +
        encodeURIComponent("Admission number, first name, last name and class are required."),
    );
  }

  const row = {
    admission_number: admissionNumber,
    first_name: firstName,
    middle_name: value(formData, "middle_name") || null,
    last_name: lastName,
    gender: value(formData, "gender") || null,
    date_of_birth: value(formData, "date_of_birth") || null,
    admission_date: value(formData, "admission_date") || null,
    class_id: classId,
    guardian_name: value(formData, "guardian_name") || null,
    guardian_relation: value(formData, "guardian_relation") || "Guardian",
    guardian_mobile: value(formData, "guardian_mobile") || null,
    address_line: value(formData, "address_line") || null,
    city: value(formData, "city") || null,
    region: value(formData, "region") || null,
    nhis_no: value(formData, "nhis_no") || null,
    ghana_card_no: value(formData, "ghana_card_no") || null,
    medical_notes: value(formData, "medical_notes") || null,
  };

  const { data, error } = await supabase.rpc("bulk_onboard_students", {
    p_rows: [row],
    p_file_name: "single_student_entry",
  });

  if (error) {
    redirect("/students/new?error=" + encodeURIComponent(error.message));
  }

  const imported = Number((data as any)?.imported || 0);
  const duplicates = Number((data as any)?.duplicates || 0);

  if (!imported && duplicates) {
    redirect(
      "/students/new?error=" +
        encodeURIComponent("A student with this admission number already exists."),
    );
  }

  if (!imported) {
    redirect(
      "/students/new?error=" +
        encodeURIComponent("The student could not be added. Please review the details."),
    );
  }

  const { data: createdStudent } = await supabase
    .from("students")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("admission_number", admissionNumber)
    .maybeSingle();

  if (createdStudent && photo instanceof File && photo.size > 0) {
    try {
      await uploadStudentPhoto(supabase, {
        schoolId: profile.school_id,
        studentId: createdStudent.id,
        file: photo,
      });
    } catch (photoUploadError) {
      redirect(
        "/students/" + createdStudent.id + "/edit?error=" +
          encodeURIComponent(
            "Student was added, but the photo could not be uploaded: " +
              (photoUploadError instanceof Error ? photoUploadError.message : "Unknown error"),
          ),
      );
    }
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/classes");
  revalidatePath("/finance");
  revalidatePath("/finance/balances");

  redirect("/students?ok=" + encodeURIComponent("Student added successfully."));
}


export async function removeStudentPhotoAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const studentId = value(formData, "student_id");

  const { data: student, error } = await supabase
    .from("students")
    .select("id,photo_url")
    .eq("id", studentId)
    .eq("school_id", profile.school_id)
    .single();

  if (error || !student) {
    redirect("/students?error=" + encodeURIComponent("Student record not found."));
  }

  try {
    await removeStudentPhoto(supabase, {
      schoolId: profile.school_id,
      studentId,
      photoPath: student.photo_url,
    });
  } catch (removeError) {
    redirect(
      "/students/" + studentId + "/edit?error=" +
        encodeURIComponent(
          removeError instanceof Error ? removeError.message : "Could not remove student photo.",
        ),
    );
  }

  revalidatePath("/students");
  revalidatePath("/students/" + studentId + "/edit");
  revalidatePath("/results");
  redirect("/students/" + studentId + "/edit?ok=" + encodeURIComponent("Student photo removed."));
}
