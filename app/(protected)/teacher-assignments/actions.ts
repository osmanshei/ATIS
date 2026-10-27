"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function createTeacherAssignmentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const teacherId = String(formData.get("teacher_id") || "");
  const classId = String(formData.get("class_id") || "");
  const subjectIds = Array.from(
    new Set(formData.getAll("subject_ids").map((value) => String(value)).filter(Boolean)),
  );
  const isClassTeacher = formData.get("is_class_teacher") === "on";

  if (!teacherId || !classId) {
    redirect("/teacher-assignments?error=" + encodeURIComponent("Choose a teacher and class."));
  }
  if (!subjectIds.length) {
    redirect("/teacher-assignments?error=" + encodeURIComponent("Select at least one subject."));
  }

  const { data, error } = await supabase.rpc("save_teacher_assignment_bundle", {
    p_teacher_id: teacherId,
    p_class_id: classId,
    p_subject_ids: subjectIds,
    p_is_class_teacher: isClassTeacher,
  });

  if (error) {
    redirect("/teacher-assignments?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/teacher-assignments");
  revalidatePath("/classes");
  revalidatePath("/timetable");

  redirect(
    "/teacher-assignments?ok=" +
      encodeURIComponent(
        String(data || subjectIds.length) +
          " subject assignment(s) saved" +
          (isClassTeacher ? " and class-teacher responsibility assigned." : "."),
      ),
  );
}
