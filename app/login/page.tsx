import Image from "next/image";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="login-page">
      <section className="login-brand">
        <div>
          <Image src="/atis-logo.jpg" alt="ATIS" width={100} height={100} priority />
          <h1>ATIS Web</h1>
          <p>
            The hosted school-management platform for AL-KHALIDIYA TECHNICAL ISLAMIC SCHOOL.
            Fast database queries, secure role permissions and a foundation ready for the modules
            already proven in ATIS v1.0.10.
          </p>
        </div>
        <small>Core platform v0.1.0 · Ghana · Africa/Accra</small>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>Sign in</h2>
          <p>Use your ATIS username or email address.</p>
          {params.error ? <div className="notice error">{params.error}</div> : null}
          <form action={loginAction}>
            <div className="field">
              <label htmlFor="identifier">Username or email</label>
              <input id="identifier" name="identifier" autoComplete="username" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            <button className="button block" type="submit">Sign in to ATIS</button>
          </form>
        </div>
      </section>
    </main>
  );
}
