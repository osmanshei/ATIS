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


export async function saveAllCaScoresAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);
  const setupId = value(formData, "setup_id");
  let groups: unknown;

  try {
    groups = JSON.parse(value(formData, "records_json"));
  } catch {
    redirect("/assessments/" + setupId + "/ca-entry?error=Invalid+scorebook+payload.");
  }

  if (!setupId || !Array.isArray(groups) || groups.length === 0) {
    redirect("/assessments/" + setupId + "/ca-entry?error=No+CA+assessment+scores+were+provided.");
  }

  const { data: setup, error: setupError } = await supabase
    .from("assessment_setup_summary")
    .select("id,status")
    .eq("id", setupId)
    .maybeSingle();

  if (setupError || !setup) {
    redirect("/assessments?error=Assessment+setup+not+found.");
  }
  if (setup.status === "locked") {
    redirect("/assessments/" + setupId + "/ca-entry?error=This+subject+setup+is+locked.");
  }

  const { data: availableAssessments, error: assessmentError } = await supabase
    .from("ca_assessment_summary")
    .select("id,setup_id,status")
    .eq("setup_id", setupId);

  if (assessmentError) {
    redirect("/assessments/" + setupId + "/ca-entry?error=" + encodeURIComponent(assessmentError.message));
  }

  const byId = new Map((availableAssessments || []).map((assessment: any) => [assessment.id, assessment]));
  const submittedIds = new Set<string>();

  for (const item of groups as any[]) {
    const assessmentId = String(item?.assessment_id || "");
    const assessment = byId.get(assessmentId) as any;
    if (!assessment || assessment.setup_id !== setupId) {
      redirect("/assessments/" + setupId + "/ca-entry?error=An+assessment+does+not+belong+to+this+subject.");
    }
    if (assessment.status === "closed") {
      redirect("/assessments/" + setupId + "/ca-entry?error=One+or+more+CA+assessments+are+closed.+Use+the+individual+assessment+page+to+manage+them.");
    }
    if (submittedIds.has(assessmentId)) {
      redirect("/assessments/" + setupId + "/ca-entry?error=Duplicate+assessment+in+the+scorebook+payload.");
    }
    submittedIds.add(assessmentId);
    if (!Array.isArray(item.records)) {
      redirect("/assessments/" + setupId + "/ca-entry?error=Invalid+student+scores+in+the+scorebook.");
    }
  }

  let savedGroups = 0;
  for (const item of groups as any[]) {
    const { error } = await supabase.rpc("save_ca_scores", {
      p_assessment_id: String(item.assessment_id),
      p_records: item.records,
    });
    if (error) {
      const detail = savedGroups
        ? "Some assessment columns may already have been saved. " + error.message
        : error.message;
      redirect("/assessments/" + setupId + "/ca-entry?error=" + encodeURIComponent(detail));
    }
    savedGroups += 1;
  }

  revalidatePath("/assessments/" + setupId);
  revalidatePath("/assessments/" + setupId + "/ca-entry");
  revalidatePath("/results");
  redirect(
    "/assessments/" + setupId + "/ca-entry?ok=" +
      encodeURIComponent("Saved CA scores for " + savedGroups + " assessment columns."),
  );
}
