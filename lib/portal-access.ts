import "server-only";

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

async function usableAuthEmail(
  admin: SupabaseClient,
  preferred: string,
  username: string,
  kind: "students" | "parents",
) {
  if (preferred) {
    const { data } = await admin
      .from("profiles")
      .select("user_id")
      .eq("email", preferred)
      .maybeSingle();
    if (!data) return preferred;
  }
  return username + "@" + kind + ".atis.invalid";
}

async function sendCredentials(args: {
  fullName: string;
  username: string;
  temporaryPassword: string;
  mobile?: string | null;
  email?: string | null;
  accountLabel: string;
}) {
  const result = { smsSent: false, emailSent: false, smsReason: "", emailReason: "" };
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  const loginUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (vercelHost ? "https://" + vercelHost : "");
  const message =
    "ATIS " + args.accountLabel + " login for " + args.fullName + ". " +
    (loginUrl ? "Login: " + loginUrl + ". " : "") +
    "Username: " + args.username + ". Temporary password: " +
    args.temporaryPassword + ". Please change it after signing in.";

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
      result.smsSent = true;
    } catch (error) {
      result.smsReason = error instanceof Error ? error.message : "SMS delivery failed.";
    }
  } else {
    result.smsReason = smsKey ? "No valid Ghana mobile number." : "SMS API is not configured.";
  }

  const email = validEmail(args.email);
  const resendKey = process.env.RESEND_API_KEY || "";
  const from = process.env.ATIS_EMAIL_FROM || "";
  if (email && resendKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
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
      result.emailSent = true;
    } catch (error) {
      result.emailReason = error instanceof Error ? error.message : "Email delivery failed.";
    }
  } else {
    result.emailReason = email
      ? "Email delivery is not configured."
      : "No usable email address is recorded.";
  }

  return result;
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
    const { data: profile } = await admin
      .from("profiles")
      .select("username,email")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("The student Auth link exists but its profile is missing.");
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
    authEmail = await usableAuthEmail(admin, "", username, "students");

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (createError || !created.user) throw createError || new Error("Could not create student Auth user.");
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

  await admin
    .from("profiles")
    .update({ must_change_password: true, status: "active" })
    .eq("user_id", userId);

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
    const { data: profile } = await admin
      .from("profiles")
      .select("username,email")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("The guardian Auth link exists but its profile is missing.");
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
    authEmail = await usableAuthEmail(
      admin,
      validEmail(guardian.email),
      username,
      "parents",
    );

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (createError || !created.user) throw createError || new Error("Could not create parent Auth user.");
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

  await admin
    .from("profiles")
    .update({ must_change_password: true, status: "active" })
    .eq("user_id", userId);

  const delivery = await sendCredentials({
    fullName,
    username,
    temporaryPassword,
    mobile: guardian.mobile,
    email: guardian.email,
    accountLabel: "Parent Portal",
  });

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

  return { fullName, username, temporaryPassword, authEmail, ...delivery };
}
