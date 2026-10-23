import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const SMS_BASE = (process.env.SMS_ONLINE_GHANA_BASE_URL || "https://api.smsonlinegh.com/v5").replace(/\/+$/, "");
const SMS_SENDER = process.env.SMS_ONLINE_GHANA_GENERAL_SENDER || "ATIS_GH";

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
  const result = { smsSent: false, smsReason: "", emailSent: false, emailReason: "" };
  const loginUrl = args.loginUrl || process.env.NEXT_PUBLIC_APP_URL || "";
  const plainMessage =
    "Dear " + args.fullName + ", ATIS staff login: " + (loginUrl ? loginUrl + " " : "") +
    "Username: " + args.username + ". Temporary password: " + args.temporaryPassword +
    ". Please change your password after login.";

  const smsKey = process.env.SMS_ONLINE_GHANA_API_KEY || "";
  const phone = normalizeGhanaPhone(args.mobile);
  if (smsKey && phone) {
    try {
      const response = await fetch(SMS_BASE + "/message/sms/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "key " + smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: plainMessage, type: 0, sender: SMS_SENDER, destinations: [phone] }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      const ok = response.ok && body?.handshake && Number(body.handshake.id) === 0 && String(body.handshake.label || "") === "HSHK_OK";
      if (!ok) throw new Error(body?.handshake?.label || "HTTP " + response.status);

      const destination = body?.data?.destinations?.[0] || {};
      result.smsSent = true;
      await logDelivery(admin, {
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
    } catch (error) {
      result.smsReason = error instanceof Error ? error.message : "SMS delivery failed.";
      await logDelivery(admin, {
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "sms",
        destination: phone || args.mobile || "",
        status: "failed",
        sentBy: args.sentBy,
        details: { reason: result.smsReason, message: "[REDACTED: Staff login credentials]" },
      });
    }
  } else {
    result.smsReason = smsKey ? "No valid Ghana mobile number." : "SMS API is not configured.";
  }

  const resendKey = process.env.RESEND_API_KEY || "";
  const from = process.env.ATIS_EMAIL_FROM || "";
  if (resendKey && from && args.email) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [args.email],
          subject: "ATIS — Staff Login Details",
          text:
            "Dear " + args.fullName + "\n\nYour ATIS staff account login details are:\n" +
            "Username: " + args.username + "\nTemporary Password: " + args.temporaryPassword + "\n" +
            (loginUrl ? "Login: " + loginUrl + "\n" : "") +
            "\nPlease change the temporary password after signing in.\n\nATIS",
        }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "HTTP " + response.status);

      result.emailSent = true;
      await logDelivery(admin, {
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "email",
        destination: args.email,
        status: "sent",
        providerReference: String(body?.id || ""),
        sentBy: args.sentBy,
        details: { subject: "ATIS — Staff Login Details", message: "[REDACTED: Staff login credentials]" },
      });
    } catch (error) {
      result.emailReason = error instanceof Error ? error.message : "Email delivery failed.";
      await logDelivery(admin, {
        schoolId: args.schoolId,
        staffId: args.staffId,
        kind: "staff_login",
        channel: "email",
        destination: args.email,
        status: "failed",
        sentBy: args.sentBy,
        details: { reason: result.emailReason, message: "[REDACTED: Staff login credentials]" },
      });
    }
  } else {
    result.emailReason = !args.email ? "No staff email address is recorded." : "Email delivery is not configured.";
  }

  if (!result.smsSent && !result.emailSent) {
    await logDelivery(admin, {
      schoolId: args.schoolId,
      staffId: args.staffId,
      kind: "staff_login",
      channel: "manual",
      status: "credentials_generated",
      sentBy: args.sentBy,
      details: { message: "[REDACTED: Staff login credentials]" },
    });
  }

  return result;
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
  if (staff.status !== "active") throw new Error("Only active staff can receive login details.");

  const email = String(staff.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid staff email address is required before creating login access.");
  }

  const temporaryPassword = generateTemporaryPassword();
  let userId = staff.user_id as string | null;
  let username = "";

  if (userId) {
    const { data: profile, error: profileError } = await admin.from("profiles").select("username").eq("user_id", userId).single();
    if (profileError || !profile) throw new Error("The staff Auth link exists but its profile is missing.");
    username = profile.username;

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: staff.full_name },
    });
    if (updateAuthError) throw updateAuthError;
  } else {
    const preferred = String((staff.legacy_payload as any)?.source_username || "");
    username = await generateUniqueUsername(admin, staff.full_name, preferred);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: staff.full_name },
    });
    if (createError || !created.user) throw createError || new Error("Could not create Auth user.");
    userId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      school_id: args.schoolId,
      username,
      full_name: staff.full_name,
      email,
      mobile: staff.mobile || null,
      role: staff.role,
      status: "active",
      must_change_password: true,
    });

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const { error: linkError } = await admin.from("staff").update({ user_id: userId }).eq("id", staff.id);
    if (linkError) {
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
      throw linkError;
    }
  }

  await admin.from("profiles").update({ must_change_password: true, status: "active" }).eq("user_id", userId);

  const delivery = await sendStaffCredentials(admin, {
    schoolId: args.schoolId,
    staffId: staff.id,
    fullName: staff.full_name,
    mobile: staff.mobile,
    email,
    username,
    temporaryPassword,
    sentBy: args.sentBy,
    loginUrl: args.loginUrl,
  });

  return {
    fullName: staff.full_name,
    username,
    temporaryPassword,
    email,
    mobile: staff.mobile || "",
    ...delivery,
  };
}
