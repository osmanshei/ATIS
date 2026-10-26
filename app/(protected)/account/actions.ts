"use server";

import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type PasswordState = { ok: boolean; message: string };
export const initialPasswordState: PasswordState = { ok: false, message: "" };

export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const { supabase, user, profile } = await requireProfile();
  const currentPassword = String(formData.get("current_password") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");

  if (!currentPassword) {
    return { ok: false, message: "Enter your current password." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the new password." };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two new password entries do not match." };
  }
  if (currentPassword === password) {
    return {
      ok: false,
      message: "Choose a new password that is different from your current password.",
    };
  }

  const loginEmail = user.email || profile.email;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return {
      ok: false,
      message: "Password change is temporarily unavailable. Please contact the administrator.",
    };
  }

  try {
    // Verify the current password in an isolated client. This deliberately does
    // not touch the cookie-backed session that is currently rendering /account.
    const verifier = createSupabaseClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: loginEmail,
      password: currentPassword,
    });

    if (verifyError) {
      return { ok: false, message: "Your current password is incorrect." };
    }

    const admin = createAdminClient();

    // Change only the currently authenticated user's password.
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      password,
    });

    if (authError) {
      return {
        ok: false,
        message: authError.message || "The password could not be changed. Please try again.",
      };
    }

    // Clear the temporary-password flag. A failure here must not undo or mask
    // the password change that has already succeeded.
    await admin
      .from("profiles")
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    // End the old browser session cleanly. The user then proves the new
    // password immediately by signing in again.
    await supabase.auth.signOut();
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The password could not be changed. Please try again.",
    };
  }

  redirect(
    "/login?message=Password+changed+successfully.+Please+sign+in+with+your+new+password.",
  );
}
