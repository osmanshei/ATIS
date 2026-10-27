import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { CaScoreMatrix } from "@/components/ca-score-matrix";

export default async function CaScorebookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);

  const [{ data: setup }, { data: assessments }] = await Promise.all([
    supabase.from("assessment_setup_summary").select("*").eq("id", id).single(),
    supabase
      .from("ca_assessment_summary")
      .select("id,setup_id,component,assessment_no,assessment_name,max_mark,status")
      .eq("setup_id", id)
      .neq("status", "draft")
      .order("component")
      .order("assessment_no"),
  ]);

  if (!setup) notFound();

  const assessmentIds = (assessments || []).map((item: any) => item.id);
  const [{ data: students }, { data: scores }] = await Promise.all([
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name")
      .eq("class_id", setup.class_id)
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
    assessmentIds.length
      ? supabase
          .from("ca_scores")
          .select("assessment_id,student_id,raw_score,is_absent,remark")
          .in("assessment_id", assessmentIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const assessmentRows = (assessments || []) as any[];
  const hasClosedAssessment = assessmentRows.some((assessment) => assessment.status === "closed");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{setup.class_name}{setup.section ? " / " + setup.section : ""} · {setup.term_name}</div>
          <h1>{setup.subject_name} — CA Scorebook</h1>
          <p>
            Spreadsheet-style entry for 5 class exercises, 5 homework assignments and 3 class tests.
            Raw CA scores convert automatically to {setup.ca_weight} marks.
          </p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/assessments/" + id}>Individual CA Slots</Link>
          <Link className="button secondary" href="/assessments">All Subjects</Link>
        </div>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}
      {hasClosedAssessment && setup.status !== "locked" ? (
        <div className="notice">At least one CA assessment is closed, so this combined scorebook is read-only. Reopen or manage scores from the individual assessment page.</div>
      ) : null}

      <CaScoreMatrix
        setupId={id}
        caWeight={Number(setup.ca_weight || 40)}
        assessments={assessmentRows}
        students={(students || []) as any}
        initialScores={(scores || []) as any}
        locked={setup.status === "locked" || hasClosedAssessment}
      />
    </>
  );
}
