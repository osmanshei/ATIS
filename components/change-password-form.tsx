export function ChangePasswordForm() {
  return (
    <form
      className="form-card"
      action="/api/account/change-password"
      method="post"
    >
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
      <button className="button" type="submit">
        Change password
      </button>
    </form>
  );
}
