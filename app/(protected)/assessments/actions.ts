"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function initializeTermAssessmentsAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const termId = value(formData, "term_id");
  const caWeight = Number(value(formData, "ca_weight") || "40");
  const examWeight = Number(value(formData, "exam_weight") || "60");

  const { data, error } = await supabase.rpc("initialize_term_assessments", {
    p_term_id: termId,
    p_ca_weight: caWeight,
    p_exam_weight: examWeight,
  });

  if (error) redirect("/assessments?error=" + encodeURIComponent(error.message));

  revalidatePath("/assessments");
  redirect("/assessments?ok=" + encodeURIComponent(String(data || 0) + " assessment setups created."));
}

export async function saveAssessmentSetupAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const payload = {
    term_id: value(formData, "term_id"),
    class_subject_id: value(formData, "class_subject_id"),
    ca_weight: value(formData, "ca_weight") || "40",
    exam_weight: value(formData, "exam_weight") || "60",
    ca_max_mark: value(formData, "ca_max_mark") || "130",
    grade_scheme_id: value(formData, "grade_scheme_id"),
    status: value(formData, "status") || "active",
  };

  const { error } = await supabase.rpc("save_assessment_setup", { p_payload: payload });
  if (error) redirect("/assessments?error=" + encodeURIComponent(error.message));

  revalidatePath("/assessments");
  redirect("/assessments?ok=Assessment+setup+saved.");
}


export async function initializeStandardCaAssessmentsAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const setupId = value(formData, "setup_id");

  if (!setupId) redirect("/assessments?error=Assessment+setup+is+missing.");

  const { data, error } = await supabase.rpc("initialize_standard_ca_assessments", {
    p_setup_id: setupId,
  });

  if (error) {
    redirect("/assessments/" + setupId + "?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/assessments/" + setupId);
  revalidatePath("/results");
  redirect(
    "/assessments/" + setupId + "?ok=" +
      encodeURIComponent("Standard CA setup ready. Created " + String(data || 0) + " missing assessment slots; existing slots were preserved."),
  );
}

export async function saveCaAssessmentAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const setupId = value(formData, "setup_id");
  const payload = {
    setup_id: setupId,
    component: value(formData, "component") || "class_test",
    assessment_no: value(formData, "assessment_no") || "1",
    assessment_name: value(formData, "assessment_name"),
    max_mark: value(formData, "max_mark"),
    assessment_date: value(formData, "assessment_date"),
    status: value(formData, "status") || "open",
  };

  const { error } = await supabase.rpc("save_ca_assessment", { p_payload: payload });
  if (error) redirect("/assessments/" + setupId + "?error=" + encodeURIComponent(error.message));

  revalidatePath("/assessments/" + setupId);
  redirect("/assessments/" + setupId + "?ok=CA+assessment+saved.");
}

export async function saveCaScoresAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const setupId = value(formData, "setup_id");
  const assessmentId = value(formData, "assessment_id");

  let records: unknown;
  try {
    records = JSON.parse(value(formData, "records_json"));
  } catch {
    redirect("/assessments/" + setupId + "/ca/" + assessmentId + "/scores?error=Invalid+score+payload.");
  }

  const { error } = await supabase.rpc("save_ca_scores", {
    p_assessment_id: assessmentId,
    p_records: records,
  });

  if (error) {
    redirect("/assessments/" + setupId + "/ca/" + assessmentId + "/scores?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/assessments/" + setupId);
  revalidatePath("/results");
  redirect("/assessments/" + setupId + "/ca/" + assessmentId + "/scores?ok=CA+scores+saved.");
}

export async function saveExamScoresAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const setupId = value(formData, "setup_id");
  const maxMark = Number(value(formData, "max_mark") || "100");

  let records: unknown;
  try {
    records = JSON.parse(value(formData, "records_json"));
  } catch {
    redirect("/assessments/" + setupId + "/exam?error=Invalid+score+payload.");
  }

  const { error } = await supabase.rpc("save_exam_scores", {
    p_setup_id: setupId,
    p_max_mark: maxMark,
    p_records: records,
  });

  if (error) {
    redirect("/assessments/" + setupId + "/exam?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/assessments/" + setupId);
  revalidatePath("/results");
  redirect("/assessments/" + setupId + "/exam?ok=Exam+scores+saved.");
}
