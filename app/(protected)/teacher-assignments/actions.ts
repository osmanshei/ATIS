"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function createTeacherAssignmentAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const teacherId = String(formData.get("teacher_id") || "");
  const classSubjectId = String(formData.get("class_subject_id") || "");
  const periodsRaw = String(formData.get("periods_per_week") || "").trim();
  const isClassTeacher = formData.get("is_class_teacher") === "on";
  if (!teacherId || !classSubjectId) redirect("/teacher-assignments?error=Choose+a+teacher+and+class+subject.");

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("is_current", true)
    .single();
  if (!year) redirect("/teacher-assignments?error=Configure+a+current+academic+year+first.");

  const { error } = await supabase.from("teacher_assignments").insert({
    school_id: profile.school_id,
    teacher_id: teacherId,
    class_subject_id: classSubjectId,
    academic_year_id: year.id,
    periods_per_week: periodsRaw ? Number(periodsRaw) : null,
    is_class_teacher: isClassTeacher,
  });
  if (error) redirect(`/teacher-assignments?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/teacher-assignments");
  redirect("/teacher-assignments?ok=Teacher+assignment+saved.");
}
