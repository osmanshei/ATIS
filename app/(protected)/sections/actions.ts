"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function assignSectionMasterAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const classId = String(formData.get("class_id") || "").trim();
  const teacherId = String(formData.get("teacher_id") || "").trim();

  if (!classId) redirect("/sections?error=Select+a+section+first.");

  if (teacherId) {
    const { data: teacher, error: teacherError } = await supabase
      .from("staff")
      .select("id,full_name")
      .eq("id", teacherId)
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .eq("status", "active")
      .maybeSingle();

    if (teacherError || !teacher) {
      redirect("/sections/" + classId + "?error=" + encodeURIComponent("Choose an active teacher from this school."));
    }
  }

  const { data: cls, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (classError || !cls) redirect("/sections?error=Section+not+found.");

  const { error } = await supabase
    .from("classes")
    .update({ class_teacher_id: teacherId || null })
    .eq("id", classId)
    .eq("school_id", profile.school_id);

  if (error) {
    redirect("/sections/" + classId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/sections");
  revalidatePath("/sections/" + classId);
  revalidatePath("/classes");
  revalidatePath("/students");
  redirect("/sections/" + classId + "?ok=" + encodeURIComponent(teacherId ? "Section master assigned." : "Section master assignment cleared."));
}
