"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export type PasswordState = { ok: boolean; message: string };
export const initialPasswordState: PasswordState = { ok: false, message: "" };

export async function changePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const { supabase, user } = await requireProfile();
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

  await supabase
    .from("profiles")
    .update({ must_change_password: false })
    .eq("user_id", user.id);

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return { ok: true, message: "Password changed successfully." };
}
