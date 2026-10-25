import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ScoreEntryGrid } from "@/components/score-entry-grid";

export default async function CaScoreEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; assessmentId: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id, assessmentId } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);

  const [{ data: setup }, { data: assessment }] = await Promise.all([
    supabase.from("assessment_setup_summary").select("*").eq("id", id).single(),
    supabase
      .from("ca_assessment_summary")
      .select("*")
      .eq("id", assessmentId)
      .eq("setup_id", id)
      .single(),
  ]);

  if (!setup || !assessment) notFound();

  const [{ data: students }, { data: scores }] = await Promise.all([
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name")
      .eq("class_id", setup.class_id)
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
    supabase
      .from("ca_scores")
      .select("student_id,raw_score,is_absent,remark")
      .eq("assessment_id", assessmentId),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{setup.class_name}{setup.section ? " / " + setup.section : ""} · {setup.subject_name}</div>
          <h1>{assessment.assessment_name}</h1>
          <p>{String(assessment.component).replaceAll("_", " ")} · Maximum mark {assessment.max_mark}</p>
        </div>
        <Link className="button secondary" href={"/assessments/" + id}>Back to subject</Link>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <ScoreEntryGrid
        mode="ca"
        setupId={id}
        assessmentId={assessmentId}
        maxMark={Number(assessment.max_mark)}
        students={(students || []) as any}
        initialScores={(scores || []) as any}
        locked={setup.status === "locked" || assessment.status === "closed"}
      />
    </>
  );
}
