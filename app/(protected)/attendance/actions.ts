"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveAttendanceAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);

  const classId = value(formData, "class_id");
  const attendanceDate = value(formData, "attendance_date");
  const notes = value(formData, "notes");
  const raw = value(formData, "records_json");

  let records: unknown;
  try {
    records = JSON.parse(raw);
  } catch {
    redirect(
      `/attendance/register?class=${encodeURIComponent(classId)}&date=${encodeURIComponent(attendanceDate)}&error=Invalid+attendance+payload.`,
    );
  }

  const { error } = await supabase.rpc("save_daily_attendance", {
    p_class_id: classId,
    p_attendance_date: attendanceDate,
    p_records: records,
    p_notes: notes || null,
  });

  if (error) {
    redirect(
      `/attendance/register?class=${encodeURIComponent(classId)}&date=${encodeURIComponent(attendanceDate)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/attendance");
  revalidatePath("/attendance/reports");
  revalidatePath("/dashboard");
  redirect(
    `/attendance/register?class=${encodeURIComponent(classId)}&date=${encodeURIComponent(attendanceDate)}&ok=Attendance+saved+successfully.`,
  );
}

export async function setAttendanceLockAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const sessionId = value(formData, "session_id");
  const classId = value(formData, "class_id");
  const attendanceDate = value(formData, "attendance_date");
  const locked = value(formData, "locked") === "true";

  const { error } = await supabase.rpc("set_attendance_lock", {
    p_session_id: sessionId,
    p_locked: locked,
  });

  if (error) {
    redirect(
      `/attendance/register?class=${encodeURIComponent(classId)}&date=${encodeURIComponent(attendanceDate)}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/attendance");
  revalidatePath("/attendance/reports");
  redirect(
    `/attendance/register?class=${encodeURIComponent(classId)}&date=${encodeURIComponent(attendanceDate)}&ok=${locked ? "Attendance+locked." : "Attendance+unlocked."}`,
  );
}
