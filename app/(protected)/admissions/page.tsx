import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  confirmAdmissionAction,
  enrollAdmissionAction,
  rejectAdmissionAction,
} from "./actions";

export default async function AdmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; new?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;

  const [admissionsResult, classesResult] = await Promise.all([
    supabase
      .from("admissions")
      .select(
        "id,registration_number,admission_number,first_name,middle_name,last_name,gender,date_of_birth,status,applied_for_class_id,allotted_class_id,registration_date,admission_confirmed_date,rejection_reason",
      )
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("classes")
      .select("id,class_name,section")
      .eq("is_active", true)
      .order("class_name"),
  ]);

  const rows = (admissionsResult.data || []) as any[];
  const classes = (classesResult.data || []) as any[];
  const classMap = new Map(
    classes.map((c) => [c.id, `${c.class_name}${c.section ? ` / ${c.section}` : ""}`]),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admissions</h1>
          <p>Register, admit, print the admission letter, then enroll the learner.</p>
        </div>
        <Link className="button" href="/admissions/new">Register applicant</Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      {admissionsResult.error ? (
        <div className="notice error">{admissionsResult.error.message}</div>
      ) : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Registration</th>
              <th>Applicant</th>
              <th>Class</th>
              <th>Status</th>
              <th>Admission No.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const classId = row.allotted_class_id || row.applied_for_class_id;
              const fullName = [row.first_name, row.middle_name, row.last_name]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.registration_number}</strong>
                    <br />
                    <span className="muted">{row.registration_date || ""}</span>
                  </td>
                  <td>
                    <strong>{fullName}</strong>
                    <br />
                    <span className="muted">
                      {[row.gender, row.date_of_birth].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td>{classMap.get(classId) || "—"}</td>
                  <td>
                    <span className={`tag ${row.status === "rejected" ? "gray" : ""}`}>
                      {row.status}
                    </span>
                    {row.rejection_reason ? (
                      <div className="muted">{row.rejection_reason}</div>
                    ) : null}
                  </td>
                  <td>{row.admission_number || "—"}</td>
                  <td>
                    <div className="action-row">
                      {["registered", "under_review"].includes(row.status) ? (
                        <form action={confirmAdmissionAction}>
                          <input type="hidden" name="admission_id" value={row.id} />
                          <input type="hidden" name="class_id" value={classId || ""} />
                          <button className="button compact" type="submit">Admit</button>
                        </form>
                      ) : null}

                      {row.status === "admitted" ? (
                        <>
                          <Link className="button secondary compact" href={`/admissions/${row.id}/letter`}>
                            Letter
                          </Link>
                          <form action={enrollAdmissionAction}>
                            <input type="hidden" name="admission_id" value={row.id} />
                            <button className="button compact" type="submit">Enroll</button>
                          </form>
                        </>
                      ) : null}

                      {row.status === "enrolled" ? (
                        <Link className="button secondary compact" href={`/admissions/${row.id}/letter`}>
                          Letter
                        </Link>
                      ) : null}

                      {!["enrolled", "rejected", "cancelled"].includes(row.status) ? (
                        <form action={rejectAdmissionAction} className="inline-reject">
                          <input type="hidden" name="admission_id" value={row.id} />
                          <input name="reason" placeholder="Rejection reason" />
                          <button className="button secondary compact" type="submit">Reject</button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr><td colSpan={6} className="muted">No admission applications yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
