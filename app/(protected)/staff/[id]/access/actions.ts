"use server";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionOrResetStaffLogin } from "@/lib/staff-access";

export type StaffLoginState = {
  ok: boolean;
  message: string;
  username?: string;
  temporaryPassword?: string;
  smsSent?: boolean;
  emailSent?: boolean;
  smsReason?: string;
  emailReason?: string;
  profileRefreshReason?: string;
};

export async function provisionStaffLoginAction(
  _previous: StaffLoginState,
  formData: FormData,
): Promise<StaffLoginState> {
  const { profile } = await requireProfile(["admin"]);
  const staffId = String(formData.get("staff_id") || "");

  if (!staffId) return { ok: false, message: "Staff ID is missing." };

  try {
    const admin = createAdminClient();
    const result = await provisionOrResetStaffLogin(admin, {
      schoolId: profile.school_id,
      staffId,
      sentBy: profile.user_id,
      loginUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    });

    const channels = [
      result.smsSent ? "SMS" : "",
      result.emailSent ? "email" : "",
    ].filter(Boolean);

    const successMessage = result.profileRefreshReason
      ? "A new temporary password was created successfully. " + result.profileRefreshReason
      : channels.length
        ? "A new temporary password was created and sent by " + channels.join(" and ") + "."
        : "A new temporary password was created, but automatic delivery is not configured or failed. Give the credentials to the staff member manually.";

    return {
      ok: true,
      message: successMessage,
      username: result.username,
      temporaryPassword: result.temporaryPassword,
      smsSent: result.smsSent,
      emailSent: result.emailSent,
      smsReason: result.smsReason,
      emailReason: result.emailReason,
      profileRefreshReason: result.profileRefreshReason,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create staff login details.",
    };
  }
}
