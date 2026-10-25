import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { signedStudentPhotoUrl } from "@/lib/student-photo";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value + (value.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; term?: string }>;
}) {
  const { supabase, profile } = await requireProfile(["student", "parent"]);
  const query = await searchParams;

  const [{ data: students }, { data: terms }] = await Promise.all([
    supabase.rpc("portal_students"),
    supabase
      .from("terms")
      .select("id,name,is_current,starts_on,ends_on")
      .order("starts_on", { ascending: false }),
  ]);

  const available = (students || []) as any[];
  const selected =
    available.find((s: any) => s.id === query.student) ||
    available[0] ||
    null;

  const termId =
    query.term ||
    terms?.find((t: any) => t.is_current)?.id ||
    terms?.[0]?.id ||
    "";

  if (!selected) {
    return (
      <>
        <section className="welcome-hero">
          <div>
            <div className="eyebrow">{profile.role === "parent" ? "Parent portal" : "Student portal"}</div>
            <h1>Welcome, {profile.full_name.split(" ")[0]}.</h1>
            <p>No active student record is linked to this portal account yet.</p>
          </div>
        </section>
        <div className="notice">
          Please contact ATIS administration to link this login to the correct student record.
        </div>
      </>
    );
  }

  const [
    { data: results },
    { data: reportMeta },
    { data: attendanceRows },
    { data: financeRows },
    { data: payments },
  ] = await Promise.all([
    supabase.rpc("portal_results", {
      p_student_id: selected.id,
      p_term_id: termId,
    }),
    supabase.rpc("portal_report_meta", {
      p_student_id: selected.id,
      p_term_id: termId,
    }),
    supabase.rpc("portal_attendance", {
      p_student_id: selected.id,
      p_term_id: termId,
    }),
    supabase.rpc("portal_finance_summary", {
      p_student_id: selected.id,
      p_term_id: termId,
    }),
    supabase.rpc("portal_payments", {
      p_student_id: selected.id,
      p_term_id: termId,
    }),
  ]);

  const photoUrl = await signedStudentPhotoUrl(supabase, selected.photo_url);
  const attendance = (attendanceRows || []) as any[];
  const present = attendance.filter((r: any) => r.status === "present").length;
  const late = attendance.filter((r: any) => r.status === "late").length;
  const absent = attendance.filter((r: any) => r.status === "absent").length;
  const attendanceRate = attendance.length
    ? Math.round(((present + late) / attendance.length) * 1000) / 10
    : 0;
  const finance = (financeRows || [])[0] as any;
  const meta = (reportMeta || [])[0] as any;
  const resultRows = (results || []) as any[];
  const average = resultRows.length
    ? resultRows.reduce((sum: number, row: any) => sum + Number(row.total_score || 0), 0) /
      resultRows.length
    : 0;
  const fullName = [selected.first_name, selected.middle_name, selected.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <section className="welcome-hero portal-hero">
        <div className="portal-identity">
          <div className="portal-photo">
            {photoUrl ? (
              <img src={photoUrl} alt={fullName} />
            ) : (
              <span>{fullName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="eyebrow">{profile.role === "parent" ? "Parent portal" : "Student portal"}</div>
            <h1>{fullName}</h1>
            <p>
              {selected.admission_number || "No admission number"} ·{" "}
              {selected.class_name || "Unassigned"}
              {selected.section ? " / " + selected.section : ""}
            </p>
          </div>
        </div>
        <Link className="button secondary hero-secondary" href="/account">My Account</Link>
      </section>

      <form className="portal-filter-card" method="get">
        {profile.role === "parent" && available.length > 1 ? (
          <div className="field">
            <label>Child</label>
            <select name="student" defaultValue={selected.id}>
              {available.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {[s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ")}
                  {" · "}{s.class_name || "Unassigned"}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="student" value={selected.id} />
        )}
        <div className="field">
          <label>Term</label>
          <select name="term" defaultValue={termId}>
            {(terms || []).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}{t.is_current ? " · Current" : ""}</option>
            ))}
          </select>
        </div>
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="cards cards-five">
        <div className="metric-card">
          <span className="metric-kicker">Published average</span>
          <strong>{resultRows.length ? average.toFixed(1) + "%" : "—"}</strong>
          <small>{resultRows.length ? resultRows.length + " reportable subjects" : "Results not published"}</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Attendance</span>
          <strong>{attendance.length ? attendanceRate + "%" : "—"}</strong>
          <small>{attendance.length} recorded school days</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Absent / Late</span>
          <strong>{absent} / {late}</strong>
          <small>For the selected term</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Fees paid</span>
          <strong>{finance ? money(finance.amount_paid) : "—"}</strong>
          <small>{finance ? "Net fees " + money(finance.net_fees) : "Fees not configured"}</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Outstanding</span>
          <strong>{finance ? money(finance.outstanding_balance) : "—"}</strong>
          <small>{finance && Number(finance.credit_balance || 0) > 0 ? "Credit " + money(finance.credit_balance) : "Current balance"}</small>
        </div>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div><div className="eyebrow">Academics</div><h2>Published Results</h2></div>
          {meta?.published_at ? <span className="tag">Published</span> : <span className="tag gray">Not published</span>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Interpretation</th></tr></thead>
            <tbody>
              {resultRows.map((r: any) => (
                <tr key={r.setup_id}>
                  <td><strong>{r.subject_name}</strong><br /><span className="muted">{r.subject_code}</span></td>
                  <td>{Number(r.ca_weighted_score || 0).toFixed(1)}</td>
                  <td>{Number(r.exam_weighted_score || 0).toFixed(1)}</td>
                  <td><strong>{Number(r.total_score || 0).toFixed(1)}</strong></td>
                  <td>{r.grade || "—"}</td>
                  <td>{r.interpretation || r.grade_remark || "—"}</td>
                </tr>
              ))}
              {!resultRows.length ? (
                <tr><td colSpan={6} className="muted">Results for this term have not been published to the portal.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {meta ? (
          <div className="portal-remarks">
            <div><span>Conduct</span><strong>{meta.conduct || "—"}</strong></div>
            <div><span>Teacher's Remark</span><strong>{meta.teacher_remark || "—"}</strong></div>
            <div><span>Headteacher's Remark</span><strong>{meta.headteacher_remark || "—"}</strong></div>
            <div><span>Next Term Begins</span><strong>{formatDate(meta.next_term_begins)}</strong></div>
          </div>
        ) : null}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="eyebrow">Attendance</div>
          <h2 className="section-title">Recent Attendance</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Status</th><th>Remark</th></tr></thead>
              <tbody>
                {attendance.slice(0, 12).map((r: any) => (
                  <tr key={r.attendance_date}>
                    <td>{formatDate(r.attendance_date)}</td>
                    <td><span className={r.status === "present" ? "tag" : "tag gray"}>{r.status}</span></td>
                    <td>{r.remark || "—"}</td>
                  </tr>
                ))}
                {!attendance.length ? <tr><td colSpan={3} className="muted">No attendance has been recorded for this term.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="eyebrow">Finance</div>
          <h2 className="section-title">Fee Account</h2>
          {finance ? (
            <div className="portal-finance-grid">
              <div><span>Gross Fees</span><strong>{money(finance.gross_fees)}</strong></div>
              <div><span>Concessions / Adjustments</span><strong>{money(Number(finance.concession_amount || 0) + Number(finance.additional_adjustment || 0))}</strong></div>
              <div><span>Net Fees</span><strong>{money(finance.net_fees)}</strong></div>
              <div><span>Paid</span><strong>{money(finance.amount_paid)}</strong></div>
              <div><span>Outstanding</span><strong>{money(finance.outstanding_balance)}</strong></div>
              <div><span>Credit</span><strong>{money(finance.credit_balance)}</strong></div>
            </div>
          ) : <p className="muted">Fees have not been configured for this term.</p>}

          <h3 className="portal-subheading">Recent Payments</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Receipt</th><th>For</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {(payments || []).slice(0, 8).map((p: any) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td>{p.receipt_no}</td>
                    <td>{p.fee_name || "General fees"}</td>
                    <td>{money(p.amount)}</td>
                    <td><span className={p.is_reversed ? "tag gray" : "tag"}>{p.is_reversed ? "Reversed" : "Posted"}</span></td>
                  </tr>
                ))}
                {!payments?.length ? <tr><td colSpan={5} className="muted">No payments recorded for this term.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
