import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { updateSubjectAction } from "../../actions";

export default async function EditSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const { data: subject } = await supabase.from("subject_catalogue").select("*").eq("id", id).single();
  if (!subject) notFound();

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Academic master data</div><h1>Edit Subject</h1><p>{subject.subject_name} · {subject.subject_code}</p></div>
        <Link className="button secondary" href="/subjects">Back to subjects</Link>
      </div>
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form className="form-card" action={updateSubjectAction}>
        <input type="hidden" name="subject_id" value={subject.id} />
        <div className="form-grid">
          <div className="field"><label>Subject name</label><input name="subject_name" defaultValue={subject.subject_name || ""} required /></div>
          <div className="field"><label>Subject code</label><input name="subject_code" defaultValue={subject.subject_code || ""} required /></div>
          <div className="field"><label>Subject group</label><input name="subject_group" defaultValue={subject.subject_group || ""} /></div>
        </div>
        <label className="checkbox-field"><input name="include_on_report" type="checkbox" defaultChecked={Boolean(subject.include_on_report)} /> Include on report cards</label>
        <label className="checkbox-field"><input name="is_active" type="checkbox" defaultChecked={Boolean(subject.is_active)} /> Active subject</label>
        <div className="notice">Changing a subject name or code keeps its existing class links, teacher assignments and result history because the subject ID does not change.</div>
        <div className="action-row">
          <button className="button" type="submit">Save Subject Changes</button>
          <Link className="button secondary" href="/subjects">Cancel</Link>
        </div>
      </form>
    </>
  );
}
