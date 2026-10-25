"use client";

import Link from "next/link";

export default function PortalAccessError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="form-card">
      <div className="eyebrow">Portal access</div>
      <h1>Portal account action could not be completed</h1>
      <p className="muted">
        ATIS kept the student and guardian records intact. You can retry this screen safely.
        If an account was already created before the interruption, the next attempt will reset
        and reuse that linked account rather than creating a duplicate.
      </p>
      <div className="action-row">
        <button className="button" type="button" onClick={() => reset()}>
          Retry
        </button>
        <Link className="button secondary" href="/portal-access">
          Back to Parent & Student Portals
        </Link>
      </div>
    </div>
  );
}
