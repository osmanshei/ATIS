"use client";

import { useActionState } from "react";
import {
  provisionStaffLoginAction,
  type StaffLoginState,
} from "@/app/(protected)/staff/[id]/access/actions";

const initialState: StaffLoginState = { ok: false, message: "" };

export function StaffLoginPanel({
  staffId,
  hasLogin,
}: {
  staffId: string;
  hasLogin: boolean;
}) {
  const [state, action, pending] = useActionState(provisionStaffLoginAction, initialState);

  return (
    <section className="card">
      <h2 className="section-title">{hasLogin ? "Reset & Send Login Details" : "Create & Send Login Details"}</h2>
      <p className="muted">
        ATIS generates a new temporary password. If this staff member already has an account,
        the previous password will stop working.
      </p>

      <form action={action}>
        <input type="hidden" name="staff_id" value={staffId} />
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Generating..." : hasLogin ? "Generate New Login Details" : "Create Staff Login"}
        </button>
      </form>

      {state.message ? (
        <div className={state.ok ? "notice success" : "notice error"}>{state.message}</div>
      ) : null}

      {state.ok && state.username && state.temporaryPassword ? (
        <div className="credentials-box">
          <div><span>Username</span><strong>{state.username}</strong></div>
          <div><span>Temporary password</span><strong>{state.temporaryPassword}</strong></div>
          <div className="muted">
            SMS: {state.smsSent ? "submitted" : state.smsReason || "not sent"} · Email:{" "}
            {state.emailSent ? "sent" : state.emailReason || "not sent"}
          </div>
          {state.profileRefreshReason ? (
            <div className="muted">{state.profileRefreshReason}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
