import { requireProfile } from "@/lib/auth";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { supabase, profile } = await requireProfile();
  const params = await searchParams;

  const [students, staff, classes, subjects, yearResult] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("subject_catalogue").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("academic_years").select("name").eq("is_current", true).maybeSingle(),
  ]);

  const stats = [
    ["Active students", students.count ?? 0, "Count comes from actual student rows"],
    ["Active staff", staff.count ?? 0, "Teaching and non-teaching staff"],
    ["Classes", classes.count ?? 0, "Optional sections remain supported"],
    ["Subjects", subjects.count ?? 0, "Master subject catalogue"],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome, {profile.full_name}. Academic year: {yearResult.data?.name || "Not configured"}</p>
        </div>
      </div>
      {params.denied ? <div className="notice">Your account does not have permission for that area.</div> : null}
      <div className="cards">
        {stats.map(([label, value, note]) => (
          <div className="card" key={String(label)}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-note">{note}</div>
          </div>
        ))}
      </div>
      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">What is different from Apps Script?</h2>
          <p className="muted">
            ATIS Web queries PostgreSQL directly with indexed relationships. Class strength is derived from
            real student records, not incremented during imports, so duplicate/error rows cannot inflate totals.
          </p>
        </section>
        <section className="card">
          <h2 className="section-title">Migration status</h2>
          <p className="muted">
            v0.1 contains the core identity and academic model. Admissions, bulk onboarding, attendance,
            assessments, finance and HR will be moved after the core data migration is verified.
          </p>
        </section>
      </div>
    </>
  );
}
