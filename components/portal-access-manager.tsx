"use client";

import { useActionState } from "react";
import {
  initialPortalCredentialState,
  provisionGuardianPortalAction,
  provisionStudentPortalAction,
} from "@/app/(protected)/students/[id]/access/actions";

function Credentials({
  state,
}: {
  state: typeof initialPortalCredentialState;
}) {
  if (!state.message) return null;
  return (
    <div className={state.ok ? "notice success portal-credentials" : "notice error"}>
      <strong>{state.message}</strong>
      {state.ok && state.username && state.temporaryPassword ? (
        <div className="credential-grid">
          <div><span>Name</span><strong>{state.fullName}</strong></div>
          <div><span>Username</span><strong>{state.username}</strong></div>
          <div><span>Temporary Password</span><strong>{state.temporaryPassword}</strong></div>
          <div>
            <span>Delivery</span>
            <strong>
              SMS: {state.smsSent ? "Sent" : "Not sent"} · Email: {state.emailSent ? "Sent" : "Not sent"}
            </strong>
          </div>
        </div>
      ) : null}
      {state.ok && !state.smsSent && state.smsReason ? <small>SMS: {state.smsReason}</small> : null}
      {state.ok && !state.emailSent && state.emailReason ? <small>Email: {state.emailReason}</small> : null}
    </div>
  );
}

export function PortalAccessManager({
  student,
  guardians,
}: {
  student: { id: string; fullName: string; hasLogin: boolean };
  guardians: Array<{
    id: string;
    fullName: string;
    relation: string;
    mobile: string;
    email: string;
    hasLogin: boolean;
    primary: boolean;
  }>;
}) {
  const [studentState, studentAction, studentPending] = useActionState(
    provisionStudentPortalAction,
    initialPortalCredentialState,
  );
  const [guardianState, guardianAction, guardianPending] = useActionState(
    provisionGuardianPortalAction,
    initialPortalCredentialState,
  );

  return (
    <div className="grid-2 portal-access-grid">
      <section className="form-card">
        <div className="eyebrow">Student account</div>
        <h2 className="section-title">{student.fullName}</h2>
        <p className="muted">
          {student.hasLogin
            ? "A student login already exists. Resetting generates a new temporary password."
            : "Create a restricted student login for results, attendance and fees."}
        </p>
        <form action={studentAction}>
          <input type="hidden" name="student_id" value={student.id} />
          <button className="button" type="submit" disabled={studentPending}>
            {studentPending
              ? "Generating..."
              : student.hasLogin
                ? "Reset Student Login"
                : "Create Student Login"}
          </button>
        </form>
        <Credentials state={studentState} />
      </section>

      <section className="form-card">
        <div className="eyebrow">Parent / guardian accounts</div>
        <h2 className="section-title">Linked guardians</h2>
        <div className="guardian-access-list">
          {guardians.map((g) => (
            <form className="guardian-access-row" action={guardianAction} key={g.id}>
              <input type="hidden" name="guardian_id" value={g.id} />
              <div>
                <strong>{g.fullName}</strong>
                <small>
                  {g.relation}{g.primary ? " · Primary contact" : ""}<br />
                  {[g.mobile, g.email].filter(Boolean).join(" · ") || "No contact details"}
                </small>
              </div>
              <button className="button secondary compact" type="submit" disabled={guardianPending}>
                {g.hasLogin ? "Reset Login" : "Create Login"}
              </button>
            </form>
          ))}
          {!guardians.length ? (
            <div className="empty-state">
              <strong>No guardian is linked</strong>
              <p>Add/link a guardian before creating a parent portal account.</p>
            </div>
          ) : null}
        </div>
        <Credentials state={guardianState} />
      </section>
    </div>
  );
}
