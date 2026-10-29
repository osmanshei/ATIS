import Link from "next/link";
import { requireProfile } from "@/lib/auth";

const PAGE_SIZE = 50;

function cleanSearch(value: string) {
  return value.replace(/[,%_()]/g, " ").replace(/\s+/g, " ").trim();
}

function buildPageHref(args: {
  page: number;
  q: string;
  classId: string;
  status: string;
}) {
  const p = new URLSearchParams();
  if (args.q) p.set("q", args.q);
  if (args.classId) p.set("class", args.classId);
  if (args.status) p.set("status", args.status);
  p.set("page", String(args.page));
  return "/students?" + p.toString();
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string;
    error?: string;
    q?: string;
    class?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const { supabase, profile } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;

  const q = cleanSearch(params.q || "");
  const classId = params.class || "";
  const status = params.status || "";
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

  const { data: classes } = await supabase
    .from("classes")
    .select("id,class_name,section,grade_level,is_active")
    .order("grade_level", { nullsFirst: true })
    .order("class_name");

  let countQuery = supabase
    .from("students")
    .select("id", { count: "exact", head: true });

  let rowsQuery = supabase
    .from("students")
    .select(
      "id,admission_number,first_name,middle_name,last_name,gender,date_of_birth,status,class_id,student_section,classes(class_name,section)",
    );

  if (classId) {
    countQuery = countQuery.eq("class_id", classId);
    rowsQuery = rowsQuery.eq("class_id", classId);
  }

  if (status) {
    countQuery = countQuery.eq("status", status);
    rowsQuery = rowsQuery.eq("status", status);
  }

  const tokens = q.split(" ").filter(Boolean).slice(0, 3);
  for (const token of tokens) {
    const filter =
      "admission_number.ilike.%" + token +
      "%,first_name.ilike.%" + token +
      "%,middle_name.ilike.%" + token +
      "%,last_name.ilike.%" + token + "%";
    countQuery = countQuery.or(filter);
    rowsQuery = rowsQuery.or(filter);
  }

  const { count, error: countError } = await countQuery;
  const total = count || 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const from = (page - 1) * PAGE_SIZE;

  const { data, error } = await rowsQuery
    .order("first_name")
    .order("last_name")
    .range(from, from + PAGE_SIZE - 1);

  const rows = (data || []) as any[];
  const firstShown = total ? from + 1 : 0;
  const lastShown = Math.min(from + rows.length, total);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Students</h1>
          <p>Search and manage the complete ATIS student register.</p>
        </div>
        <div className="action-row">
          <Link className="button" href="/students/new">Add Student</Link>
          <Link className="button secondary" href="/bulk-onboarding">Bulk Onboarding</Link>
          <Link className="button secondary" href="/sections">Colour Sections</Link>
          <span className="tag">{total} records</span>
        </div>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {countError ? <div className="notice error">{countError.message}</div> : null}
      {error ? <div className="notice error">{error.message}</div> : null}

      <form className="form-card roster-search-card" method="get">
        <div className="field">
          <label>Name or Admission Number</label>
          <input name="q" defaultValue={q} placeholder="e.g. Abdul Ganiu or 065/24B" />
        </div>
        <div className="field">
          <label>Class</label>
          <select name="class" defaultValue={classId}>
            <option value="">All classes</option>
            {(classes || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.class_name}{c.section ? " / " + c.section : ""}{!c.is_active ? " · Inactive" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select name="status" defaultValue={status}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="transferred">Transferred</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="graduated">Graduated</option>
            <option value="alumni">Alumni</option>
          </select>
        </div>
        <button className="button" type="submit">Search</button>
        {(q || classId || status) ? <Link className="button secondary" href="/students">Clear</Link> : null}
      </form>

      <div className="roster-result-summary">
        <span>Showing <strong>{firstShown}–{lastShown}</strong> of <strong>{total}</strong></span>
        {q ? <span>Search: <strong>{q}</strong></span> : null}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Admission No.</th><th>Student</th><th>Gender</th>
              <th>Date of birth</th><th>Class</th><th>Class Group</th><th>Colour Section</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.admission_number || "—"}</td>
                <td><strong>{[r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ")}</strong></td>
                <td>{r.gender || "—"}</td>
                <td>{r.date_of_birth || "—"}</td>
                <td>{r.classes ? r.classes.class_name : "Unassigned"}</td>
                <td>{r.classes?.section ? <span className="tag">Group {r.classes.section}</span> : <span className="muted">—</span>}</td>
                <td><span className="tag">{r.student_section || "Not assigned"}</span></td>
                <td><span className="tag gray">{r.status}</span></td>
                <td>
                  <div className="action-row">
                    <Link className="button secondary compact" href={"/students/" + r.id + "/edit"}>Edit</Link>
                    {profile.role === "admin" ? (
                      <Link className="button secondary compact" href={"/students/" + r.id + "/access"}>Portal Access</Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={9} className="muted">No students match the selected search or filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span>Page {page} of {pageCount}</span>
        <div className="action-row">
          {page > 1 ? (
            <Link className="button secondary compact" href={buildPageHref({ page: page - 1, q, classId, status })}>Previous</Link>
          ) : null}
          {page < pageCount ? (
            <Link className="button secondary compact" href={buildPageHref({ page: page + 1, q, classId, status })}>Next</Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
