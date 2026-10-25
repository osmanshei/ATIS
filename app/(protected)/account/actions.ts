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
  const { user } = await requireProfile();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");

  if (password.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the new password." };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two password entries do not match." };
  }

  try {
    const admin = createAdminClient();

    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      password,
    });
    if (authError) {
      return { ok: false, message: authError.message };
    }

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

    revalidatePath("/account");
    revalidatePath("/dashboard");
    return { ok: true, message: "Password changed successfully." };
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
