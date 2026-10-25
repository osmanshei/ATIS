import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { updateClassAction } from "../../actions";

export default async function EditClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor"]);
  const { data: cls } = await supabase.from("classes").select("*").eq("id", id).single();
  if (!cls) notFound();

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Academic master data</div><h1>Edit Class</h1><p>{cls.class_name}{cls.section ? " / " + cls.section : ""}</p></div>
        <Link className="button secondary" href="/classes">Back to classes</Link>
      </div>
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <form className="form-card" action={updateClassAction}>
        <input type="hidden" name="class_id" value={cls.id} />
        <div className="form-grid">
          <div className="field"><label>Class name</label><input name="class_name" defaultValue={cls.class_name || ""} required /></div>
          <div className="field"><label>Section</label><input name="section" defaultValue={cls.section || ""} /></div>
          <div className="field"><label>Grade level</label><input name="grade_level" type="number" min="0" max="20" defaultValue={cls.grade_level ?? ""} /></div>
          <div className="field"><label>Class code</label><input name="class_code" defaultValue={cls.class_code || ""} /></div>
          <div className="field"><label>Max capacity</label><input name="max_capacity" type="number" min="1" defaultValue={cls.max_capacity ?? ""} /></div>
          <div className="field"><label>Room</label><input name="room_number" defaultValue={cls.room_number || ""} /></div>
        </div>
        <label className="checkbox-field"><input name="is_active" type="checkbox" defaultChecked={Boolean(cls.is_active)} /> Active class</label>
        <div className="notice">The Class ID remains unchanged, so students, subjects, attendance, fees and teacher assignments stay linked after editing.</div>
        <div className="action-row">
          <button className="button" type="submit">Save Class Changes</button>
          <Link className="button secondary" href="/classes">Cancel</Link>
        </div>
      </form>
    </>
  );
}
