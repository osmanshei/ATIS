import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function redirectWith(request: Request, path: string, key: string, message: string) {
  const url = new URL(path, request.url);
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user?.email) {
      return redirectWith(request, "/login", "error", "Please sign in again.");
    }

    const formData = await request.formData();
    const currentPassword = String(formData.get("current_password") || "");
    const newPassword = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirm_password") || "");

    if (!currentPassword) {
      return redirectWith(request, "/account", "error", "Enter your current password.");
    }
    if (newPassword.length < 8) {
      return redirectWith(
        request,
        "/account",
        "error",
        "Use at least 8 characters for the new password.",
      );
    }
    if (newPassword !== confirmPassword) {
      return redirectWith(
        request,
        "/account",
        "error",
        "The two new password entries do not match.",
      );
    }
    if (currentPassword === newPassword) {
      return redirectWith(
        request,
        "/account",
        "error",
        "Choose a new password that is different from your current password.",
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      return redirectWith(
        request,
        "/account",
        "error",
        "Password change is temporarily unavailable. Please contact the administrator.",
      );
    }

    const verifier = createSupabaseClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: userData.user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return redirectWith(
        request,
        "/account",
        "error",
        "Your current password is incorrect.",
      );
    }

    const { error: updateError } = await verifier.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return redirectWith(
        request,
        "/account",
        "error",
        updateError.message || "The password could not be changed. Please try again.",
      );
    }

    await verifier.rpc("mark_own_password_changed");
    await verifier.auth.signOut();
    await supabase.auth.signOut();

    return redirectWith(
      request,
      "/login",
      "message",
      "Password changed successfully. Please sign in with your new password.",
    );
  } catch {
    return redirectWith(
      request,
      "/account",
      "error",
      "The password could not be changed. Please try again.",
    );
  }
}
