"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  changePasswordAction,
  initialPasswordState,
} from "@/app/(protected)/account/actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialPasswordState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} className="form-card" action={action}>
      <h2 className="section-title">Change password</h2>
      <p className="muted">
        Confirm your current password, then choose a new password for this account.
      </p>
      <div className="field">
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          name="current_password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirm-new-password">Confirm new password</label>
        <input
          id="confirm-new-password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Changing..." : "Change password"}
      </button>
      {state.message ? (
        <div className={state.ok ? "notice success" : "notice error"}>{state.message}</div>
      ) : null}
    </form>
  );
}
