import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { StaffSingleOnboarding } from "@/components/staff-single-onboarding";

export default async function NewStaffPage() {
  await requireProfile(["admin"]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Human resources · direct onboarding</div>
          <h1>Add Staff</h1>
          <p>
            Add one teacher or non-teaching staff member and create their ATIS login immediately.
          </p>
        </div>
        <div className="action-row">
          <Link className="button secondary" href="/staff/onboarding">Bulk Onboarding</Link>
          <Link className="button secondary" href="/staff">Back to staff</Link>
        </div>
      </div>

      <StaffSingleOnboarding />
    </>
  );
}
