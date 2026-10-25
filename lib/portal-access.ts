import "server-only";

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateTemporaryPassword,
  generateUniqueUsername,
  normalizeGhanaPhone,
} from "@/lib/staff-access";

const SMS_BASE = (process.env.SMS_ONLINE_GHANA_BASE_URL || "https://api.smsonlinegh.com/v5").replace(/\/+$/, "");
const SMS_SENDER = process.env.SMS_ONLINE_GHANA_GENERAL_SENDER || "ATIS_GH";

function validEmail(value: string | null | undefined) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function fetchWithTimeout(
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

function internalPortalEmail(
  username: string,
  kind: "students" | "parents",
) {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  return username + "." + suffix + "@" + kind + ".atis.invalid";
}

async function createPortalAuthUser(
  admin: SupabaseClient,
  args: {
    username: string;
    fullName: string;
    password: string;
    kind: "students" | "parents";
  },
) {
  // Portal users authenticate with their ATIS username. A private internal
  // Auth email prevents collisions with staff emails, shared parent emails,
  // or old/orphaned Supabase Auth records.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const authEmail = internalPortalEmail(args.username, args.kind);
    const { data, error } = await admin.auth.admin.createUser({
      email: authEmail,
      password: args.password,
      email_confirm: true,
      user_metadata: {
        username: args.username,
        full_name: args.fullName,
        portal_account: true,
      },
    });

    if (!error && data.user) {
      return { user: data.user, authEmail };
    }

    const message = String(error?.message || "").toLowerCase();
    if (!message.includes("already") && !message.includes("registered")) {
      throw error || new Error("Could not create portal Auth user.");
    }
  }

  throw new Error("Could not allocate a unique ATIS portal login identity.");
}


async function sendCredentials(args: {
  fullName: string;
  username: string;
  temporaryPassword: string;
  mobile?: string | null;
  email?: string | null;
  accountLabel: string;
}) {
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  const loginUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (vercelHost ? "https://" + vercelHost : "");
  const message =
    "ATIS " + args.accountLabel + " login for " + args.fullName + ". " +
    (loginUrl ? "Login: " + loginUrl + ". " : "") +
    "Username: " + args.username + ". Temporary password: " +
    args.temporaryPassword + ". Please change it after signing in.";

  const sendSms = async () => {
    const smsKey = process.env.SMS_ONLINE_GHANA_API_KEY || "";
    const phone = normalizeGhanaPhone(args.mobile);
    if (!smsKey) return { sent: false, reason: "SMS API is not configured." };
    if (!phone) return { sent: false, reason: "No valid Ghana mobile number." };

    try {
      const response = await fetchWithTimeout(SMS_BASE + "/message/sms/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: "key " + smsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: message,
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
      return { sent: true, reason: "" };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "SMS provider did not respond quickly enough. Credentials are still valid."
          : error instanceof Error
            ? error.message
            : "SMS delivery failed.";
      return { sent: false, reason };
    }
  };

  const sendEmail = async () => {
    const email = validEmail(args.email);
    const resendKey = process.env.RESEND_API_KEY || "";
    const from = process.env.ATIS_EMAIL_FROM || "";

    if (!email) return { sent: false, reason: "No usable email address is recorded." };
    if (!resendKey || !from) {
      return { sent: false, reason: "Email delivery is not configured." };
    }

    try {
      const response = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + resendKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "ATIS — " + args.accountLabel + " Login Details",
          text:
            "Dear " + args.fullName + "\n\n" +
            "Username: " + args.username + "\n" +
            "Temporary Password: " + args.temporaryPassword + "\n" +
            (loginUrl ? "Login: " + loginUrl + "\n" : "") +
            "\nPlease change the temporary password after signing in.\n\nATIS",
        }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || "HTTP " + response.status);
      return { sent: true, reason: "" };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "Email provider did not respond quickly enough. Credentials are still valid."
          : error instanceof Error
            ? error.message
            : "Email delivery failed.";
      return { sent: false, reason };
    }
  };

  // Delivery must never hold the account transaction indefinitely.
  // SMS and email are attempted in parallel and both have short timeouts.
  const [sms, email] = await Promise.all([sendSms(), sendEmail()]);

  return {
    smsSent: sms.sent,
    emailSent: email.sent,
    smsReason: sms.reason,
    emailReason: email.reason,
  };
}

async function ensureLinkedPortalProfile(
  admin: SupabaseClient,
  args: {
    userId: string;
    schoolId: string;
    role: "student" | "parent";
    fullName: string;
    mobile?: string | null;
    preferredUsername?: string | null;
  },
) {
  const { data: existing, error: existingError } = await admin
    .from("profiles")
    .select("username,email,role,school_id")
    .eq("user_id", args.userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    if (existing.school_id !== args.schoolId) {
      throw new Error("The linked login account belongs to another school.");
    }
    if (existing.role !== args.role) {
      throw new Error(
        "The linked login account already belongs to a different ATIS role. Please contact the system administrator.",
      );
    }
    return { username: existing.username, email: existing.email };
  }

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(args.userId);
  if (authError || !authData.user) {
    throw new Error("The linked Auth account could not be found.");
  }

  const username = await generateUniqueUsername(
    admin,
    args.fullName,
    args.preferredUsername || undefined,
  );

  // A previous interrupted attempt may have created Auth with a real contact
  // email and failed before the ATIS profile/link completed. Move that Auth
  // user to a unique internal email before repairing the profile.
  let authEmail = internalPortalEmail(
    username,
    args.role === "parent" ? "parents" : "students",
  );

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(args.userId, {
    email: authEmail,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: args.fullName,
      portal_account: true,
    },
  });
  if (authUpdateError) throw authUpdateError;

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: args.userId,
    school_id: args.schoolId,
    username,
    full_name: args.fullName,
    email: authEmail,
    mobile: args.mobile || null,
    role: args.role,
    status: "active",
    must_change_password: true,
  });
  if (profileError) throw profileError;

  return { username, email: authEmail };
}

export async function provisionStudentPortalLogin(
  admin: SupabaseClient,
  args: { schoolId: string; studentId: string; sentBy?: string },
) {
  const { data: student, error } = await admin
    .from("students")
    .select("id,user_id,admission_number,first_name,middle_name,last_name,status")
    .eq("id", args.studentId)
    .eq("school_id", args.schoolId)
    .single();

  if (error || !student) throw new Error("Student record not found.");
  if (student.status !== "active") throw new Error("Only active students can receive portal access.");

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
  const temporaryPassword = generateTemporaryPassword();
  let userId = student.user_id as string | null;
  let username = "";
  let authEmail = "";

  if (userId) {
    const profile = await ensureLinkedPortalProfile(admin, {
      userId,
      schoolId: args.schoolId,
      role: "student",
      fullName,
      preferredUsername: String(student.admission_number || ""),
    });
    username = profile.username;
    authEmail = profile.email;

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (updateError) throw updateError;
  } else {
    username = await generateUniqueUsername(
      admin,
      fullName,
      String(student.admission_number || ""),
    );
    const created = await createPortalAuthUser(admin, {
      username,
      fullName,
      password: temporaryPassword,
      kind: "students",
    });
    authEmail = created.authEmail;
    userId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      school_id: args.schoolId,
      username,
      full_name: fullName,
      email: authEmail,
      role: "student",
      status: "active",
      must_change_password: true,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const { error: linkError } = await admin
      .from("students")
      .update({ user_id: userId })
      .eq("id", student.id);
    if (linkError) {
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
      throw linkError;
    }
  }

  try {
    await admin
      .from("profiles")
      .update({ must_change_password: true, status: "active" })
      .eq("user_id", userId);
  } catch {
    // The Auth password/login is already valid. A secondary profile refresh
    // must not hide the generated credentials from the administrator.
  }

  const { data: contactLink } = await admin
    .from("student_guardians")
    .select("guardian_id,guardians(full_name,email,mobile)")
    .eq("student_id", student.id)
    .order("is_primary_contact", { ascending: false })
    .limit(1)
    .maybeSingle();

  const guardian = (contactLink as any)?.guardians || null;
  const delivery = await sendCredentials({
    fullName,
    username,
    temporaryPassword,
    mobile: guardian?.mobile || null,
    email: guardian?.email || null,
    accountLabel: "Student Portal",
  });

  try {
    await admin.from("audit_logs").insert({
      school_id: args.schoolId,
      actor_user_id: args.sentBy || null,
      action: "Student Portal Login Issued",
      entity_type: "student",
      entity_id: student.id,
      details: {
        username,
        sms_sent: delivery.smsSent,
        email_sent: delivery.emailSent,
        credentials: "[REDACTED]",
      },
    });
  } catch {
    // Audit logging must not invalidate an already-created portal login.
  }

  return { fullName, username, temporaryPassword, authEmail, ...delivery };
}

export async function provisionGuardianPortalLogin(
  admin: SupabaseClient,
  args: { schoolId: string; guardianId: string; sentBy?: string },
) {
  const { data: guardian, error } = await admin
    .from("guardians")
    .select("id,user_id,full_name,email,mobile,status")
    .eq("id", args.guardianId)
    .eq("school_id", args.schoolId)
    .single();

  if (error || !guardian) throw new Error("Guardian record not found.");
  if (guardian.status !== "active") throw new Error("Only active guardians can receive portal access.");

  const fullName = guardian.full_name;
  const temporaryPassword = generateTemporaryPassword();
  let userId = guardian.user_id as string | null;
  let username = "";
  let authEmail = "";

  if (userId) {
    const profile = await ensureLinkedPortalProfile(admin, {
      userId,
      schoolId: args.schoolId,
      role: "parent",
      fullName,
      mobile: guardian.mobile,
    });
    username = profile.username;
    authEmail = profile.email;

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (updateError) throw updateError;
  } else {
    username = await generateUniqueUsername(admin, "Parent " + fullName);
    const created = await createPortalAuthUser(admin, {
      username,
      fullName,
      password: temporaryPassword,
      kind: "parents",
    });
    authEmail = created.authEmail;
    userId = created.user.id;

    const { error: profileError } = await admin.from("profiles").insert({
      user_id: userId,
      school_id: args.schoolId,
      username,
      full_name: fullName,
      email: authEmail,
      mobile: guardian.mobile || null,
      role: "parent",
      status: "active",
      must_change_password: true,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const { error: linkError } = await admin
      .from("guardians")
      .update({ user_id: userId })
      .eq("id", guardian.id);
    if (linkError) {
      await admin.from("profiles").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
      throw linkError;
    }
  }

  try {
    await admin
      .from("profiles")
      .update({ must_change_password: true, status: "active" })
      .eq("user_id", userId);
  } catch {
    // The Auth login is already valid. Keep the generated credentials visible.
  }

  const delivery = await sendCredentials({
    fullName,
    username,
    temporaryPassword,
    mobile: guardian.mobile,
    email: guardian.email,
    accountLabel: "Parent Portal",
  });

  try {
    await admin.from("audit_logs").insert({
      school_id: args.schoolId,
      actor_user_id: args.sentBy || null,
      action: "Parent Portal Login Issued",
      entity_type: "guardian",
      entity_id: guardian.id,
      details: {
        username,
        sms_sent: delivery.smsSent,
        email_sent: delivery.emailSent,
        credentials: "[REDACTED]",
      },
    });
  } catch {
    // Audit logging must not invalidate an already-created portal login.
  }

  return { fullName, username, temporaryPassword, authEmail, ...delivery };
}
