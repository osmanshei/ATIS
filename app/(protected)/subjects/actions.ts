"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export async function createSubjectAction(formData: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor"]);
  const name = String(formData.get("subject_name") || "").trim();
  const code = String(formData.get("subject_code") || "").trim().toUpperCase();
  if (!name || !code) redirect("/subjects?error=Subject+name+and+code+are+required.");
  const includeOnReport = formData.get("include_on_report") === "on";
  const { error } = await supabase.from("subject_catalogue").insert({
    school_id: profile.school_id,
    subject_name: name,
    subject_code: code,
    include_on_report: includeOnReport,
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


export async function setSubjectReportFlagAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const subjectId = String(formData.get("subject_id") || "");
  const includeOnReport = String(formData.get("include_on_report") || "") === "true";

  if (!subjectId) {
    redirect("/subjects?error=Subject+is+required.");
  }

  const { error } = await supabase.rpc("set_subject_report_flag", {
    p_subject_id: subjectId,
    p_include_on_report: includeOnReport,
  });

  if (error) {
    redirect(`/subjects?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/subjects");
  revalidatePath("/assessments");
  revalidatePath("/results");
  redirect(
    "/subjects?ok=" +
      encodeURIComponent(
        includeOnReport
          ? "Subject will now appear on report cards."
          : "Subject is now timetable-only and excluded from reports.",
      ),
  );
}


export async function updateSubjectAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const subjectId = String(formData.get("subject_id") || "").trim();

  const payload = {
    subject_name: String(formData.get("subject_name") || "").trim(),
    subject_code: String(formData.get("subject_code") || "").trim().toUpperCase(),
    subject_group: String(formData.get("subject_group") || "").trim(),
    include_on_report: formData.get("include_on_report") === "on",
    is_active: formData.get("is_active") === "on",
  };

  const { error } = await supabase.rpc("update_subject_record", {
    p_subject_id: subjectId,
    p_payload: payload,
  });

  if (error) {
    redirect("/subjects/" + subjectId + "/edit?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/subjects");
  revalidatePath("/assessments");
  revalidatePath("/results");
  revalidatePath("/teacher-assignments");
  redirect("/subjects?ok=" + encodeURIComponent("Subject updated."));
}


export async function saveSubjectAspectAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const subjectId = String(formData.get("subject_id") || "").trim();
  const aspectId = String(formData.get("aspect_id") || "").trim();

  if (!subjectId) {
    redirect("/subjects?error=" + encodeURIComponent("Subject is required."));
  }

  const payload = {
    id: aspectId,
    subject_id: subjectId,
    aspect_name: String(formData.get("aspect_name") || "").trim(),
    aspect_code: String(formData.get("aspect_code") || "").trim().toUpperCase(),
    display_order: String(formData.get("display_order") || "1"),
    is_active: formData.get("is_active") === "on",
  };

  const { error } = await supabase.rpc("save_subject_aspect", {
    p_payload: payload,
  });

  if (error) {
    redirect(
      "/subjects/" + subjectId + "/aspects?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/subjects");
  revalidatePath("/subjects/" + subjectId + "/aspects");
  revalidatePath("/timetable");
  redirect(
    "/subjects/" + subjectId + "/aspects?ok=" +
      encodeURIComponent(aspectId ? "Subject aspect updated." : "Subject aspect created."),
  );
}

export async function saveClassSubjectAspectAction(formData: FormData) {
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const subjectId = String(formData.get("subject_id") || "").trim();
  const linkId = String(formData.get("class_subject_aspect_id") || "").trim();

  if (!subjectId) {
    redirect("/subjects?error=" + encodeURIComponent("Subject is required."));
  }

  const payload = {
    id: linkId,
    class_subject_id: String(formData.get("class_subject_id") || "").trim(),
    subject_aspect_id: String(formData.get("subject_aspect_id") || "").trim(),
    periods_per_week: String(formData.get("periods_per_week") || "").trim(),
    is_active: formData.get("is_active") === "on",
  };

  const { error } = await supabase.rpc("save_class_subject_aspect", {
    p_payload: payload,
  });

  if (error) {
    redirect(
      "/subjects/" + subjectId + "/aspects?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/subjects/" + subjectId + "/aspects");
  revalidatePath("/timetable");
  redirect(
    "/subjects/" + subjectId + "/aspects?ok=" +
      encodeURIComponent(linkId ? "Class aspect settings updated." : "Aspect enabled for class."),
  );
}
