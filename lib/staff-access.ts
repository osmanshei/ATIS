import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const SMS_BASE = (process.env.SMS_ONLINE_GHANA_BASE_URL || "https://api.smsonlinegh.com/v5").replace(/\/+$/, "");
const SMS_SENDER = process.env.SMS_ONLINE_GHANA_GENERAL_SENDER || "ATIS_GH";

function validStaffEmail(value: string | null | undefined) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function staffFetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = 3500,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeGhanaPhone(value: string | null | undefined) {
  let phone = String(value || "").trim().replace(/[^\d+]/g, "");
  if (phone.startsWith("+")) phone = phone.slice(1);
  if (phone.startsWith("00233")) phone = phone.slice(2);
  if (/^0\d{9}$/.test(phone)) phone = "233" + phone.slice(1);
  else if (/^\d{9}$/.test(phone)) phone = "233" + phone;
  return /^233\d{9}$/.test(phone) ? phone : "";
}

export function generateTemporaryPassword() {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#";
  const all = lower + upper + digits + symbols;
  const required = [
    lower[crypto.randomInt(lower.length)],
    upper[crypto.randomInt(upper.length)],
    digits[crypto.randomInt(digits.length)],
    symbols[crypto.randomInt(symbols.length)],
  ];
  while (required.length < 12) required.push(all[crypto.randomInt(all.length)]);
  for (let i = required.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }
  return required.join("");
}

function usernameBase(fullName: string) {
  const parts = fullName
    .normalize("NFKD")
    .replace(/[^a-zA-Z\s-]/g, "")
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!parts.length) return "staff";
  if (parts.length === 1) return parts[0].slice(0, 18);
  return (parts[0][0] + parts[parts.length - 1]).slice(0, 18);
}

export async function generateUniqueUsername(
  admin: SupabaseClient,
  fullName: string,
  preferred?: string | null,
) {
  const raw = String(preferred || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const base = (raw || usernameBase(fullName) || "staff").slice(0, 18);

  for (let suffix = 0; suffix < 500; suffix += 1) {
    const candidate = suffix === 0 ? base : base + String(suffix + 1);
    const { data } = await admin
      .from("profiles")
      .select("user_id")
      .eq("username", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("Could not generate a unique username.");
}

async function logDelivery(
  admin: SupabaseClient,
  args: {
    schoolId: string;
    staffId: string;
    kind: "staff_login" | "appointment";
    channel: "sms" | "email" | "manual";
    destination?: string;
    status: string;
    providerReference?: string;
    sentBy?: string;
    details?: Record<string, unknown>;
  },
) {
  await admin.from("staff_delivery_logs").insert({
    school_id: args.schoolId,
    staff_id: args.staffId,
    kind: args.kind,
    channel: args.channel,
    destination: args.destination || null,
    status: args.status,
    provider_reference: args.providerReference || null,
    details: args.details || {},
    sent_by: args.sentBy || null,
  });
}

export async function sendStaffCredentials(
  admin: SupabaseClient,
  args: {
    schoolId: string;
    staffId: string;
    fullName: string;
    mobile?: string | null;
    email?: string | null;
    username: string;
    temporaryPassword: string;
    sentBy?: string;
    loginUrl?: string;
  },
) {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  const loginUrl =
    args.loginUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (vercelHost ? "https://" + vercelHost : "");
  const plainMessage =
    "Dear " + args.fullName + ", ATIS staff login: " +
    (loginUrl ? loginUrl + " " : "") +
    "Username: " + args.username +
    ". Temporary password: " + args.temporaryPassword +
    ". Please change your password after login.";

  const safeLog = async (details: Parameters<typeof logDelivery>[1]) => {
    try {
      await logDelivery(admin, details);
    } catch {
      // Delivery logging must never prevent a password reset from succeeding.
    }
  };

  const sendSms = async () => {
    const smsKey = process.env.SMS_ONLINE_GHANA_API_KEY || "";
    const phone = normalizeGhanaPhone(args.mobile);

    if (!smsKey) return { sent: false, reason: "SMS API is not configured." };
    if (!phone) return { sent: false, reason: "No valid Ghana mobile number." };

    try {
      const response = await staffFetchWithTimeout(SMS_BASE + "/message/sms/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "key " + smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: plainMessage,
          type: 0,
          sender: SMS_SENDER,
          destinations: [phone],
        }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      const ok =
        response.ok &&
        body?.handshake &&
        Number(body.handshake.id) === 0 &&
        String(body.handshake.label || "") === "HSHK_OK";

      if (!ok) throw new Error(body?.handshake?.label || "HTTP " + response.status);

      const destination = body?.data?.destinations?.[0] || {};
      await safeLog({
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "sms",
        destination: phone,
        status: "submitted",
        providerReference: String(destination.id || body?.data?.batch || ""),
        sentBy: args.sentBy,
        details: { sender: SMS_SENDER, message: "[REDACTED: Staff login credentials]" },
      });
      return { sent: true, reason: "" };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "SMS provider did not respond quickly enough. The new password is still active."
          : error instanceof Error
            ? error.message
            : "SMS delivery failed.";

      await safeLog({
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "sms",
        destination: phone || args.mobile || "",
        status: "failed",
        sentBy: args.sentBy,
        details: { reason, message: "[REDACTED: Staff login credentials]" },
      });
      return { sent: false, reason };
    }
  };

  const sendEmail = async () => {
    const email = validStaffEmail(args.email);
    const resendKey = process.env.RESEND_API_KEY || "";
    const from = process.env.ATIS_EMAIL_FROM || "";

    if (!email) return { sent: false, reason: "No valid staff email address is recorded." };
    if (!resendKey || !from) {
      return { sent: false, reason: "Email delivery is not configured." };
    }

    try {
      const response = await staffFetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "ATIS — Staff Login Details",
          text:
            "Dear " + args.fullName + "\n\nYour ATIS staff account login details are:\n" +
            "Username: " + args.username + "\nTemporary Password: " +
            args.temporaryPassword + "\n" +
            (loginUrl ? "Login: " + loginUrl + "\n" : "") +
            "\nPlease change the temporary password after signing in.\n\nATIS",
        }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "HTTP " + response.status);

      await safeLog({
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "email",
        destination: email,
        status: "sent",
        providerReference: String(body?.id || ""),
        sentBy: args.sentBy,
        details: {
          subject: "ATIS — Staff Login Details",
          message: "[REDACTED: Staff login credentials]",
        },
      });
      return { sent: true, reason: "" };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "Email provider did not respond quickly enough. The new password is still active."
          : error instanceof Error
            ? error.message
            : "Email delivery failed.";

      await safeLog({
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "email",
        destination: email,
        status: "failed",
        sentBy: args.sentBy,
        details: { reason, message: "[REDACTED: Staff login credentials]" },
      });
      return { sent: false, reason };
    }
  };

  const [sms, email] = await Promise.all([sendSms(), sendEmail()]);

  if (!sms.sent && !email.sent) {
    await safeLog({
      schoolId: args.schoolId,
      staffId: args.staffId,
      kind: "staff_login",
      channel: "manual",
      status: "credentials_generated",
      sentBy: args.sentBy,
      details: { message: "[REDACTED: Staff login credentials]" },
    });
  }

  return {
    smsSent: sms.sent,
    smsReason: sms.reason,
    emailSent: email.sent,
    emailReason: email.reason,
  };
}

export async function provisionOrResetStaffLogin(
  admin: SupabaseClient,
  args: { schoolId: string; staffId: string; sentBy?: string; loginUrl?: string },
) {
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id,user_id,full_name,email,mobile,role,status,legacy_payload")
    .eq("id", args.staffId)
    .eq("school_id", args.schoolId)
    .single();

  if (staffError || !staff) throw new Error("Staff account not found.");
  if (staff.status !== "active") {
    throw new Error("Only active staff can receive login details.");
  }

  const staffEmail = validStaffEmail(staff.email);
  const temporaryPassword = generateTemporaryPassword();
  let userId = staff.user_id as string | null;
  let username = "";
  let deliveryEmail = staffEmail;

  if (userId) {
    const [{ data: authData, error: authError }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from("profiles")
        .select("username,email")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (authError || !authData.user) {
      throw new Error("The linked staff login account could not be found.");
    }

    if (profile) {
      username = profile.username;
      if (!deliveryEmail) {
        const profileEmail = validStaffEmail(profile.email);
        if (profileEmail && !profileEmail.endsWith(".atis.invalid")) {
          deliveryEmail = profileEmail;
        }
      }
    } else {
      const preferred = String((staff.legacy_payload as any)?.source_username || "");
      username = await generateUniqueUsername(admin, staff.full_name, preferred);
      const authEmail = validStaffEmail(authData.user.email);

      if (!authEmail) {
        throw new Error(
          "The staff login exists but its profile is missing and the Auth account has no usable email. Update the staff email first.",
        );
      }

      const { error: profileError } = await admin.from("profiles").insert({
        user_id: userId,
        school_id: args.schoolId,
        username,
        full_name: staff.full_name,
        email: authEmail,
        mobile: staff.mobile || null,
        role: staff.role,
        status: "active",
        must_change_password: true,
      });
      if (profileError) throw profileError;
      if (!deliveryEmail) deliveryEmail = authEmail;
    }

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: staff.full_name },
    });
    if (updateAuthError) throw updateAuthError;
  } else {
    // A real email is needed only when creating a new Supabase Auth account.
    if (!staffEmail) {
      throw new Error(
        "A valid staff email address is required before creating login access. Existing accounts can be reset without email delivery.",
      );
    }

    const preferred = String((staff.legacy_payload as any)?.source_username || "");
    username = await generateUniqueUsername(admin, staff.full_name, preferred);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: staffEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: staff.full_name },
    });
    if (createError || !created.user) {
      throw createError || new Error("Could not create Auth user.");
    }
    userId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      school_id: args.schoolId,
      username,
      full_name: staff.full_name,
      email: staffEmail,
      mobile: staff.mobile || null,
      role: staff.role,
      status: "active",
      must_change_password: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const { error: linkError } = await admin
      .from("staff")
      .update({ user_id: userId })
      .eq("id", staff.id);

    if (linkError) {
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
      throw linkError;
    }
  }

  const { error: profileUpdateError } = await admin
    .from("profiles")
    .update({
      must_change_password: true,
      status: "active",
      full_name: staff.full_name,
      mobile: staff.mobile || null,
      role: staff.role,
    })
    .eq("user_id", userId);

  const profileRefreshReason = profileUpdateError
    ? "Password reset succeeded, but the account profile flag could not be refreshed: " +
      profileUpdateError.message
    : "";

  const delivery = await sendStaffCredentials(admin, {
    schoolId: args.schoolId,
    staffId: staff.id,
    fullName: staff.full_name,
    mobile: staff.mobile,
    email: deliveryEmail || null,
    username,
    temporaryPassword,
    sentBy: args.sentBy,
    loginUrl: args.loginUrl,
  });

  try {
    await admin.from("audit_logs").insert({
      school_id: args.schoolId,
      actor_user_id: args.sentBy || null,
      action: "Staff Login Issued or Reset",
      entity_type: "staff",
      entity_id: staff.id,
      details: {
        username,
        sms_sent: delivery.smsSent,
        email_sent: delivery.emailSent,
        credentials: "[REDACTED]",
      },
    });
  } catch {
    // Audit logging should not invalidate an already successful password reset.
  }

  return {
    fullName: staff.full_name,
    username,
    temporaryPassword,
    email: deliveryEmail || "",
    mobile: staff.mobile || "",
    ...delivery,
    profileRefreshReason,
  };
}

