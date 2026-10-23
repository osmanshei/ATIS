"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  initialPasswordState,
} from "@/app/(protected)/account/actions";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    initialPasswordState,
  );

  return (
    <form className="form-card" action={action}>
      <h2 className="section-title">Change password</h2>
      <div className="field">
        <label>New password</label>
        <input name="password" type="password" minLength={8} required />
      </div>
      <div className="field">
        <label>Confirm new password</label>
        <input name="confirm_password" type="password" minLength={8} required />
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
