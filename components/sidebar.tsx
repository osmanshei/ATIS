"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CurrentProfile } from "@/lib/auth";
import { navigationForRole } from "@/lib/rbac";
import { logoutAction } from "@/app/(protected)/logout-action";

function NavIcon({ code }: { code: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<string, React.ReactNode> = {
    DB: <svg {...common}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>,
    AD: <svg {...common}><path d="M6 3h9l3 3v15H6z"/><path d="M9 11h6M9 15h6M9 7h3"/></svg>,
    BO: <svg {...common}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>,
    ST: <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6"/><circle cx="17" cy="9" r="2"/><path d="M15.5 14c2.8.2 4.5 2 5 5"/></svg>,
    SF: <svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 21c.8-4.4 3.1-6.5 7-6.5s6.2 2.1 7 6.5"/></svg>,
    HR: <svg {...common}><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M3 11h18"/></svg>,
    CL: <svg {...common}><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>,
    SU: <svg {...common}><path d="M4 5.5 12 3l8 2.5-8 2.5z"/><path d="M6 8v7c2 2 10 2 12 0V8"/></svg>,
    TA: <svg {...common}><path d="M4 4h16v6H4z"/><path d="M7 15h4v5H7zM13 15h4v5h-4z"/><path d="M12 10v3"/></svg>,
    AT: <svg {...common}><path d="M5 4h14v17H5z"/><path d="M8 8h8"/><path d="m8 13 2 2 4-4"/></svg>,
    AC: <svg {...common}><circle cx="12" cy="8" r="3"/><path d="M5 21c.8-4.5 3.1-6.5 7-6.5s6.2 2 7 6.5"/></svg>,
  };

  return <>{icons[code] || <span>{code}</span>}</>;
}

export function Sidebar({ profile }: { profile: CurrentProfile }) {
  const pathname = usePathname();
  const items = navigationForRole(profile.role);

  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">
          <Image src="/atis-logo.svg" alt="ATIS" width={44} height={44} priority />
        </div>
        <div className="brand-copy">
          <strong>ATIS</strong>
          <small>School Management</small>
        </div>
      </div>

      <div className="nav-section-label">Workspace</div>
      <nav className="nav">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
          const label =
            profile.role === "teacher" && item.href === "/teacher-assignments"
              ? "My Teaching"
              : item.label;

          return (
            <Link
              href={item.href}
              key={item.href}
              className={active ? "active" : undefined}
            >
              <span className="nav-icon"><NavIcon code={item.short} /></span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{profile.full_name.slice(0, 1).toUpperCase()}</div>
          <div className="user-copy">
            <strong>{profile.full_name}</strong>
            <small>@{profile.username} · {profile.role}</small>
          </div>
        </div>
        <form action={logoutAction}>
          <button type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  );
}
