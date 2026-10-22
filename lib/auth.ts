import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole =
  | "admin"
  | "supervisor"
  | "accountant"
  | "teacher"
  | "clerk"
  | "staff"
  | "student"
  | "parent";

export type CurrentProfile = {
  user_id: string;
  school_id: string;
  username: string;
  full_name: string;
  email: string;
  mobile: string | null;
  role: AppRole;
  status: "active" | "inactive" | "suspended";
  must_change_password: boolean;
};

export async function requireProfile(allowedRoles?: AppRole[]) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "user_id,school_id,username,full_name,email,mobile,role,status,must_change_password",
    )
    .eq("user_id", userData.user.id)
    .single();

  if (error || !profile || profile.status !== "active") {
    await supabase.auth.signOut();
    redirect("/login?error=Your+ATIS+account+is+not+active.");
  }

  const typed = profile as CurrentProfile;
  if (allowedRoles && !allowedRoles.includes(typed.role)) {
    redirect("/dashboard?denied=1");
  }

  return { supabase, user: userData.user, profile: typed };
}
