"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function setResultPublicationAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const classId = value(formData, "class_id");
  const termId = value(formData, "term_id");
  const status = value(formData, "status");
  const notes = value(formData, "notes");

  const { error } = await supabase.rpc("set_result_publication", {
    p_class_id: classId,
    p_term_id: termId,
    p_status: status,
    p_notes: notes || null,
  });

  if (error) {
    redirect(
      "/results/class/" +
        classId +
        "?term=" +
        encodeURIComponent(termId) +
        "&error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/results");
  revalidatePath("/results/class/" + classId);
  redirect(
    "/results/class/" +
      classId +
      "?term=" +
      encodeURIComponent(termId) +
      "&ok=Publication+status+updated.",
  );
}

export async function saveReportRemarkAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const classId = value(formData, "class_id");
  const termId = value(formData, "term_id");
  const studentId = value(formData, "student_id");

  const payload = {
    class_id: classId,
    term_id: termId,
    student_id: studentId,
    teacher_remark: value(formData, "teacher_remark"),
    headteacher_remark: value(formData, "headteacher_remark"),
    conduct: value(formData, "conduct"),
    next_term_begins: value(formData, "next_term_begins"),
  };

  const { error } = await supabase.rpc("save_report_remark", { p_payload: payload });

  if (error) {
    redirect(
      "/results/report-card/" +
        studentId +
        "?term=" +
        encodeURIComponent(termId) +
        "&error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/results/report-card/" + studentId);
  redirect(
    "/results/report-card/" +
      studentId +
      "?term=" +
      encodeURIComponent(termId) +
      "&ok=Report+remarks+saved.",
  );
}
