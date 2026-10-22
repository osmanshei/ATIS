import Image from "next/image";
import Link from "next/link";
import type { CurrentProfile } from "@/lib/auth";
import { navigationForRole } from "@/lib/rbac";
import { logoutAction } from "@/app/(protected)/logout-action";

export function Sidebar({ profile }: { profile: CurrentProfile }) {
  const items = navigationForRole(profile.role);
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <Image src="/atis-logo.svg" alt="ATIS" width={42} height={42} />
        <div>
          <strong>ATIS Web</strong>
          <small>Core v0.1</small>
        </div>
      </div>

      <nav className="nav">
        {items.map((item) => (
          <Link href={item.href} key={item.href}>
            <span className="nav-badge">{item.short}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-copy">
          <small>Signed in as</small>
          <strong>{profile.full_name}</strong>
          <small>@{profile.username} · {profile.role}</small>
        </div>
        <form action={logoutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
