import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { bulkImportStudentsAction } from "./actions";

export default async function BulkOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireProfile(["admin", "supervisor", "clerk"]);
  const params = await searchParams;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bulk Onboarding</h1>
          <p>Fast CSV onboarding directly into PostgreSQL with duplicate and row validation.</p>
        </div>
        <Link className="button secondary" href="/templates/student-bulk-onboarding.csv">
          Download CSV template
        </Link>
      </div>

      {params.ok ? <div className="notice success">{params.ok}</div> : null}
      {params.error ? <div className="notice error">{params.error}</div> : null}

      <div className="grid-2">
        <form className="form-card" action={bulkImportStudentsAction}>
          <h2 className="section-title">Student CSV import</h2>
          <div className="field">
            <label>CSV file</label>
            <input name="file" type="file" accept=".csv,text/csv" required />
          </div>
          <button className="button" type="submit">Validate & import students</button>
        </form>

        <section className="card">
          <h2 className="section-title">Required fields</h2>
          <p className="muted">
            Admission Number, First Name, Last Name, and either Class Code or Class Name.
            Gender, DOB, admission date, address, guardian details, NHIS and medical notes are optional.
          </p>
          <p className="muted">
            Existing admission numbers and repeated rows in the same file are skipped. A row with an
            unknown class or invalid DOB is rejected rather than partially written.
          </p>
        </section>
      </div>
    </>
  );
}
