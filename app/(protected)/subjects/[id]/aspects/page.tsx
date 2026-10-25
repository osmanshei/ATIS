import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  saveClassSubjectAspectAction,
  saveSubjectAspectAction,
} from "../../actions";

export default async function SubjectAspectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase } = await requireProfile(["admin", "supervisor"]);

  const [
    { data: subject },
    { data: aspects },
    { data: classSubjects },
    { data: classAspectLinks },
  ] = await Promise.all([
    supabase
      .from("subject_catalogue")
      .select("id,subject_name,subject_code,include_on_report,is_active")
      .eq("id", id)
      .single(),
    supabase
      .from("subject_aspect_summary")
      .select("id,subject_id,aspect_name,aspect_code,display_order,is_active")
      .eq("subject_id", id)
      .order("display_order")
      .order("aspect_name"),
    supabase
      .from("class_subject_summary")
      .select("id,class_id,class_name,section,subject_id,subject_name,subject_code,is_active")
      .eq("subject_id", id)
      .eq("is_active", true)
      .order("class_name"),
    supabase
      .from("class_subject_aspect_summary")
      .select(
        "id,class_subject_id,class_id,class_name,section,subject_id,subject_aspect_id,aspect_name,aspect_code,display_order,periods_per_week,is_active,aspect_is_active",
      )
      .eq("subject_id", id)
      .order("class_name")
      .order("display_order"),
  ]);

  if (!subject) notFound();

  const activeAspects = (aspects || []).filter((a: any) => a.is_active);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Subjects · teaching structure</div>
          <h1>{subject.subject_name} Aspects</h1>
          <p>
            Organise teaching into aspects/sub-strands without creating separate report-card subjects.
          </p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/subjects/" + id + "/edit"}>Edit Main Subject</Link>
          <Link className="button secondary" href="/subjects">Back to Subjects</Link>
        </div>
      </div>

      {query.ok ? <div className="notice success">{query.ok}</div> : null}
      {query.error ? <div className="notice error">{query.error}</div> : null}

      <div className="notice">
        <strong>Reporting rule:</strong> {subject.subject_name} remains one subject for CA, examination,
        total, grade and report cards. The aspects below are used only for teaching organisation and timetable allocation.
      </div>

      <div className="grid-2">
        <form className="form-card" action={saveSubjectAspectAction}>
          <input type="hidden" name="subject_id" value={subject.id} />
          <h2 className="section-title">Add Teaching Aspect</h2>
          <div className="field">
            <label>Aspect name</label>
            <input name="aspect_name" placeholder="e.g. Reading" required />
          </div>
          <div className="field">
            <label>Short code</label>
            <input name="aspect_code" placeholder="READING" />
          </div>
          <div className="field">
            <label>Display order</label>
            <input name="display_order" type="number" min="1" max="99" defaultValue="1" />
          </div>
          <label className="checkbox-field">
            <input name="is_active" type="checkbox" defaultChecked /> Active
          </label>
          <button className="button" type="submit">Add Aspect</button>
        </form>

        <form className="form-card" action={saveClassSubjectAspectAction}>
          <input type="hidden" name="subject_id" value={subject.id} />
          <h2 className="section-title">Enable Aspect for a Class</h2>
          <div className="field">
            <label>Class</label>
            <select name="class_subject_id" required>
              <option value="">Choose...</option>
              {(classSubjects || []).map((cs: any) => (
                <option key={cs.id} value={cs.id}>
                  {cs.class_name}{cs.section ? " / " + cs.section : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Aspect</label>
            <select name="subject_aspect_id" required>
              <option value="">Choose...</option>
              {activeAspects.map((a: any) => (
                <option key={a.id} value={a.id}>{a.aspect_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Expected periods / week</label>
            <input name="periods_per_week" type="number" min="0" max="30" />
          </div>
          <label className="checkbox-field">
            <input name="is_active" type="checkbox" defaultChecked /> Active for this class
          </label>
          <button className="button" type="submit">Enable for Class</button>
        </form>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Master list</div>
            <h2>Teaching Aspects</h2>
          </div>
          <span className="tag">{(aspects || []).length} configured</span>
        </div>
        <div className="aspect-edit-list">
          {(aspects || []).map((a: any) => (
            <form className="aspect-edit-row" action={saveSubjectAspectAction} key={a.id}>
              <input type="hidden" name="subject_id" value={subject.id} />
              <input type="hidden" name="aspect_id" value={a.id} />
              <div className="field">
                <label>Name</label>
                <input name="aspect_name" defaultValue={a.aspect_name} required />
              </div>
              <div className="field">
                <label>Code</label>
                <input name="aspect_code" defaultValue={a.aspect_code || ""} />
              </div>
              <div className="field small-field">
                <label>Order</label>
                <input name="display_order" type="number" min="1" max="99" defaultValue={a.display_order || 1} />
              </div>
              <label className="checkbox-field compact-check">
                <input name="is_active" type="checkbox" defaultChecked={a.is_active} /> Active
              </label>
              <button className="button secondary compact" type="submit">Save</button>
            </form>
          ))}
          {!aspects?.length ? (
            <div className="empty-state">
              <strong>No aspects configured yet</strong>
              <p>Add the teaching aspects used under this main subject.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Class-level structure</div>
            <h2>Enabled Aspects by Class</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Class</th><th>Aspect</th><th>Periods / Week</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {(classAspectLinks || []).map((row: any) => (
                <tr key={row.id}>
                  <td><strong>{row.class_name}{row.section ? " / " + row.section : ""}</strong></td>
                  <td>{row.aspect_name}</td>
                  <td>
                    <form className="inline-save-form" action={saveClassSubjectAspectAction}>
                      <input type="hidden" name="subject_id" value={subject.id} />
                      <input type="hidden" name="class_subject_aspect_id" value={row.id} />
                      <input type="hidden" name="class_subject_id" value={row.class_subject_id} />
                      <input type="hidden" name="subject_aspect_id" value={row.subject_aspect_id} />
                      <input
                        className="compact-number"
                        name="periods_per_week"
                        type="number"
                        min="0"
                        max="30"
                        defaultValue={row.periods_per_week ?? ""}
                      />
                      <label className="checkbox-field compact-check">
                        <input name="is_active" type="checkbox" defaultChecked={row.is_active} />
                        Active
                      </label>
                      <button className="button secondary compact" type="submit">Save</button>
                    </form>
                  </td>
                  <td>
                    <span className={row.is_active && row.aspect_is_active ? "tag" : "tag gray"}>
                      {row.is_active && row.aspect_is_active ? "Enabled" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <span className="muted">Main subject remains {subject.subject_name}</span>
                  </td>
                </tr>
              ))}
              {!classAspectLinks?.length ? (
                <tr><td colSpan={5} className="muted">No aspects have been enabled for any class yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
