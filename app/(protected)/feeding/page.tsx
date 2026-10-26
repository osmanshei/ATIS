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
  searchParams: Promise<{ date?: string }>;
}) {
  const { supabase, profile } = await requireProfile([
    "admin",
    "supervisor",
    "accountant",
    "clerk",
  ]);
  const params = await searchParams;
  const date = params.date || today();

  const [{ data: classes }, { data: dailyRows }, { data: currentTerm }] = await Promise.all([
    supabase
      .from("class_summary")
      .select("id,class_name,section,total_strength,grade_level,is_active")
      .eq("is_active", true)
      .order("grade_level", { nullsFirst: true })
      .order("class_name"),
    supabase
      .from("feeding_daily_register")
      .select("class_id,class_name,section,student_id,attendance_status,payment_mark,daily_charge,credit_balance")
      .eq("feeding_date", date),
    supabase
      .from("terms")
      .select("id,name,is_current")
      .eq("is_current", true)
      .maybeSingle(),
  ]);

  const rows = dailyRows || [];
  const classMap = new Map<string, any[]>();
  rows.forEach((row: any) => {
    const bucket = classMap.get(row.class_id) || [];
    bucket.push(row);
    classMap.set(row.class_id, bucket);
  });

  let termWallet: any[] = [];
  if (currentTerm) {
    const { data } = await supabase
      .from("feeding_wallet_entries")
      .select("entry_type,amount")
      .eq("term_id", currentTerm.id);
    termWallet = data || [];
  }

  const paidToday = rows.filter((r: any) => r.payment_mark === "paid").length;
  const exemptToday = rows.filter((r: any) => r.payment_mark === "exempt").length;
  const unpaidToday = rows.filter((r: any) => r.payment_mark === "unpaid").length;
  const carriedToday = rows.filter((r: any) => r.payment_mark === "credit_carried_forward").length;
  const consumedToday = rows.reduce((sum: number, r: any) => sum + Number(r.daily_charge || 0), 0);
  const termPayments = termWallet
    .filter((r: any) => r.entry_type === "payment")
    .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
  const termCharges = Math.abs(
    termWallet
      .filter((r: any) => r.entry_type === "charge")
      .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0),
  );

  const day = new Date(date + "T00:00:00").getUTCDay();
  const feedingDay = day >= 1 && day <= 4;
  const canConfigure = ["admin", "supervisor", "accountant", "clerk"].includes(profile.role);

  return (
    <>
      <section className="welcome-hero">
        <div>
          <div className="eyebrow">Attendance-linked feeding · {date}</div>
          <h1>Feeding Management</h1>
          <p>
            Attendance is the source of truth. Present or late students consume one daily feeding
            charge; absent students keep their prepaid credit for the next feeding day.
          </p>
        </div>
        <div className="hero-actions">
          {canConfigure ? <Link className="button hero-button" href="/feeding/payments">Record Payment</Link> : null}
          {canConfigure ? <Link className="button secondary hero-secondary" href="/feeding/settings">Rates & Plans</Link> : null}
        </div>
      </section>

      {!feedingDay ? (
        <div className="notice">ATIS feeding is normally Monday to Thursday. No automatic feeding charge is created for this date.</div>
      ) : null}

      <form className="term-switcher" method="get">
        <label>Date</label>
        <input name="date" type="date" defaultValue={date} />
        <button className="button secondary compact" type="submit">View</button>
      </form>

      <div className="cards cards-five">
        <div className="metric-card"><span className="metric-kicker">Paid today</span><strong>{paidToday}</strong><small>Present/late with available credit</small></div>
        <div className="metric-card"><span className="metric-kicker">Exempt today</span><strong>{exemptToday}</strong><small>Staff/management children and other exemptions</small></div>
        <div className="metric-card"><span className="metric-kicker">Unpaid today</span><strong>{unpaidToday}</strong><small>Present/late without enough credit</small></div>
        <div className="metric-card"><span className="metric-kicker">Credit carried forward</span><strong>{carriedToday}</strong><small>Absent students with prepaid balance</small></div>
        <div className="metric-card"><span className="metric-kicker">Charges today</span><strong>{money(consumedToday)}</strong><small>{currentTerm?.name || "Current term"}: {money(termCharges)} consumed / {money(termPayments)} paid</small></div>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Class feeding</div>
            <h2>Attendance-linked registers</h2>
          </div>
        </div>

        <div className="feeding-class-grid">
          {(classes || []).map((cls: any) => {
            const classRows = classMap.get(cls.id) || [];
            const present = classRows.filter((r: any) => ["present", "late"].includes(r.attendance_status)).length;
            const paid = classRows.filter((r: any) => r.payment_mark === "paid").length;
            const exempt = classRows.filter((r: any) => r.payment_mark === "exempt").length;
            const unpaid = classRows.filter((r: any) => r.payment_mark === "unpaid").length;
            const attendanceMarked = classRows.length > 0;

            return (
              <article className="feeding-class-card" key={cls.id}>
                <div>
                  <span className="metric-kicker">Class</span>
                  <h3>{cls.class_name}{cls.section ? " / " + cls.section : ""}</h3>
                  <p>{cls.total_strength || 0} active students</p>
                </div>

                <div className="feeding-card-stats">
                  <span className={attendanceMarked ? "tag" : "tag gray"}>
                    {attendanceMarked ? "Attendance synced" : "Attendance not marked"}
                  </span>
                  <strong>{present} in school</strong>
                  <small>{paid} paid · {exempt} exempt · {unpaid} unpaid</small>
                </div>

                <Link className="button compact" href={"/feeding/register?class=" + cls.id + "&date=" + date}>
                  Open Feeding View
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
