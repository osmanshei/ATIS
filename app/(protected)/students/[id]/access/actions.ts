"use server";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  provisionGuardianPortalLogin,
  provisionStudentPortalLogin,
} from "@/lib/portal-access";

export type PortalCredentialState = {
  ok: boolean;
  message: string;
  fullName?: string;
  username?: string;
  temporaryPassword?: string;
  smsSent?: boolean;
  emailSent?: boolean;
  smsReason?: string;
  emailReason?: string;
};

export const initialPortalCredentialState: PortalCredentialState = {
  ok: false,
  message: "",
};

export async function provisionStudentPortalAction(
  _previous: PortalCredentialState,
  formData: FormData,
): Promise<PortalCredentialState> {
  const { profile } = await requireProfile(["admin"]);
  const studentId = String(formData.get("student_id") || "");
  if (!studentId) return { ok: false, message: "Student ID is missing." };

  try {
    const result = await provisionStudentPortalLogin(createAdminClient(), {
      schoolId: profile.school_id,
      studentId,
      sentBy: profile.user_id,
    });
    return {
      ok: true,
      message: "Student portal credentials are ready.",
      ...result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create student portal access.",
    };
  }
}

export async function provisionGuardianPortalAction(
  _previous: PortalCredentialState,
  formData: FormData,
): Promise<PortalCredentialState> {
  const { profile } = await requireProfile(["admin"]);
  const guardianId = String(formData.get("guardian_id") || "");
  if (!guardianId) return { ok: false, message: "Guardian ID is missing." };

  try {
    const result = await provisionGuardianPortalLogin(createAdminClient(), {
      schoolId: profile.school_id,
      guardianId,
      sentBy: profile.user_id,
    });
    return {
      ok: true,
      message: "Parent portal credentials are ready.",
      ...result,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create parent portal access.",
    };
  }
}
