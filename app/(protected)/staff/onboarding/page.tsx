import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { StaffBulkOnboarding } from "@/components/staff-bulk-onboarding";

export default async function StaffOnboardingPage() {
  await requireProfile(["admin"]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff Bulk Onboarding</h1>
          <p>Create staff records and Supabase login accounts in one workflow.</p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/templates/staff-bulk-onboarding.csv">
            Download CSV template
          </Link>
          <Link className="button secondary" href="/staff">Back to staff</Link>
        </div>
      </div>

      <div className="grid-2">
        <StaffBulkOnboarding />
        <section className="card">
          <h2 className="section-title">Supported roles</h2>
          <p className="muted">
            Teacher, Supervisor, Clerk, Accountant, Staff, Cleaner, Cook, Caretaker,
            Security Guard, Watchman, Driver, Nurse, Matron, Storekeeper, Librarian,
            Lab Attendant, Groundskeeper, Gardener, Maintenance Staff, Kitchen Staff,
            Office Assistant and Porter.
          </p>
          <p className="muted">
            Non-teaching duties receive the restricted Staff system role while their
            actual job title is retained as the position/duty.
          </p>
          <p className="muted">
            Administrator accounts are never bulk-created.
          </p>
        </section>
      </div>
    </>
  );
}
