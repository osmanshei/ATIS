"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function createClassAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const className = String(formData.get("class_name") || "").trim();
  const section = String(formData.get("section") || "").trim();
  const gradeRaw = String(formData.get("grade_level") || "").trim();
  const capacityRaw = String(formData.get("max_capacity") || "").trim();

  if (!className) redirect("/classes?error=Class+name+is+required.");

  const { data: year } = await supabase
    .from("academic_years")
    .select("id")
    .eq("school_id", profile.school_id)
    .eq("is_current", true)
    .single();

  if (!year) redirect("/classes?error=Configure+a+current+academic+year+first.");

  const { error } = await supabase.from("classes").insert({
    school_id: profile.school_id,
    academic_year_id: year.id,
    class_name: className,
    section: section || null,
    grade_level: gradeRaw ? Number(gradeRaw) : null,
    max_capacity: capacityRaw ? Number(capacityRaw) : null,
  });

  if (error) redirect(`/classes?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/classes");
  redirect("/classes?ok=Class+created.");
}
