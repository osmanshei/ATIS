import { requireProfile } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

export default async function AccountPage() {
  const { profile } = await requireProfile();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My Account</h1>
          <p>Manage your ATIS login details.</p>
        </div>
      </div>

      {profile.must_change_password ? (
        <div className="notice">
          You are using a temporary password. Change it before continuing to use this account regularly.
        </div>
      ) : null}

      <div className="grid-2">
        <section className="card">
          <h2 className="section-title">Profile</h2>
          <p><strong>Name:</strong> {profile.full_name}</p>
          <p><strong>Username:</strong> @{profile.username}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Phone:</strong> {profile.mobile || "—"}</p>
          <p><strong>Role:</strong> {profile.role}</p>
        </section>
        <ChangePasswordForm />
      </div>
    </>
  );
}
