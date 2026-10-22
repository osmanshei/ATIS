"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function createSubjectAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const name = String(formData.get("subject_name") || "").trim();
  const code = String(formData.get("subject_code") || "").trim().toUpperCase();
  if (!name || !code) redirect("/subjects?error=Subject+name+and+code+are+required.");
  const { error } = await supabase.from("subject_catalogue").insert({
    school_id: profile.school_id,
    subject_name: name,
    subject_code: code,
  });
  if (error) redirect(`/subjects?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/subjects");
  redirect("/subjects?ok=Subject+created.");
}

export async function attachSubjectToClassAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const classId = String(formData.get("class_id") || "");
  const subjectId = String(formData.get("subject_id") || "");
  const maxMarks = Number(formData.get("max_marks") || 100);
  const passMarks = Number(formData.get("pass_marks") || 50);
  if (!classId || !subjectId) redirect("/subjects?error=Choose+a+class+and+subject.");
  const { error } = await supabase.from("class_subjects").insert({
    school_id: profile.school_id,
    class_id: classId,
    subject_id: subjectId,
    max_marks: maxMarks,
    pass_marks: passMarks,
  });
  if (error) redirect(`/subjects?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/subjects");
  redirect("/subjects?ok=Subject+attached+to+class.");
}
