import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function fullName(row: any) {
  return [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" ");
}

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

export default async function FeedingRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string }>;
}) {
  const { supabase } = await requireProfile(["admin", "supervisor", "accountant", "clerk"]);
  const params = await searchParams;
  const classId = params.class || "";
  const date = params.date || new Date().toISOString().slice(0, 10);
  if (!classId) notFound();

  const [{ data: cls }, { data: rows }] = await Promise.all([
    supabase.from("classes").select("id,class_name,section").eq("id", classId).maybeSingle(),
    supabase
      .from("feeding_daily_register")
      .select("*")
      .eq("class_id", classId)
      .eq("feeding_date", date)
      .order("first_name")
      .order("last_name"),
  ]);

  if (!cls) notFound();

  const classLabel = cls.class_name + (cls.section ? " / " + cls.section : "");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Attendance-linked feeding register</div>
          <h1>{classLabel}</h1>
          <p>{date} · automatically synchronized from daily attendance</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href={"/feeding?date=" + date}>Back to Feeding</Link>
          <Link className="button secondary" href={"/attendance/register?class=" + classId + "&date=" + date}>Open Attendance</Link>
        </div>
      </div>

      {!rows?.length ? (
        <div className="empty-state">
          <strong>Daily attendance has not been marked for this class.</strong>
          <p>Take attendance first. Feeding charges will be generated automatically for present and late students.</p>
          <Link className="button" href={"/attendance/register?class=" + classId + "&date=" + date}>Take Attendance</Link>
        </div>
      ) : (
        <div className="table-wrap feeding-register-table">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Adm. No.</th><th>Student</th><th>Attendance</th><th>Plan</th>
                <th>Feeding Status</th><th>Daily Charge</th><th>Credit Balance</th><th>Diet / Allergy</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((row: any, index: number) => (
                <tr key={row.attendance_record_id}>
                  <td>{index + 1}</td>
                  <td>{row.admission_number || "—"}</td>
                  <td><strong>{fullName(row)}</strong></td>
                  <td><span className="tag">{row.attendance_status}</span></td>
                  <td>{row.plan_frequency}{row.exemption_type ? " · " + row.exemption_type : ""}</td>
                  <td>
                    <span className={row.payment_mark === "unpaid" ? "tag gray" : "tag"}>
                      {String(row.payment_mark || "").replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{money(row.daily_charge)}</td>
                  <td><strong>{money(row.credit_balance)}</strong></td>
                  <td>{[row.dietary_requirements, row.allergies].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
