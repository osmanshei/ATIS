import Link from "next/link";
import { requireProfile } from "@/lib/auth";

const PAGE_SIZE = 40;

function cleanSearch(value: string) {
  return value.replace(/[,%_()]/g, " ").replace(/\s+/g, " ").trim();
}

function pageHref(args: {
  page: number;
  q: string;
  classId: string;
}) {
  const p = new URLSearchParams();
  if (args.q) p.set("q", args.q);
  if (args.classId) p.set("class", args.classId);
  p.set("page", String(args.page));
  return "/portal-access?" + p.toString();
}

export default async function PortalAccessRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; page?: string }>;
}) {
  const { supabase } = await requireProfile(["admin"]);
  const params = await searchParams;

  const q = cleanSearch(params.q || "");
  const classId = params.class || "";
  const requestedPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

  const { data: classes } = await supabase
    .from("classes")
    .select("id,class_name,section,grade_level")
    .eq("is_active", true)
    .order("grade_level", { nullsFirst: true })
    .order("class_name");

  let countQuery = supabase
    .from("students")
    .select("id", { count: "exact", head: true });

  let rowsQuery = supabase
    .from("students")
    .select(
      "id,user_id,admission_number,first_name,middle_name,last_name,class_id,status,classes(class_name,section),student_guardians(guardian_id,is_primary_contact,relation,guardians(id,user_id,full_name,email,mobile,status))",
    );

  if (classId) {
    countQuery = countQuery.eq("class_id", classId);
    rowsQuery = rowsQuery.eq("class_id", classId);
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

  const { count } = await countQuery;
  const total = count || 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const from = (page - 1) * PAGE_SIZE;

  const { data: rows, error } = await rowsQuery
    .order("first_name")
    .order("last_name")
    .range(from, from + PAGE_SIZE - 1);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Portal administration</div>
          <h1>Parent & Student Portals</h1>
          <p>
            Search the school register, see which learners and guardians have logins,
            and open the account-management screen for each student.
          </p>
        </div>
        <span className="tag">{total} student records</span>
      </div>

      <form className="form-card roster-search-card" method="get">
        <div className="field">
          <label>Student name or admission number</label>
          <input name="q" defaultValue={q} placeholder="Search by name or admission number" />
        </div>
        <div className="field">
          <label>Class</label>
          <select name="class" defaultValue={classId}>
            <option value="">All classes</option>
            {(classes || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.class_name}{c.section ? " / " + c.section : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">Search</button>
        {(q || classId) ? (
          <Link className="button secondary" href="/portal-access">Clear</Link>
        ) : null}
      </form>

      {error ? <div className="notice error">{error.message}</div> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Admission No.</th><th>Student</th><th>Class</th>
              <th>Student Login</th><th>Guardians</th><th>Parent Logins</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).map((r: any) => {
              const links = r.student_guardians || [];
              const guardians = links
                .map((link: any) =>
                  Array.isArray(link.guardians) ? link.guardians[0] : link.guardians,
                )
                .filter(Boolean);
              const parentLoginCount = guardians.filter((g: any) => g.user_id).length;
              const name = [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(" ");
              return (
                <tr key={r.id}>
                  <td>{r.admission_number || "—"}</td>
                  <td><strong>{name}</strong><br /><span className="muted">{r.status}</span></td>
                  <td>
                    {r.classes
                      ? r.classes.class_name + (r.classes.section ? " / " + r.classes.section : "")
                      : "Unassigned"}
                  </td>
                  <td>{r.user_id ? <span className="tag">Created</span> : <span className="tag gray">Not created</span>}</td>
                  <td>{guardians.length}</td>
                  <td>
                    {guardians.length
                      ? <span className={parentLoginCount === guardians.length ? "tag" : "tag gray"}>
                          {parentLoginCount} / {guardians.length}
                        </span>
                      : "—"}
                  </td>
                  <td>
                    <Link className="button secondary compact" href={"/students/" + r.id + "/access"}>
                      Manage Portal Access
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!rows?.length ? (
              <tr><td colSpan={7} className="muted">No students match this search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <span>Page {page} of {pageCount} · {total} records</span>
        <div className="action-row">
          {page > 1 ? (
            <Link className="button secondary compact" href={pageHref({ page: page - 1, q, classId })}>
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link className="button secondary compact" href={pageHref({ page: page + 1, q, classId })}>
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
