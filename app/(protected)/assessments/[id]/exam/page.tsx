import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { ScoreEntryGrid } from "@/components/score-entry-grid";

export default async function ExamScoreEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor", "teacher"]);

  const { data: setup } = await supabase
    .from("assessment_setup_summary")
    .select("*")
    .eq("id", id)
    .single();

  if (!setup) notFound();

  const [{ data: students }, { data: scores }] = await Promise.all([
    supabase
      .from("students")
      .select("id,admission_number,first_name,middle_name,last_name")
      .eq("class_id", setup.class_id)
      .eq("status", "active")
      .order("first_name")
      .order("last_name"),
    supabase
      .from("exam_scores")
      .select("student_id,raw_score,oral_score,max_mark,is_absent,remark")
      .eq("setup_id", id),
  ]);

  const maxMark = 100;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{setup.class_name}{setup.section ? " / " + setup.section : ""} · {setup.term_name}</div>
          <h1>{setup.subject_name} — Exam Scores</h1>
          <p>Enter the written paper out of 100 and oral assessment out of 20. Exam total = written × 80% + oral; the result is scaled to {setup.exam_weight}%.</p>
        </div>
        <Link className="button secondary" href={"/assessments/" + id}>Back to subject</Link>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <ScoreEntryGrid
        mode="exam"
        setupId={id}
        maxMark={maxMark}
        students={(students || []) as any}
        initialScores={(scores || []) as any}
        locked={setup.status === "locked"}
      />
    </>
  );
}
