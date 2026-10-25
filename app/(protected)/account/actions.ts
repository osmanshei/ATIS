"use server";

import { revalidatePath } from "next/cache";
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
    return { ok: false, message: "Choose a new password that is different from your current password." };
  }

  const loginEmail = user.email || profile.email;

  try {
    // Re-authenticate first so the password update is a true self-service change
    // and is not blocked by an old/stale Supabase session.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: currentPassword,
    });

    if (reauthError) {
      return { ok: false, message: "Your current password is incorrect." };
    }

    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      return {
        ok: false,
        message: authError.message || "The password could not be changed. Please try again.",
      };
    }

    // The password is already active at this point. Use the admin client only
    // to clear the account's temporary-password flag reliably across staff roles.
    try {
      const admin = createAdminClient();
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (profileError) {
        return {
          ok: true,
          message:
            "Password changed successfully. The account flag could not be refreshed automatically, but the new password is active.",
        };
      }
    } catch {
      return {
        ok: true,
        message:
          "Password changed successfully. The account flag could not be refreshed automatically, but the new password is active.",
      };
    }

    revalidatePath("/account");
    revalidatePath("/dashboard");
    return { ok: true, message: "Password changed successfully. Use the new password the next time you sign in." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "The password could not be changed. Please try again.",
    };
  }
}
