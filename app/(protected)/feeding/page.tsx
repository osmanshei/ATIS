import Link from "next/link";
import { requireProfile } from "@/lib/auth";

function money(value: number | string | null | undefined) {
  return "GHS " + Number(value || 0).toFixed(2);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function FeedingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; ok?: string; error?: string }>;
}) {
  const { supabase, profile } = await requireProfile([
    "admin",
    "supervisor",
    "accountant",
    "clerk",
    "staff",
  ]);
  const params = await searchParams;
  const date = params.date || today();
  const canManage = ["admin", "supervisor", "clerk", "staff"].includes(profile.role);

  const [{ data: classes }, { data: sessions }, { data: currentTerm }] = await Promise.all([
    supabase
      .from("class_summary")
      .select("id,class_name,section,total_strength,grade_level,is_active")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
    supabase
      .from("feeding_session_summary")
      .select("id,class_id,class_name,section,feeding_date,meal_name,unit_cost,fed_count,not_fed_count,exempt_count,actual_cost,is_locked")
      .eq("feeding_date", date)
      .order("class_name"),
    supabase
      .from("terms")
      .select("id,name,academic_year_id,starts_on,ends_on")
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  let termSessions: any[] = [];
  if (currentTerm) {
    const { data } = await supabase
      .from("feeding_session_summary")
      .select("fed_count,actual_cost")
      .eq("term_id", currentTerm.id);
    termSessions = data || [];
  }

  const sessionMap = new Map((sessions || []).map((s: any) => [s.class_id, s]));
  const fedToday = (sessions || []).reduce((sum: number, row: any) => sum + Number(row.fed_count || 0), 0);
  const costToday = (sessions || []).reduce((sum: number, row: any) => sum + Number(row.actual_cost || 0), 0);
  const fedTerm = termSessions.reduce((sum: number, row: any) => sum + Number(row.fed_count || 0), 0);
  const costTerm = termSessions.reduce((sum: number, row: any) => sum + Number(row.actual_cost || 0), 0);
  const dayOfWeek = new Date(date + "T00:00:00").getUTCDay();
  const scheduledDay = dayOfWeek >= 1 && dayOfWeek <= 4;

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">School feeding · {date}</div>
          <h1>Feeding Management</h1>
          <p>Record meals served by class, monitor feeding costs and review daily or term totals.</p>
        </div>
      </section>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}
      {!scheduledDay ? (
        <div className="notice">ATIS feeding is normally scheduled from Monday to Thursday. Choose a feeding day to record meals.</div>
      ) : null}

      <form className="term-switcher" method="get">
        <label>Date</label>
        <input name="date" type="date" defaultValue={date} />
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="cards cards-five">
        <div className="metric-card">
          <span className="metric-kicker">Classes recorded</span>
          <strong>{sessions?.length || 0}</strong>
          <small>of {classes?.length || 0} active classes</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Students fed today</span>
          <strong>{fedToday}</strong>
          <small>Recorded meals served</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Today's feeding cost</span>
          <strong>{money(costToday)}</strong>
          <small>Based on class unit costs</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Term meals served</span>
          <strong>{fedTerm}</strong>
          <small>{currentTerm?.name || "Current term"}</small>
        </div>
        <div className="metric-card">
          <span className="metric-kicker">Term feeding cost</span>
          <strong>{money(costTerm)}</strong>
          <small>{currentTerm?.name || "Current term"}</small>
        </div>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Daily registers</div>
            <h2>Class feeding status</h2>
          </div>
        </div>

        <div className="feeding-class-grid">
          {(classes || []).map((cls: any) => {
            const session = sessionMap.get(cls.id) as any;
            return (
              <article className="feeding-class-card" key={cls.id}>
                <div>
                  <span className="metric-kicker">Class</span>
                  <h3>{cls.class_name}{cls.section ? " / " + cls.section : ""}</h3>
                  <p>{cls.total_strength || 0} active students</p>
                </div>

                {session ? (
                  <div className="feeding-card-stats">
                    <span className="tag">Recorded</span>
                    <strong>{session.fed_count} fed</strong>
                    <small>{session.not_fed_count} not fed · {session.exempt_count} exempt</small>
                    <small>{money(session.actual_cost)} · {money(session.unit_cost)} per meal</small>
                  </div>
                ) : (
                  <div className="feeding-card-stats">
                    <span className="tag gray">Not recorded</span>
                    <strong>—</strong>
                    <small>Feeding register pending</small>
                  </div>
                )}

                {canManage && scheduledDay ? (
                  <Link
                    className="button compact"
                    href={"/feeding/register?class=" + cls.id + "&date=" + date}
                  >
                    {session ? "Open Register" : "Record Feeding"}
                  </Link>
                ) : null}
              </article>
            );
          })}
          {!classes?.length ? (
            <div className="empty-state">
              <strong>No active classes</strong>
              <p>No classes are available for feeding records.</p>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
