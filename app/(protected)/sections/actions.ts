"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

const COLOUR_SECTIONS = ["Red", "Yellow", "Green", "Blue"] as const;

export async function assignSectionMasterAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin"]);
  const sectionName = String(formData.get("section_name") || "").trim();
  const teacherId = String(formData.get("teacher_id") || "").trim();
  const assistantTeacherId = String(formData.get("assistant_teacher_id") || "").trim();

  if (!COLOUR_SECTIONS.includes(sectionName as (typeof COLOUR_SECTIONS)[number])) {
    redirect("/sections?error=" + encodeURIComponent("Choose a valid colour section."));
  }

  if (teacherId && assistantTeacherId && teacherId === assistantTeacherId) {
    redirect("/sections/" + sectionName.toLowerCase() + "?error=" + encodeURIComponent("Choose two different teachers for the master and assistant roles."));
  }

  const assignedTeacherIds = [teacherId, assistantTeacherId].filter(Boolean);
  if (assignedTeacherIds.length) {
    const { data: validTeachers, error: teacherError } = await supabase
      .from("staff")
      .select("id")
      .in("id", assignedTeacherIds)
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .eq("status", "active");

    if (teacherError || (validTeachers || []).length !== assignedTeacherIds.length) {
      redirect("/sections/" + sectionName.toLowerCase() + "?error=" + encodeURIComponent("Choose active teachers from this school for both roles."));
    }
  }

  const { error } = await supabase
    .from("school_sections")
    .update({ section_master_id: teacherId || null, assistant_section_master_id: assistantTeacherId || null })
    .eq("school_id", profile.school_id)
    .eq("section_name", sectionName);

  if (error) {
    redirect("/sections/" + sectionName.toLowerCase() + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/sections");
  revalidatePath("/sections/" + sectionName.toLowerCase());
  redirect("/sections/" + sectionName.toLowerCase() + "?ok=" + encodeURIComponent(
    teacherId || assistantTeacherId ? sectionName + " section leadership assignments saved." : sectionName + " section leadership assignments cleared."
  ));
}
