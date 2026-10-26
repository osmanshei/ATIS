import Link from "next/link";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { supabase, profile } = await requireProfile();
  const params = await searchParams;

  const { data: year } = await supabase
    .from("academic_years")
    .select("name")
    .eq("is_current", true)
    .maybeSingle();

  if (profile.role === "teacher") {
    const { data: assignments } = await supabase
      .from("teacher_assignment_summary")
      .select("id,class_name,section,subject_name,subject_code,is_class_teacher,periods_per_week")
      .order("class_name")
      .order("subject_name");

    const rows = (assignments || []) as any[];
    const classCount = new Set(rows.map((r) => `${r.class_name}|${r.section || ""}`)).size;
    const subjectCount = new Set(rows.map((r) => r.subject_code || r.subject_name)).size;
    const periods = rows.reduce((sum, r) => sum + Number(r.periods_per_week || 0), 0);

    return (
      <>
        <section className="welcome-hero">
          <div>
            <div className="eyebrow">Teacher workspace · {year?.name || "Current academic year"}</div>
            <h1>Welcome back, {profile.full_name.split(" ")[0]}.</h1>
            <p>Your portal shows only the classes and subjects assigned to you.</p>
          </div>
          <div className="hero-actions">
            <Link className="button hero-button" href="/attendance">Take Attendance</Link>
            <Link className="button secondary hero-secondary" href="/assessments">Enter Scores</Link>
            <Link className="button secondary hero-secondary" href="/teacher-assignments">My Teaching</Link>
            <Link className="button secondary hero-secondary" href="/timetable">My Timetable</Link>
          </div>
        </section>

        {params.denied ? (
          <div className="notice">That area is not available to your teacher account.</div>
        ) : null}

        <div className="teacher-summary-grid">
          <div className="metric-card">
            <span className="metric-kicker">My classes</span>
            <strong>{classCount}</strong>
            <small>Classes assigned to your teaching load</small>
          </div>
          <div className="metric-card">
            <span className="metric-kicker">My subjects</span>
            <strong>{subjectCount}</strong>
            <small>Distinct subjects assigned to you</small>
          </div>
          <div className="metric-card">
            <span className="metric-kicker">Periods / week</span>
            <strong>{periods || "—"}</strong>
            <small>Total configured teaching periods</small>
          </div>
        </div>

        <section className="panel-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Teaching load</div>
              <h2>My current assignments</h2>
            </div>
            <Link className="text-link" href="/teacher-assignments">See all assignments →</Link>
          </div>

          <div className="assignment-grid">
            {rows.slice(0, 6).map((row) => (
              <article className="assignment-card" key={row.id}>
                <div className="assignment-class">
                  {row.class_name}{row.section ? ` / ${row.section}` : ""}
                </div>
                <h3>{row.subject_name}</h3>
                <div className="assignment-meta">
                  <span>{row.subject_code}</span>
                  <span>{row.periods_per_week ? `${row.periods_per_week} periods/week` : "Periods not set"}</span>
                </div>
                {row.is_class_teacher ? <span className="tag">Class teacher</span> : null}
              </article>
            ))}
            {!rows.length ? (
              <div className="empty-state">
                <strong>No teaching assignments yet</strong>
                <p>Management has not linked any class-subject assignments to your account.</p>
              </div>
            ) : null}
          </div>
        </section>
      </>
    );
  }

  if (profile.role === "student" || profile.role === "parent") {
    return (
      <>
        <section className="welcome-hero portal-hero">
          <div>
            <div className="eyebrow">{profile.role === "parent" ? "Parent portal" : "Student portal"} · {year?.name || "Current academic year"}</div>
            <h1>Welcome, {profile.full_name.split(" ")[0]}.</h1>
            <p>
              {profile.role === "parent"
                ? "View your linked child or children, published results, attendance and school-fee account."
                : "View your published results, attendance and school-fee account."}
            </p>
          </div>
          <div className="hero-actions">
            <Link className="button hero-button" href="/portal">Open My Portal</Link>
            <Link className="button secondary hero-secondary" href="/account">My Account</Link>
          </div>
        </section>
        {params.denied ? <div className="notice">That area is not available to your portal account.</div> : null}
        <div className="grid-2">
          <Link className="card dashboard-link-card" href="/portal">
            <div className="eyebrow">School information</div>
            <h2 className="section-title">Results, attendance & fees</h2>
            <p className="muted">One secure view of the student information available to this account.</p>
          </Link>
          <Link className="card dashboard-link-card" href="/account">
            <div className="eyebrow">Security</div>
            <h2 className="section-title">Account & password</h2>
            <p className="muted">Review your login details and change your password.</p>
          </Link>
        </div>
      </>
    );
  }

  if (profile.role === "accountant") {
    return (
      <>
        <section className="welcome-hero">
          <div>
            <div className="eyebrow">Finance workspace · {year?.name || "Current academic year"}</div>
            <h1>Welcome, {profile.full_name.split(" ")[0]}.</h1>
            <p>Manage school fees, payments, receipts, balances and finance reporting from your dedicated workspace.</p>
          </div>
          <div className="hero-actions">
            <Link className="button hero-button" href="/finance/payments">Record Payment</Link>
            <Link className="button secondary hero-secondary" href="/finance">Open Finance</Link>
          </div>
        </section>
        {params.denied ? <div className="notice">That area is not available to your account.</div> : null}
        <div className="grid-2">
          <Link className="card dashboard-link-card" href="/finance">
            <div className="eyebrow">Finance</div>
            <h2 className="section-title">Fees & balances</h2>
            <p className="muted">Configure fees, monitor collections and student balances.</p>
          </Link>
          <Link className="card dashboard-link-card" href="/finance/payments">
            <div className="eyebrow">Cashier</div>
            <h2 className="section-title">Post a payment</h2>
            <p className="muted">Record payments and issue official ATIS receipts.</p>
          </Link>
        </div>
      </>
    );
  }

  if (profile.role === "staff") {
    return (
      <>
        <section className="welcome-hero">
          <div>
            <div className="eyebrow">{profile.role} workspace · {year?.name || "Current academic year"}</div>
            <h1>Welcome, {profile.full_name.split(" ")[0]}.</h1>
            <p>Your ATIS account is ready. More role-specific tools will appear here as they are enabled.</p>
          </div>
          <Link className="button hero-button" href="/account">My Account</Link>
        </section>
        {params.denied ? <div className="notice">That area is not available to your account.</div> : null}
        <div className="grid-2">
          <section className="card">
            <div className="eyebrow">Account</div>
            <h2 className="section-title">Profile & security</h2>
            <p className="muted">Review your login details and change your password from My Account.</p>
          </section>
          <section className="card">
            <div className="eyebrow">ATIS</div>
            <h2 className="section-title">Role-based workspace</h2>
            <p className="muted">You only see modules authorized for your staff role.</p>
          </section>
        </div>
      </>
    );
  }

  const [students, staff, classes, subjects, admissions] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("subject_catalogue").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("admissions").select("id", { count: "exact", head: true }).in("status", ["registered", "under_review", "admitted"]),
  ]);

  const stats = [
    ["Active students", students.count ?? 0, "Live student records"],
    ["Active staff", staff.count ?? 0, "Teaching and non-teaching"],
    ["Classes", classes.count ?? 0, "Current academic structure"],
    ["Subjects", subjects.count ?? 0, "Master subject catalogue"],
    ["Open admissions", admissions.count ?? 0, "Awaiting completion"],
  ];

  return (
    <>
      <section className="welcome-hero admin-hero">
        <div>
          <div className="eyebrow">Management workspace · {year?.name || "Current academic year"}</div>
          <h1>Good to see you, {profile.full_name.split(" ")[0]}.</h1>
          <p>Monitor the school, manage people and keep academic records moving from one workspace.</p>
        </div>
        <div className="hero-actions">
          <Link className="button hero-button" href="/admissions">Admissions</Link>
          <Link className="button secondary hero-secondary" href="/staff">Staff</Link>
          <Link className="button secondary hero-secondary" href="/results">Results</Link>
          <Link className="button secondary hero-secondary" href="/finance">Finance</Link>
          <Link className="button secondary hero-secondary" href="/timetable">Timetable</Link>
          <Link className="button secondary hero-secondary" href="/portal-access">Portals</Link>
        </div>
      </section>

      {params.denied ? <div className="notice">Your account does not have permission for that area.</div> : null}

      <div className="cards cards-five">
        {stats.map(([label, value, note]) => (
          <div className="metric-card" key={String(label)}>
            <span className="metric-kicker">{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>

      <div className="grid-2 dashboard-panels">
        <section className="card">
          <div className="eyebrow">System health</div>
          <h2 className="section-title">PostgreSQL-backed records</h2>
          <p className="muted">
            Student totals and class strength are calculated from real active records, preventing
            failed imports from inflating school numbers.
          </p>
        </section>
        <section className="card">
          <div className="eyebrow">Build progress</div>
          <h2 className="section-title">ATIS Web v0.9.6</h2>
          <p className="muted">
            Role-specific teacher access, attendance, assessments, report cards and the core Finance module are now in place.
            Parent/student self-service, private student/staff photos, subject aspects and timetable scheduling are now included. Staff self-service password changes now use a plain server submission instead of React action-state transport, with redirect-based success and error handling. Communications and advanced HR/operations remain.
          </p>
        </section>
      </div>
    </>
  );
}
