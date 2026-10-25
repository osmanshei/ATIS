"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function timetableReturnUrl(formData: FormData, messageKey: "ok" | "error", message: string) {
  const params = new URLSearchParams();
  const termId = value(formData, "term_id");
  const classId = value(formData, "view_class_id");
  const teacherId = value(formData, "view_teacher_id");
  const view = value(formData, "view_mode");

  if (termId) params.set("term", termId);
  if (view) params.set("view", view);
  if (classId) params.set("class", classId);
  if (teacherId) params.set("teacher", teacherId);
  params.set(messageKey, message);
  return "/timetable?" + params.toString();
}

export async function saveSchoolPeriodAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const yearId = value(formData, "academic_year_id");
  const periodId = value(formData, "period_id");

  const payload = {
    id: periodId,
    academic_year_id: yearId,
    period_number: value(formData, "period_number"),
    start_time: value(formData, "start_time"),
    end_time: value(formData, "end_time"),
    is_break: formData.get("is_break") === "on",
    label: value(formData, "label"),
    display_order: value(formData, "display_order"),
    day_type: value(formData, "day_type") || "regular",
    is_active: formData.get("is_active") === "on",
  };

  const { error } = await supabase.rpc("save_school_period", {
    p_payload: payload,
  });

  if (error) {
    redirect(
      "/timetable/periods?year=" + encodeURIComponent(yearId) +
        "&error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/timetable");
  revalidatePath("/timetable/periods");
  redirect(
    "/timetable/periods?year=" + encodeURIComponent(yearId) +
      "&ok=" + encodeURIComponent(periodId ? "Period updated." : "Period created."),
  );
}

export async function saveTimetableEntryAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const payload = {
    id: value(formData, "timetable_entry_id"),
    term_id: value(formData, "term_id"),
    teacher_assignment_id: value(formData, "teacher_assignment_id"),
    class_subject_aspect_id: value(formData, "class_subject_aspect_id"),
    day_of_week: value(formData, "day_of_week"),
    period_id: value(formData, "period_id"),
    room_number: value(formData, "room_number"),
    mode: value(formData, "mode") || "onsite",
    meeting_link: value(formData, "meeting_link"),
    notes: value(formData, "notes"),
    is_active: true,
  };

  const { error } = await supabase.rpc("save_timetable_entry", {
    p_payload: payload,
  });

  if (error) {
    redirect(timetableReturnUrl(formData, "error", error.message));
  }

  revalidatePath("/timetable");
  redirect(
    timetableReturnUrl(
      formData,
      "ok",
      value(formData, "timetable_entry_id") ? "Timetable lesson updated." : "Timetable lesson added.",
    ),
  );
}

export async function deactivateTimetableEntryAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const entryId = value(formData, "timetable_entry_id");

  const { error } = await supabase.rpc("deactivate_timetable_entry", {
    p_entry_id: entryId,
  });

  if (error) {
    redirect(timetableReturnUrl(formData, "error", error.message));
  }

  revalidatePath("/timetable");
  redirect(timetableReturnUrl(formData, "ok", "Timetable lesson removed."));
}
