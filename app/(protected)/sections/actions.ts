"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

const COLOUR_SECTIONS = ["Red", "Yellow", "Green", "Blue"] as const;

export async function assignSectionMasterAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin"]);
  const sectionName = String(formData.get("section_name") || "").trim();
  const teacherId = String(formData.get("teacher_id") || "").trim();

  if (!COLOUR_SECTIONS.includes(sectionName as (typeof COLOUR_SECTIONS)[number])) {
    redirect("/sections?error=" + encodeURIComponent("Choose a valid colour section."));
  }

  if (teacherId) {
    const { data: teacher, error: teacherError } = await supabase
      .from("staff")
      .select("id")
      .eq("id", teacherId)
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .eq("status", "active")
      .maybeSingle();

    if (teacherError || !teacher) {
      redirect("/sections/" + sectionName.toLowerCase() + "?error=" + encodeURIComponent("Choose an active teacher from this school."));
    }
  }

  const { error } = await supabase
    .from("school_sections")
    .update({ section_master_id: teacherId || null })
    .eq("school_id", profile.school_id)
    .eq("section_name", sectionName);

  if (error) {
    redirect("/sections/" + sectionName.toLowerCase() + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/sections");
  revalidatePath("/sections/" + sectionName.toLowerCase());
  redirect("/sections/" + sectionName.toLowerCase() + "?ok=" + encodeURIComponent(
    teacherId ? sectionName + " Section Master assigned." : sectionName + " Section Master assignment cleared."
  ));
}
