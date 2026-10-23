"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function createStaffContractAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin"]);

  const payload = {
    staff_id: value(formData, "staff_id"),
    employment_type: value(formData, "employment_type") || "fixed_term",
    position_title: value(formData, "position_title"),
    department: value(formData, "department"),
    assigned_class: value(formData, "assigned_class"),
    subjects: value(formData, "subjects"),
    start_date: value(formData, "start_date"),
    probation_end_date: value(formData, "probation_end_date"),
    end_date: value(formData, "end_date"),
    base_salary: value(formData, "base_salary") || "0",
    working_hours: value(formData, "working_hours"),
    reporting_to: value(formData, "reporting_to"),
    work_location: value(formData, "work_location") || "ATIS",
    notice_period: value(formData, "notice_period"),
    benefits_notes: value(formData, "benefits_notes"),
    notes: value(formData, "notes"),
    status: value(formData, "status") || "draft",
  };

  const { error } = await supabase.rpc("save_staff_contract", { p_payload: payload });
  if (error) redirect("/staff/contracts?error=" + encodeURIComponent(error.message));

  revalidatePath("/staff/contracts");
  redirect("/staff/contracts?ok=Staff+appointment%2Fcontract+created.");
}

export async function activateStaffContractAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const id = value(formData, "contract_id");

  const { error } = await supabase.rpc("activate_staff_contract", {
    p_contract_id: id,
  });
  if (error) redirect("/staff/contracts?error=" + encodeURIComponent(error.message));

  revalidatePath("/staff/contracts");
  redirect("/staff/contracts?ok=Appointment+activated.+The+appointment+letter+is+ready.");
}

export async function terminateStaffContractAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const id = value(formData, "contract_id");
  const date = value(formData, "termination_date");
  const reason = value(formData, "reason");

  const { error } = await supabase.rpc("terminate_staff_contract", {
    p_contract_id: id,
    p_termination_date: date,
    p_reason: reason,
  });
  if (error) redirect("/staff/contracts?error=" + encodeURIComponent(error.message));

  revalidatePath("/staff/contracts");
  redirect("/staff/contracts?ok=Contract+terminated.");
}
