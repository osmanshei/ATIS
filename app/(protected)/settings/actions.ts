"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

export async function saveSchoolProfileAction(formData: FormData) {
  const { profile } = await requireProfile(["admin"]);
  const admin = createAdminClient();

  const payload = {
    name: value(formData, "name"),
    short_name: value(formData, "short_name") || "ATIS",
    address: value(formData, "address") || null,
    city: value(formData, "city") || null,
    region: value(formData, "region") || null,
    country: value(formData, "country") || "Ghana",
    phone: value(formData, "phone") || null,
    email: value(formData, "email") || null,
    website: value(formData, "website") || null,
    logo_url: value(formData, "logo_url") || null,
    timezone: value(formData, "timezone") || "Africa/Accra",
    currency_code: value(formData, "currency_code") || "GHS",
    updated_at: new Date().toISOString(),
  };

  if (!payload.name) {
    redirect("/settings?error=School+name+is+required.");
  }

  const { error } = await admin.from("schools").update(payload).eq("id", profile.school_id);
  if (error) redirect("/settings?error=" + encodeURIComponent(error.message));
  redirect("/settings?ok=School+profile+saved.");
}

export async function saveSchoolMessagingAction(formData: FormData) {
  const { profile } = await requireProfile(["admin"]);
  const admin = createAdminClient();
  const senderId = value(formData, "sms_sender_id");
  const apiKey = value(formData, "sms_api_key");

  const rows = [
    {
      school_id: profile.school_id,
      setting_key: "SMS_SENDER_ID",
      setting_value: senderId,
      is_secret: false,
      updated_at: new Date().toISOString(),
    },
  ];

  // A blank API-key field means keep the existing secret; never overwrite it accidentally.
  if (apiKey) {
    rows.push({
      school_id: profile.school_id,
      setting_key: "SMS_API_KEY",
      setting_value: apiKey,
      is_secret: true,
      updated_at: new Date().toISOString(),
    });
  }

  const { error } = await admin.from("school_settings").upsert(rows, {
    onConflict: "school_id,setting_key",
  });
  if (error) redirect("/settings?error=" + encodeURIComponent(error.message));
  redirect("/settings?ok=Messaging+settings+saved.");
}

export async function saveAcademicCalendarAction(formData: FormData) {
  const { profile } = await requireProfile(["admin"]);
  const admin = createAdminClient();
  const yearId = value(formData, "academic_year_id");
  const termId = value(formData, "term_id");

  if (!yearId || !termId) redirect("/settings?error=Select+both+an+academic+year+and+a+term.");

  const { data: year, error: yearLookupError } = await admin
    .from("academic_years")
    .select("id")
    .eq("id", yearId)
    .eq("school_id", profile.school_id)
    .maybeSingle();
  const { data: term, error: termLookupError } = await admin
    .from("terms")
    .select("id,academic_year_id")
    .eq("id", termId)
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (yearLookupError || termLookupError || !year || !term || term.academic_year_id !== year.id) {
    redirect("/settings?error=The+selected+term+does+not+belong+to+that+academic+year.");
  }

  const { error: clearYearError } = await admin
    .from("academic_years")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("school_id", profile.school_id);
  if (clearYearError) redirect("/settings?error=" + encodeURIComponent(clearYearError.message));

  const { error: setYearError } = await admin
    .from("academic_years")
    .update({ is_current: true, updated_at: new Date().toISOString() })
    .eq("id", year.id)
    .eq("school_id", profile.school_id);
  if (setYearError) redirect("/settings?error=" + encodeURIComponent(setYearError.message));

  const { error: clearTermError } = await admin
    .from("terms")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("school_id", profile.school_id);
  if (clearTermError) redirect("/settings?error=" + encodeURIComponent(clearTermError.message));

  const { error: setTermError } = await admin
    .from("terms")
    .update({ is_current: true, updated_at: new Date().toISOString() })
    .eq("id", term.id)
    .eq("school_id", profile.school_id);
  if (setTermError) redirect("/settings?error=" + encodeURIComponent(setTermError.message));

  redirect("/settings?ok=Current+academic+year+and+term+updated.");
}
