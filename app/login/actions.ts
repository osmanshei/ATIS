"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function loginAction(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");

  if (!identifier || !password) {
    redirect("/login?error=Enter+your+username%2Femail+and+password.");
  }

  let email = identifier.toLowerCase();
  let adminForAudit: ReturnType<typeof createAdminClient> | null = null;

  if (!identifier.includes("@")) {
    try {
      adminForAudit = createAdminClient();
      const { data, error } = await adminForAudit
        .from("profiles")
        .select("email,status")
        .eq("username", identifier)
        .limit(1)
        .maybeSingle();

      if (error || !data || data.status !== "active") {
        redirect("/login?error=Invalid+login+details.");
      }
      email = String(data.email).toLowerCase();
    } catch (error) {
      if (error && typeof error === "object" && "digest" in error) throw error;
      redirect("/login?error=Username+login+is+not+configured.+Try+your+email+address.");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect("/login?error=Invalid+login+details.");
  }

  try {
    const admin = adminForAudit || createAdminClient();
    await admin
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("user_id", data.user.id);
  } catch {
    // Login must still succeed if the optional login timestamp cannot be written.
  }

  redirect("/dashboard");
}
