import { Sidebar } from "@/components/sidebar";
import { requireProfile } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireProfile();
  const { data: school } = await supabase
    .from("schools")
    .select("name,short_name,logo_url")
    .eq("id", profile.school_id)
    .single();

  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="shell">
      <Sidebar profile={profile} schoolLogoUrl={school?.logo_url} />
      <div className="main">
        <header className="topbar">
          <div className="topbar-school">
            <span className="topbar-kicker">School workspace</span>
            <strong>{school?.name || school?.short_name || "ATIS"}</strong>
          </div>
          <div className="topbar-user">
            <div className="topbar-avatar">{initials || "AT"}</div>
            <div>
              <strong>{profile.full_name}</strong>
              <span>{profile.role}</span>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
