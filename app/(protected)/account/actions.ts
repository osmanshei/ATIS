"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export type PasswordState = { ok: boolean; message: string };
export const initialPasswordState: PasswordState = { ok: false, message: "" };

export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const { supabase } = await requireProfile();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm_password") || "");

  if (password.length < 8) {
    return { ok: false, message: "Use at least 8 characters for the new password." };
  }
  if (password !== confirm) {
    return { ok: false, message: "The two password entries do not match." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };

  await supabase.rpc("mark_own_password_changed");

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true, message: "Password changed successfully." };
}
