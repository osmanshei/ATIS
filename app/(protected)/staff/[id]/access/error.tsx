"use client";

import Link from "next/link";

export default function StaffAccessError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="form-card">
      <div className="eyebrow">Staff login access</div>
      <h1>The login action could not be completed</h1>
      <p className="muted">
        The staff HR record is safe. Retry the action; if the password had already been
        changed before an interruption, ATIS will simply generate a new temporary password.
      </p>
      <div className="action-row">
        <button className="button" type="button" onClick={() => reset()}>
          Retry
        </button>
        <Link className="button secondary" href="/staff">
          Back to Staff
        </Link>
      </div>
    </div>
  );
}
