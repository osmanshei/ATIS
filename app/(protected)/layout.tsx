import { Sidebar } from "@/components/sidebar";
import { requireProfile } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireProfile();
  const { data: school } = await supabase
    .from("schools")
    .select("name,short_name")
    .eq("id", profile.school_id)
    .single();

  return (
    <div className="shell">
      <Sidebar profile={profile} />
      <div className="main">
        <header className="topbar">
          <div className="school">{school?.short_name || "ATIS"}</div>
          <span className="role-pill">{profile.role}</span>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
